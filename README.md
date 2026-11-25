# 👻 Ghost Data Janitor

**Hunt the ghost data haunting your database.**

Every customer database is haunted: the same person signed up three times,
accounts nobody has logged into for a year still sit in the "active" table,
and a few records were never valid to begin with. Ghost Data Janitor scans a
customer CSV, classifies every record as **DUPLICATE**, **GHOST**,
**ANOMALY** or **HEALTHY**, proposes a cleanup action with a one-line reason
and a risk level — and then does **nothing** until a human approves each
action.

## Inspiration

Six years of data-management work teaches you one thing: databases don't
get dirty in dramatic ways, they get dirty quietly — one duplicate signup,
one abandoned account at a time — until reporting, billing and ML features
are all built on haunted data. Existing dedup tools either auto-delete
(scary) or produce a spreadsheet someone has to eyeball (slow). The missing
product is an agent that *proposes* like an analyst and *waits* like a
janitor: plan first, human approval second, execution last.

## What it does

1. **Upload** a customer CSV (or load the built-in 45-record sample:
   30 healthy, 6 duplicates, 5 ghosts, 4 anomalies — including deliberate
   89-day / 91-day boundary cases).
2. **Detect** — a deterministic rule engine classifies every record:
   - *DUPLICATE*: same normalized email, same phone, or fuzzy match
     (name similarity ≥ 0.85 and email local-part ≥ 0.7, Levenshtein-based).
     The oldest record in each group survives; the rest merge into it.
   - *GHOST*: no login for ≥ 90 days **and** status `inactive`/`dormant`.
   - *ANOMALY*: malformed/missing email, future dates, negative counters.
   - *HEALTHY*: everything else — including a record idle 200 days that is
     still marked active (long absence alone is not haunting).
3. **Approve / reject** per record or in bulk. Pending and rejected
   findings are structurally impossible to execute (see below).
4. **Execute + report** — counts by type, estimated storage reclaimed
   (records removed × 2.4 KB), a full audit log, and downloads for the
   Markdown report and the cleaned CSV.

## How we built it

- **Next.js 16 + TypeScript**, fully client-side, static export — no
  server, no API key, no data ever leaves the browser.
- **The numbers are decided by deterministic code, never by a model.**
  `lib/detect.ts` is a pure rule engine with an injected clock; the
  "Janitor's notes" only *explain* decisions the rules already made.
  Thresholds live in one place (`.kiro/steering/cleanup-rules.md`).
- **The human gate is structural, not a prompt.** `executeCleanup()`
  skips anything not explicitly `approved`, and the test suite proves
  that zero approvals ⇒ zero mutations and rejected records stay
  untouched even when everything else is approved.
- **Audit everything.** Detection, every approval/rejection, and the
  execution append timestamped entries that ship inside the report.
- **Built spec-first with Kiro.** Requirements → design → tasks live in
  `.kiro/specs/ghost-data-janitor/`; steering files pin the product
  framing and the cleanup rules so every generated change follows the
  same criteria.

## Challenges we ran into

- **Fuzzy duplicates without false merges.** Email-only matching misses
  typo signups ("Jon Smith" / "john.smyth@…"); name-only matching merges
  strangers. Requiring *both* name and email-local similarity above
  separate thresholds caught the typo group while keeping same-name
  strangers apart — verified by dedicated tests.
- **Boundary honesty.** A 90-day ghost rule is only credible if 89 days
  survives and 91 days doesn't. The sample data is generated relative to
  *today*, so the boundary cases can't silently rot as the calendar moves.
- **Keeping the demo failure-proof.** No external API is on the critical
  path: if a future LLM narration layer is added, the rule engine still
  produces the full plan on its own.

## Accomplishments that we're proud of

- 13 automated tests covering classification counts, merge primaries,
  both ghost boundaries, anomaly classes, CSV round-trip and the
  approval gate.
- A complete loop — upload → detect → approve → execute → audited
  report — in a single static page that runs offline.

## What we learned

Data-cleaning tools fail on trust, not detection. Making the approval
gate a property of the execution function (not of the UI) and showing
the audit log turned "an AI that deletes your data" into "a plan you
signed off on" — the constraint became the product.

## What's next

- Optional LLM narration layer for richer explanations (rules still
  decide; the model only talks).
- Scheduled scans against a live CRM export, with diff-only plans.
- Per-column PII redaction in reports for compliance reviews.

## Built With

- Kiro (spec-driven development: specs + steering in `.kiro/`)
- Next.js 16, React 19, TypeScript
- Vitest (13 tests)
- Zero runtime dependencies beyond React/Next — CSV parsing and the
  detection engine are hand-rolled and fully tested

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # detection engine + CSV + approval-gate tests
npm run build      # static export in out/
```

## Demo flow (2–3 min)

1. (0:00) The problem: haunted databases, quiet data rot.
2. (0:20) Load sample data → run detection.
3. (1:00) Walk the plan: duplicate groups, the 91-day ghost vs the
   89-day survivor, the future-dated anomaly — each with its reason.
4. (1:50) Reject one ghost (it stays!), approve the rest, execute,
   download the report and cleaned CSV.
5. (2:30) Show `.kiro/specs/` — the spec-driven build — and close.
