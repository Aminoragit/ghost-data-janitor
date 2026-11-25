# Steering: Ghost Data Janitor — Cleanup Rules (fixed criteria)

These rules are the single source of truth for classification. The engine
must never invent thresholds; every number below is decided here, in
deterministic code — the narration layer only explains decisions.

## Classification (priority order: ANOMALY > DUPLICATE > GHOST > HEALTHY)
- ANOMALY: invalid email format, missing email/name, future last_login or
  created_at, negative login_count. Action: ARCHIVE. Risk: HIGH.
- DUPLICATE: same normalized email, same normalized phone, or fuzzy match
  (name similarity >= 0.85 AND email local-part similarity >= 0.7).
  The earliest created_at record in a group is the primary (KEEP);
  the rest are MERGE targets. Risk: MEDIUM.
- GHOST: days since last_login >= 90 AND status is inactive or dormant.
  Action: DELETE. Risk: MEDIUM. (89 days is NOT a ghost; 91 days is.
  A long-absent but still "active" record is NOT a ghost.)
- HEALTHY: everything else. Action: KEEP. Risk: LOW.

## Human approval gate (structural, not a prompt)
- Detection never mutates data. Execution is a separate function that
  refuses to run on any finding whose decision is not APPROVED.
- Rejected findings are reported as "kept by human decision".

## Audit
- Every detection run, approval, rejection and execution appends an
  audit-log entry with timestamp, actor and detail. The report download
  includes the full audit trail.

## Estimates
- Estimated row size: 2.4 KB per record. Reclaimed storage counts only
  records actually removed (DELETE + merged-away duplicates).
