# ADR-0001: Use Mastra's suspend/resume workflow primitive as the approval gate

- Status: Accepted
- Date: 2026-09-19
- Deciders: Jian

## Context

Every candidate post/comment must pause for human review on Telegram, possibly
for hours, and resume exactly where it left off — with the human's approval,
edit, or rejection — even if the process restarts in between. This needs
durable pause/resume state, not an in-memory callback.

Mastra ships this natively: a workflow step can call `suspend(payload)`, which
persists a snapshot (run id, step status, suspend payload) to storage — LibSQL
by default, swappable for Postgres/Upstash. `resume(runId, resumeData)` reads
that snapshot back and continues the step. This is the exact shape of
"draft → wait for Telegram action → continue."

## Decision

Model each identified opportunity as its own Mastra workflow run:
1. A draft step generates the post/comment text and calls `suspend()` with the
   draft as the payload.
2. The Telegram adapter reads the payload and sends it as a message with
   Approve/Edit/Reject actions.
3. A Telegram action calls `resume(runId, { action, text? })`.
4. The workflow branches: `approve` → publish step; `edit` → loop back to the
   draft step with the human's text and suspend again; `reject` → end.

Workflow snapshots persist to the same LibSQL database used for the app's own
tables (ADR-0006), so a process restart mid-review loses nothing.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Hand-rolled state machine + own polling table | Mastra already solves exactly this; reinventing it duplicates a well-tested mechanism for no gain. |
| In-memory callback held until Telegram replies | Does not survive a process restart — an approval received while the process is down would be silently lost. |
| Queue-based (e.g. a message queue holding pending approvals) | Adds an operational dependency (broker) this single-user tool does not need; Mastra's snapshot storage already gives durability. |

## Consequences

- Every pending draft is inspectable as a suspended workflow run, which
  doubles as the audit trail for "what's awaiting my review right now."
- Couples the project to Mastra's workflow/storage model; migrating off Mastra
  later means re-implementing this pause/resume mechanism from scratch.
- Multi-step approvals (edit loops) require resuming the same step repeatedly
  with fresh `resumeData` each time — the edit branch must re-enter the draft
  step rather than mutate state out of band.
