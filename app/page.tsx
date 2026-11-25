"use client";

import { useMemo, useRef, useState } from "react";
import { recordsFromCsv, recordsToCsv } from "@/lib/csv";
import { detect, RULES } from "@/lib/detect";
import { sampleCsv } from "@/lib/sampleData";
import { audit, buildReport, executeCleanup, type CleanupResult } from "@/lib/report";
import type { AuditEntry, DataRecord, Decision, Finding } from "@/lib/types";

function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [log, setLog] = useState<AuditEntry[]>([]);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const count = (c: string) => findings.filter((f) => f.category === c).length;
  const actionable = findings.filter((f) => f.action !== "KEEP");
  const pendingCount = actionable.filter(
    (f) => (decisions.get(f.recordId) ?? "pending") === "pending",
  ).length;
  const approvedCount = actionable.filter(
    (f) => decisions.get(f.recordId) === "approved",
  ).length;
  const potentialKb = Math.round(
    findings.filter((f) => f.action === "DELETE" || f.action === "MERGE").length *
      RULES.rowSizeKb *
      10,
  ) / 10;

  function runDetection(next: DataRecord[], source: string) {
    const found = detect(next);
    setRecords(next);
    setFindings(found);
    setDecisions(new Map());
    setResult(null);
    setReport("");
    setError("");
    setLog((prev) =>
      audit(
        prev,
        "engine",
        "detection",
        `${source}: scanned ${next.length} records — ${found.filter((f) => f.category === "DUPLICATE").length} duplicates, ${found.filter((f) => f.category === "GHOST").length} ghosts, ${found.filter((f) => f.category === "ANOMALY").length} anomalies. Nothing was modified.`,
      ),
    );
  }

  function loadSample() {
    try {
      runDetection(recordsFromCsv(sampleCsv()), "Sample data");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onFile(file: File) {
    try {
      runDetection(recordsFromCsv(await file.text()), `CSV upload (${file.name})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function decide(id: string, d: Decision) {
    setDecisions((prev) => new Map(prev).set(id, d));
    setLog((prev) =>
      audit(prev, "human", d === "approved" ? "approve" : "reject", `Record ${id} ${d}.`),
    );
  }

  function decideAll(d: Decision) {
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const f of actionable) next.set(f.recordId, d);
      return next;
    });
    setLog((prev) =>
      audit(prev, "human", d === "approved" ? "approve-all" : "reject-all",
        `${d === "approved" ? "Approved" : "Rejected"} all ${actionable.length} proposed actions.`),
    );
  }

  function execute() {
    const res = executeCleanup(records, findings, decisions);
    const nextLog = audit(
      log,
      "system",
      "execute",
      `Deleted ${res.counts.DELETE}, merged ${res.counts.MERGE}, archived ${res.counts.ARCHIVE}. ${res.kept.length} records remain; ~${res.reclaimedKb} KB reclaimed.`,
    );
    setLog(nextLog);
    setResult(res);
    setReport(buildReport({ total: records.length, findings, decisions, result: res, log: nextLog }));
  }

  return (
    <main>
      <h1>
        👻 Ghost Data <span className="ghost">Janitor</span>
      </h1>
      <p className="sub">
        Your database is haunted — by duplicate signups, accounts nobody has touched in
        years, and records that were never valid. The Janitor finds them, explains each
        one, and cleans <b>only what you approve</b>. Nothing changes before your say-so.
      </p>

      <div className="stats">
        <div className="stat"><b>{records.length}</b><span>records scanned</span></div>
        <div className="stat"><b>{count("GHOST")}</b><span>👻 ghosts</span></div>
        <div className="stat"><b>{count("DUPLICATE")}</b><span>duplicates</span></div>
        <div className="stat"><b>{count("ANOMALY")}</b><span>anomalies</span></div>
        <div className="stat"><b>{potentialKb} KB</b><span>reclaimable (est.)</span></div>
      </div>

      <section className="panel">
        <h2>1 · Feed the Janitor a CSV</h2>
        <div className="toolbar">
          <button className="primary" onClick={loadSample}>Load sample data (45 records)</button>
          <button onClick={() => fileRef.current?.click()}>Upload CSV…</button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <span className="hint">
            Columns: <code>id, name, email, phone, last_login, status, created_at, login_count</code>.
            Everything runs in your browser — no data leaves this page.
          </span>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {findings.length > 0 && (
        <section className="panel">
          <h2>2 · Cleanup plan — approve or reject every action</h2>
          <div className="toolbar">
            <button onClick={() => decideAll("approved")}>Approve all actions</button>
            <button onClick={() => decideAll("rejected")}>Reject all</button>
            <span className="spacer" />
            <span className="hint">
              {approvedCount} approved · {pendingCount} awaiting your decision
            </span>
            <button className="danger" disabled={approvedCount === 0} onClick={execute}>
              Execute approved cleanup
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Record</th><th>Type</th><th>Proposed action</th>
                <th>Why (the Janitor's note)</th><th>Risk</th><th>Your call</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => {
                const r = byId.get(f.recordId)!;
                const d = decisions.get(f.recordId) ?? "pending";
                return (
                  <tr key={f.recordId}>
                    <td>
                      <b>{r.id}</b> {r.name}
                      <br /><span className="reason">{r.email || "—"}</span>
                    </td>
                    <td><span className={`badge ${f.category}`}>{f.category}</span></td>
                    <td>{f.action}{f.primaryId && f.action === "MERGE" ? ` → ${f.primaryId}` : ""}</td>
                    <td className="reason">{f.reason}</td>
                    <td className={`risk-${f.risk}`}>{f.risk}</td>
                    <td>
                      {f.action === "KEEP" ? (
                        <span className="hint">no action needed</span>
                      ) : (
                        <span className="rowbtns">
                          <button onClick={() => decide(f.recordId, "approved")}>Approve</button>
                          <button onClick={() => decide(f.recordId, "rejected")}>Reject</button>
                          <span className={d}>{d}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {result && (
        <section className="panel">
          <h2>3 · Cleanup report</h2>
          <p>
            Deleted {result.counts.DELETE} · Merged {result.counts.MERGE} · Archived{" "}
            {result.counts.ARCHIVE} · {result.kept.length} records remain · ~
            {result.reclaimedKb} KB reclaimed.
          </p>
          <div className="toolbar">
            <button onClick={() => download("ghost-data-janitor-report.md", report, "text/markdown")}>
              Download report (Markdown)
            </button>
            <button onClick={() => download("cleaned-data.csv", recordsToCsv(result.kept), "text/csv")}>
              Download cleaned CSV
            </button>
          </div>
          <pre className="report">{report}</pre>
        </section>
      )}
    </main>
  );
}
