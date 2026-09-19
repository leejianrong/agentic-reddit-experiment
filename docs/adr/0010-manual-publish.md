# ADR-0010: Publishing is a manual human action — the app never writes to Reddit

- Status: Accepted
- Date: 2026-09-19
- Deciders: Jian

## Context

Reddit's official OAuth API — the only sanctioned way to post/comment
programmatically — is blocked behind manual review (ADR-0009's context).
Jian is fine with copy-pasting the final, approved draft from Telegram into
Reddit himself, as the human, rather than waiting for API access or
automating the write side at all.

## Decision

The draft-approval workflow's final step (renamed `finalize`, was
`publish`) never calls Reddit's write API. Once a draft is approved, it:

1. Runs a best-effort staleness check via `RedditReadClient.getThreadState`
   when the configured read source supports it (the official API does,
   Redlib does not — ADR-0009), surfaced as a non-blocking `warning`.
2. Records the outcome (`ready-to-post` or `rejected`) in the
   `draft_outcomes` table.
3. Sends the final approved text back to Telegram for Jian to paste into
   Reddit himself.

The app therefore never needs Reddit *write* scope, full stop — not just
for now. `RedditClient.submitComment`/`submitPost` (ADR-0005) stay in the
codebase, tested and unused, in case automated publishing is deliberately
revisited later; nothing currently calls them.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Wait for official API approval, keep automated publishing | Rejected by Jian — he wants to use the tool now, and manual posting is a fully acceptable permanent workflow for him, not just a stopgap. |
| Automate posting via a real logged-in browser session (bypassing the OAuth API entirely) | Explicitly against Reddit's User Agreement, with real ban risk to Jian's actual account — considered and declined earlier in this same conversation, independent of the API-access question. |
| Keep DRY_RUN/rate-cap gating from the original automated-publish design (ADR-0003), just never flip DRY_RUN off | Those mechanisms existed specifically to gate an *automated* write path. With no write path at all, they're dead weight — simpler to remove them than to keep unused machinery "just in case." Superseded, see ADR-0003. |

## Consequences

- Removes `DRY_RUN`, `RATE_CAP_COMMENTS_PER_DAY`, and
  `RATE_CAP_POST_EVERY_DAYS` from config entirely — there is no automated
  write path left to gate. `SLICES.md` V2's original framing ("go live on
  comments" by flipping `DRY_RUN` off) no longer applies; the project's
  ceiling for now is identify → draft → approve → hand off for manual
  posting.
- The freshness check is now advisory only (a warning, not a gate) — the
  human decides whether to actually post, same as they'd notice a locked
  thread themselves when pasting the comment in.
- This is reversible: if official API access is ever approved and Jian
  wants automated publishing back, `RedditClient`'s write methods already
  exist and are tested — reintroducing a publish-gating design (dry-run,
  rate caps) would be a fresh, deliberate decision at that point, not a
  half-finished leftover from this one.
