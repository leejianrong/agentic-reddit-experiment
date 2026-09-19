# agentic-reddit-experiment

## Build status

Scaffold only. No Reddit client, Telegram adapter, scan workflow, or approval
workflow exists yet — just project tooling (`src/config.ts` is the one real
piece: env loading/validation). Trust the code over this file, and trust
`PLAN.md` / `SLICES.md` over any assumption about what's built. Start at
`SLICES.md` V1 for what's next.

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
