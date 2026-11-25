import { describe, expect, it } from "vitest";
import { detect, similarity } from "../detect";
import { sampleRecords } from "../sampleData";
import { executeCleanup } from "../report";
import type { Decision } from "../types";

const NOW = new Date("2026-11-25T00:00:00Z");

describe("sample data detection", () => {
  const records = sampleRecords(NOW);
  const findings = detect(records, NOW);
  const byId = new Map(findings.map((f) => [f.recordId, f]));

  it("has 45 records and a finding for each", () => {
    expect(records.length).toBe(45);
    expect(findings.length).toBe(45);
  });

  it("counts categories: 30 healthy, 6 duplicate-group, 5 ghost, 4 anomaly", () => {
    const count = (c: string) => findings.filter((f) => f.category === c).length;
    expect(count("HEALTHY")).toBe(30);
    expect(count("DUPLICATE")).toBe(6);
    expect(count("GHOST")).toBe(5);
    expect(count("ANOMALY")).toBe(4);
  });

  it("exact duplicates merge into the oldest record", () => {
    expect(byId.get("D01")!.action).toBe("KEEP");
    expect(byId.get("D02")!.action).toBe("MERGE");
    expect(byId.get("D02")!.primaryId).toBe("D01");
    expect(byId.get("D03")!.primaryId).toBe("D01");
  });

  it("fuzzy duplicates (name/email typos) are caught", () => {
    expect(byId.get("D05")!.category).toBe("DUPLICATE");
    expect(byId.get("D06")!.category).toBe("DUPLICATE");
    expect(byId.get("D05")!.primaryId).toBe("D04");
  });

  it("ghost boundary: 91 days inactive is a ghost, 89 days is not", () => {
    expect(byId.get("G01")!.category).toBe("GHOST");
    expect(byId.get("C029")!.category).toBe("HEALTHY");
  });

  it("long-absent but active record is not a ghost", () => {
    expect(byId.get("C030")!.category).toBe("HEALTHY");
  });

  it("anomalies: malformed email, future date, negative count, missing email", () => {
    for (const id of ["A01", "A02", "A03", "A04"]) {
      expect(byId.get(id)!.category).toBe("ANOMALY");
      expect(byId.get(id)!.action).toBe("ARCHIVE");
      expect(byId.get(id)!.risk).toBe("HIGH");
    }
  });
});

describe("similarity", () => {
  it("is 1 for identical strings and lower for typos", () => {
    expect(similarity("john smith", "john smith")).toBe(1);
    expect(similarity("john smith", "jon smith")).toBeGreaterThan(0.85);
    expect(similarity("alice", "zachary")).toBeLessThan(0.5);
  });
});

describe("human approval gate", () => {
  const records = sampleRecords(NOW);
  const findings = detect(records, NOW);

  it("executes nothing when nothing is approved", () => {
    const decisions = new Map<string, Decision>();
    const result = executeCleanup(records, findings, decisions);
    expect(result.removed.length).toBe(0);
    expect(result.archived.length).toBe(0);
    expect(result.kept.length).toBe(45);
  });

  it("rejected findings stay untouched even when others are approved", () => {
    const decisions = new Map<string, Decision>();
    for (const f of findings) decisions.set(f.recordId, "approved");
    decisions.set("G01", "rejected");
    const result = executeCleanup(records, findings, decisions);
    expect(result.kept.some((r) => r.id === "G01")).toBe(true);
    expect(result.removed.some((r) => r.id === "G02")).toBe(true);
    // 4 merges + 4 remaining ghosts removed, 4 anomalies archived
    expect(result.removed.length).toBe(8);
    expect(result.archived.length).toBe(4);
    expect(result.reclaimedKb).toBeCloseTo(8 * 2.4);
  });
});
