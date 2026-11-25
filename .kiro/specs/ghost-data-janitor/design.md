# Design — Ghost Data Janitor

## Architecture (all client-side, static export)
- `lib/csv.ts` — small RFC-4180-style CSV parser/serializer (quotes,
  commas, CRLF). No dependency, fully testable.
- `lib/detect.ts` — deterministic rule engine. Normalizers (email
  lowercase/trim, phone digits-only, name lowercase), Levenshtein-based
  similarity for fuzzy duplicates, group-aware duplicate resolution
  (earliest created_at = primary). Pure functions, injected `now` for
  testability.
- `lib/sampleData.ts` — generates the 45-record demo CSV relative to
  "today" so the 89/91-day boundary cases never rot.
- `lib/report.ts` — execution (pure: records + decisions -> result),
  summary counts, storage estimate, audit log, Markdown report builder.
- `app/page.tsx` — single dashboard: header stats, upload/sample,
  findings table with badges + approve/reject, execute, report panel.

## Data model
Record: id, name, email, phone, last_login, status, created_at,
login_count. Finding: recordId, category, action, reason, risk,
groupId?. Decision: 'pending' | 'approved' | 'rejected'.

## Safety design
`executeCleanup` throws if asked to apply a non-approved finding —
the human gate is enforced in code, not in UI state alone.
