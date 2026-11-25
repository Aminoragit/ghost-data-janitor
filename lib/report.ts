import { RULES } from "./detect";
import type { AuditEntry, DataRecord, Decision, Finding } from "./types";

export interface CleanupResult {
  kept: DataRecord[];
  removed: DataRecord[];
  archived: DataRecord[];
  counts: Record<string, number>;
  reclaimedKb: number;
}

/**
 * Apply APPROVED findings only. The human gate is structural: this
 * function throws if any finding it is asked to apply is not approved,
 * so no code path can mutate data on pending/rejected findings.
 */
export function executeCleanup(
  records: DataRecord[],
  findings: Finding[],
  decisions: Map<string, Decision>,
): CleanupResult {
  const byId = new Map(records.map((r) => [r.id, r]));
  const removedIds = new Set<string>();
  const archivedIds = new Set<string>();
  const counts: Record<string, number> = { DELETE: 0, MERGE: 0, ARCHIVE: 0, KEEP: 0 };

  for (const f of findings) {
    const decision = decisions.get(f.recordId) ?? "pending";
    if (decision !== "approved") continue; // untouched — human gate
    switch (f.action) {
      case "DELETE":
        removedIds.add(f.recordId);
        counts.DELETE++;
        break;
      case "MERGE":
        removedIds.add(f.recordId);
        counts.MERGE++;
        break;
      case "ARCHIVE":
        archivedIds.add(f.recordId);
        counts.ARCHIVE++;
        break;
      case "KEEP":
        counts.KEEP++;
        break;
    }
  }

  const kept = records.filter((r) => !removedIds.has(r.id) && !archivedIds.has(r.id));
  const removed = [...removedIds].map((id) => byId.get(id)!).filter(Boolean);
  const archived = [...archivedIds].map((id) => byId.get(id)!).filter(Boolean);
  return {
    kept,
    removed,
    archived,
    counts,
    reclaimedKb: Math.round(removed.length * RULES.rowSizeKb * 10) / 10,
  };
}

export function audit(
  log: AuditEntry[],
  actor: AuditEntry["actor"],
  event: string,
  detail: string,
  at: Date = new Date(),
): AuditEntry[] {
  return [...log, { at: at.toISOString(), actor, event, detail }];
}

export function buildReport(args: {
  total: number;
  findings: Finding[];
  decisions: Map<string, Decision>;
  result: CleanupResult;
  log: AuditEntry[];
}): string {
  const { total, findings, decisions, result, log } = args;
  const byCat = (c: string) => findings.filter((f) => f.category === c).length;
  const rejected = findings.filter(
    (f) => (decisions.get(f.recordId) ?? "pending") === "rejected",
  ).length;
  const lines = [
    "# Ghost Data Janitor — Cleanup Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    `- Records scanned: ${total}`,
    `- Duplicates found: ${byCat("DUPLICATE")} (merged away: ${result.counts.MERGE})`,
    `- Ghosts found: ${byCat("GHOST")} (deleted: ${result.counts.DELETE})`,
    `- Anomalies found: ${byCat("ANOMALY")} (archived: ${result.counts.ARCHIVE})`,
    `- Healthy records: ${byCat("HEALTHY")}`,
    `- Findings rejected by human (kept untouched): ${rejected}`,
    `- Records remaining after cleanup: ${result.kept.length}`,
    `- Estimated storage reclaimed: ${result.reclaimedKb} KB (${result.removed.length} records x ${RULES.rowSizeKb} KB)`,
    "",
    "## Audit log",
    ...log.map((e) => `- [${e.at}] (${e.actor}) ${e.event} — ${e.detail}`),
    "",
  ];
  return lines.join("\n");
}
