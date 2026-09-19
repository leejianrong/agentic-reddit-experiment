# ADR-0002: Telegram as the draft-approval channel

- Status: Accepted
- Date: 2026-09-19
- Deciders: Jian

## Context

Drafts need to reach a single approver (Jian) with enough interactivity to
approve, edit, or reject in one exchange. The idea named Telegram or Slack as
candidates.

## Decision

Use Telegram, via long-polling (`getUpdates`), not a webhook. A draft is sent
as a message with an inline keyboard (Approve / Reject); an edit is a plain
text reply to that message, matched back to the pending draft by Telegram's
reply-to-message-id.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Slack | Needs a workspace + app install, and Block Kit interactions typically expect a reachable HTTPS endpoint — more infrastructure for a single-approver tool with no other Slack use here. |
| Both Telegram and Slack | Two adapters to build, test, and keep behaviourally identical for one user approving from one place. Revisit only if a second approver or workspace need shows up. |
| Webhook-based Telegram | Requires a public HTTPS endpoint (TLS cert, reachable host); polling needs none of that and this tool has no other reason to run a server. |

## Consequences

- No public endpoint, TLS, or reverse proxy needed — the whole tool can run as
  a single long-lived process on a laptop or a small VPS.
- Slack becomes a later, additive adapter (R8, deferred) behind the same
  resume-triggering interface, not a rewrite.
- Telegram's polling loop and the Reddit scan loop both live in the same
  process; either one crashing without a supervisor takes both down (see
  Runtime in PLAN.md).
