# agentic-reddit-experiment

## Build status

SLICES.md V1 is implemented end to end, in dry-run: Reddit client (ADR-0005),
LibSQL app tables (ADR-0006), scoring/drafting via OpenRouter (ADR-0008,
prompt-based JSON parsing — not a native structured-outputs feature), the
Telegram approve/reject/edit adapter (ADR-0002), and both Mastra workflows
(scan-subreddits, draft-approval with suspend/resume per ADR-0001), wired
together in `src/mastra/index.ts` and booted from `src/index.ts`. Covered by
an integration test that runs the whole scan→draft→Telegram-approve→dry-run
loop against a real Mastra+LibSQL runtime with faked Reddit/Telegram/LLM.
Containerized (ADR-0007) and confirmed running in Docker.

Not yet done: live publishing (still forced to dry-run — flipping it on is
SLICES.md V2, and needs real Reddit/Telegram/OpenRouter credentials; Reddit
specifically is currently blocked on Reddit's Responsible Builder Policy
manual-review process, see README.md Setup step 1), new top-level posts
(V3), Slack (V4). Trust the code over this file, and trust `PLAN.md` /
`SLICES.md` over any assumption about what's built.

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
- `DRY_RUN=true` is the default and the safe state — this project posts from
  a real personal Reddit account (ADR-0003), so anything touching the
  publish path needs the freshness-recheck and rate-cap tests to actually
  fail when broken, not just the happy path.
- Read `PLAN.md` for scope/requirements, `docs/adr/*` for why a decision was
  made before revisiting it, and `QUESTIONS.md` for what was assumed vs.
  decided.
