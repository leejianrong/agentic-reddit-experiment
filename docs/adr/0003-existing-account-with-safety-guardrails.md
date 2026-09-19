# ADR-0003: Post from the existing personal Reddit account, behind conservative safety guardrails

- Status: **Superseded by [ADR-0010](0010-manual-publish.md)** for the
  guardrail mechanisms below — the app no longer writes to Reddit at all, so
  there's no automated publish path left to gate. The account choice itself
  (existing personal account, not a dedicated one) still stands. Kept as the
  historical record of why these mechanisms existed.
- Date: 2026-09-19
- Deciders: Jian

## Context

A dedicated bot account would isolate ban/shadowban risk, but Jian chose to
use his existing personal account (it already clears most subreddits' age and
karma minimums, and he accepted the reputational trade-off). That choice
raises the cost of any guardrail gap — a bad publish or a rate-limit violation
now risks a real, long-lived identity rather than a disposable one.

## Decision

Use the existing personal account, and compensate with mechanism, not policy:

- **Dry-run by default.** `DRY_RUN=true` short-circuits the actual Reddit
  write call and logs what would have been posted; live posting is an
  explicit opt-in per deployment.
- **Conservative default rate caps**, configurable but starting low (e.g. 3
  comments/day, 1 new post/3 days), enforced before any publish call.
- **Freshness recheck at publish time.** Immediately before calling Reddit's
  write endpoint, re-fetch the target thread to confirm it still exists, is
  unlocked, and has not already received a very similar reply — approval can
  be minutes to hours old by the time it's acted on.
- **A global kill switch** (config flag) that halts scanning and publishing
  without killing the process, for when something looks wrong mid-run.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Dedicated bot account (originally recommended) | Rejected by the user — he wants the existing account's standing, not a cold-start identity. |
| No extra guardrails, rely on the Telegram approval step alone | The approval step only vets content, not staleness or account-level pacing; the risks it doesn't cover (rate limits, stale threads) are exactly the ones that cause bans. |

## Consequences

- The soak period (Slice 1) runs entirely in dry-run mode before any live
  publish is allowed, which slows first real-world feedback but is the actual
  price of using a non-disposable account.
- Rate caps and dry-run are config, not code — recoverable if they turn out
  too conservative, without a redeploy.
- A guardrail bug (e.g. the freshness recheck silently no-op'ing) now has an
  irreversible cost against Jian's real account, so these paths need direct
  test coverage, not just the happy path.
