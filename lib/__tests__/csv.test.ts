import { describe, expect, it } from "vitest";
import { parseCsv, recordsFromCsv, recordsToCsv } from "../csv";
import { sampleRecords } from "../sampleData";

describe("csv", () => {
  it("parses quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('a,"b,c","d""e"\n1,2,3');
    expect(rows[0]).toEqual(["a", "b,c", 'd"e']);
    expect(rows[1]).toEqual(["1", "2", "3"]);
  });

  it("round-trips sample records", () => {
    const records = sampleRecords(new Date("2026-11-25T00:00:00Z"));
    const back = recordsFromCsv(recordsToCsv(records));
    expect(back.length).toBe(records.length);
    expect(back[0]).toEqual(records[0]);
  });

  it("throws on a missing required column", () => {
    expect(() => recordsFromCsv("id,name\n1,x")).toThrow(/Missing required column/);
  });
});
