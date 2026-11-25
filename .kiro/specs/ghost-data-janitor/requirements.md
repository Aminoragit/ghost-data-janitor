# Requirements — Ghost Data Janitor

## User story
As a data-ops manager, I upload a customer CSV and want the system to
find duplicate, ghost and anomalous records, explain each finding in one
line, let me approve or reject every proposed action, and give me a
cleanup report — without any record changing before I approve.

## Acceptance criteria
1. CSV upload (drag/file input) AND one-click sample data (45 records:
   30 healthy, 6 duplicate, 5 ghost, 4 anomaly, incl. 89/91-day boundary).
2. Detection classifies every record as DUPLICATE / GHOST / ANOMALY /
   HEALTHY with a proposed action, a one-line reason and a risk level.
3. Nothing mutates before approval; per-row and bulk approve/reject.
4. Execute applies only APPROVED findings; report shows counts by type,
   estimated reclaimed storage, and a full audit log; report and cleaned
   CSV are downloadable.
5. Works fully offline in the browser with no API key. Deterministic
   rules decide every number; the narration layer only explains.
