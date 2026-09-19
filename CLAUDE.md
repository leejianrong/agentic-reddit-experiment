# agentic-reddit-experiment

## Build status

SLICES.md V1 is implemented end to end: Reddit reads via Redlib by default
(ADR-0009, no credentials needed) or the official API when configured
(ADR-0005), LibSQL app tables (ADR-0006), scoring/drafting via OpenRouter
(ADR-0008, prompt-based JSON parsing — not a native structured-outputs
feature), the Telegram approve/reject/edit adapter (ADR-0002), and both
Mastra workflows (scan-subreddits, draft-approval with suspend/resume per
ADR-0001), wired together in `src/mastra/index.ts` and booted from
`src/index.ts`. Publishing is permanently manual (ADR-0010) — the app never
calls Reddit's write API; on approval it hands the final text back to
Telegram for the human to post. Covered by an integration test that runs the
whole scan→draft→Telegram-approve→finalize loop against a real Mastra+LibSQL
runtime with faked Reddit/Telegram/LLM. Containerized (ADR-0007), including
a self-hosted Redlib service in `docker-compose.yml`, and confirmed running.

Not yet done: Slack as an additional approval channel (SLICES.md V2). New
top-level posts and any form of automated Reddit writing are permanently out
of scope (ADR-0010), not just deferred. Trust the code over this file, and
trust `PLAN.md` / `SLICES.md` over any assumption about what's built.

## Commands

- `npm ci` — install (frozen, matches CI)
- `npm run check` — lint + typecheck + unit tests; run before every push
- `npm test` — unit tests only (no infra, fast)
- `npm run test:integration` — heavier tests once there's infra to test against
- `npm run build` — compile to `dist/`
- `npm run lint:fix` — Biome auto-fix

Install the pre-push gate once per clone: `git config core.hooksPath .githooks`

## Conventions

- One branch per slice off `main`, PR-only, merge after CI is green. No
  direct pushes to `main`.
- Secrets live in `.env` (see `.env.example` for the required keys), never in
  git. Nothing in the audit log ever holds a credential.
- The app never calls Reddit's write API, period (ADR-0010) — don't wire
  `RedditClient.submitComment`/`submitPost` into the workflow without a
  fresh, deliberate ADR revisiting that decision; they exist, tested, but
  unused, on purpose.
- Read `PLAN.md` for scope/requirements, `docs/adr/*` for why a decision was
  made before revisiting it, and `QUESTIONS.md` for what was assumed vs.
  decided.
