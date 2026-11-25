import type { DataRecord, Finding } from "./types";

/**
 * Deterministic rule engine. Every number in a finding is decided here —
 * never by a language model. The narration (reason strings) only explains
 * what the rules already decided. Thresholds live in .kiro/steering/
 * cleanup-rules.md and are mirrored in RULES below.
 */
export const RULES = {
  ghostDays: 90,
  ghostStatuses: ["inactive", "dormant"],
  nameSimilarity: 0.85,
  emailLocalSimilarity: 0.7,
  rowSizeKb: 2.4,
} as const;

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const normalizePhone = (p: string) => p.replace(/\D/g, "");
export const normalizeName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** 0..1 similarity (1 = identical). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function daysBetween(fromIso: string, to: Date): number | null {
  const d = new Date(fromIso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  const ms = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()) - d.getTime();
  return Math.floor(ms / 86_400_000);
}

function anomalyReason(r: DataRecord, now: Date): string | null {
  if (!r.name) return "Missing name — record cannot be identified.";
  if (!r.email) return "Missing email — record cannot be contacted or deduplicated.";
  if (!EMAIL_RE.test(r.email)) return `Malformed email "${r.email}".`;
  const ll = r.last_login ? daysBetween(r.last_login, now) : null;
  if (ll !== null && ll < 0) return `last_login ${r.last_login} is in the future.`;
  const ca = daysBetween(r.created_at, now);
  if (ca !== null && ca < 0) return `created_at ${r.created_at} is in the future.`;
  if (r.login_count < 0) return `login_count is negative (${r.login_count}).`;
  return null;
}

/**
 * Classify every record. Priority: ANOMALY > DUPLICATE > GHOST > HEALTHY.
 * Duplicate groups: earliest created_at is the primary (KEEP); the rest
 * are MERGE findings pointing at the primary.
 */
export function detect(records: DataRecord[], now: Date = new Date()): Finding[] {
  const findings = new Map<string, Finding>();

  // 1) anomalies first — a malformed record is never merged or ghosted.
  for (const r of records) {
    const reason = anomalyReason(r, now);
    if (reason) {
      findings.set(r.id, {
        recordId: r.id,
        category: "ANOMALY",
        action: "ARCHIVE",
        reason,
        risk: "HIGH",
      });
    }
  }

  // 2) duplicate groups among non-anomalous records.
  const pool = records.filter((r) => !findings.has(r.id));
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  for (const r of pool) parent.set(r.id, r.id);
  const union = (a: string, b: string) => parent.set(find(a), find(b));

  const matchReason = new Map<string, string>();
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      let why: string | null = null;
      const ea = normalizeEmail(a.email);
      const eb = normalizeEmail(b.email);
      const pa = normalizePhone(a.phone);
      const pb = normalizePhone(b.phone);
      if (ea && ea === eb) why = `Same email ${ea}`;
      else if (pa && pa.length >= 7 && pa === pb) why = `Same phone ${a.phone}`;
      else {
        const nameSim = similarity(normalizeName(a.name), normalizeName(b.name));
        const localSim = similarity(ea.split("@")[0] ?? "", eb.split("@")[0] ?? "");
        if (nameSim >= RULES.nameSimilarity && localSim >= RULES.emailLocalSimilarity) {
          why = `Near-identical name and email (name ${(nameSim * 100).toFixed(0)}% similar)`;
        }
      }
      if (why) {
        union(a.id, b.id);
        if (!matchReason.has(b.id)) matchReason.set(b.id, why);
        if (!matchReason.has(a.id)) matchReason.set(a.id, why);
      }
    }
  }
  const groups = new Map<string, DataRecord[]>();
  for (const r of pool) {
    const root = find(r.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(r);
  }
  for (const [root, members] of groups) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((x, y) => x.created_at.localeCompare(y.created_at));
    const primary = sorted[0];
    for (const m of sorted.slice(1)) {
      findings.set(m.id, {
        recordId: m.id,
        category: "DUPLICATE",
        action: "MERGE",
        reason: `${matchReason.get(m.id) ?? "Duplicate"} — merge into ${primary.id} (oldest record).`,
        risk: "MEDIUM",
        groupId: root,
        primaryId: primary.id,
      });
    }
    if (!findings.has(primary.id)) {
      findings.set(primary.id, {
        recordId: primary.id,
        category: "DUPLICATE",
        action: "KEEP",
        reason: `Primary of a ${members.length}-record duplicate group — kept as the surviving record.`,
        risk: "LOW",
        groupId: root,
        primaryId: primary.id,
      });
    }
  }

  // 3) ghosts, then healthy.
  for (const r of pool) {
    if (findings.has(r.id)) continue;
    const days = r.last_login ? daysBetween(r.last_login, now) : null;
    if (
      days !== null &&
      days >= RULES.ghostDays &&
      RULES.ghostStatuses.includes(r.status as (typeof RULES.ghostStatuses)[number])
    ) {
      findings.set(r.id, {
        recordId: r.id,
        category: "GHOST",
        action: "DELETE",
        reason: `No login for ${days} days and status is "${r.status}" — a ghost account.`,
        risk: "MEDIUM",
      });
    } else {
      findings.set(r.id, {
        recordId: r.id,
        category: "HEALTHY",
        action: "KEEP",
        reason:
          days !== null && days >= RULES.ghostDays
            ? `No login for ${days} days, but status is still "${r.status}" — not a ghost.`
            : "Active and well-formed — nothing to clean.",
        risk: "LOW",
      });
    }
  }

  return records.map((r) => findings.get(r.id)!).filter(Boolean);
}
