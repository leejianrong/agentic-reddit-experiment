# Questions

Statuses: `DECIDED` (user answered) · `ASSUMED` (default taken, correct it if
wrong) · `FORK` (waiting on the user) · `DEFERRED` (not needed this
milestone).

## Open forks

*(empty — round closed)*

## Register

| ID | Question | Status | Answer or default | Landed |
|----|----------|--------|--------------------|--------|
| Q1 | Which chat platform handles draft review/approval — Telegram, Slack, or both? | DECIDED | Telegram | ADR-0002 |
| Q2 | Which Reddit account posts/comments — a new dedicated account or the existing personal one? | DECIDED | Existing personal account (against recommendation; risk noted) | ADR-0003 |
| Q3 | Should posts/comments carry a blanket AI-disclosure? | DECIDED | No blanket disclosure; per-subreddit compliance check instead | ADR-0004 |
| Q4 | Should v1 support new top-level posts, or comments only first? | DECIDED | Both posts and comments from v1 | PLAN §Scope, SLICES V2/V3 |
| Q4a | Is self-promotion in scope for v1 content? | DECIDED (user clarification, mid-session) | No — v1 is strictly non-promotional, expert-presence content; self-promotion is a deliberate, subtle, later addition | PLAN §Problem, §Scope, §Shape S2 |
| Q5 | Which LLM powers drafting/scoring? | DECIDED (superseded the earlier ASSUMED default) | OpenRouter (cheap open-weight models — DeepSeek by default, swappable per-model in config) | ADR-0008 |
| Q6 | Where does app state live relative to Mastra's own workflow storage? | ASSUMED | One shared LibSQL database | ADR-0006 |
| Q7 | Which Reddit API client library? | ASSUMED | Custom thin REST client (fetch + zod), not snoowrap | ADR-0005 |
| Q8 | How are the scan loop and Telegram bot triggered — webhook/server or polling? | ASSUMED | node-cron scan scheduler + Telegram long-polling; no public server | PLAN §Assumed defaults |
| Q9 | What is the actual starter subreddit list, and are per-subreddit rules captured anywhere? | ASSUMED | Seed list in an editable config file, including per-subreddit content-type/AI-assistance/post-frequency/flair rules; Jian edits it directly | PLAN §Scope, SLICES V1/V3 |
| Q10 | What are the default safety rate caps and dry-run posture? | ASSUMED | Conservative defaults (e.g. 3 comments/day, 1 post/3 days), `DRY_RUN=true` until explicitly turned off | ADR-0003 |
| Q11 | How are concurrent writers / stale approvals handled? | ASSUMED | Single approver, no multi-writer conflict; freshness recheck at publish time is the only staleness guard needed | PLAN §Assumed defaults |
| Q12 | What is the canonical identity for opportunities/dedup? | ASSUMED | Reddit fullname IDs (`t3_`/`t1_`) | PLAN §Assumed defaults |
| Q13 | What happens on Reddit/Telegram/LLM API failure? | ASSUMED | Log and skip; at most one safe retry for transient network errors; never a silent duplicate publish | PLAN §Assumed defaults, SLICES V2 |
| Q14 | Where does this run — local machine, VPS, containers? | DECIDED (superseded the earlier ASSUMED default) | Containerized (Docker); target is an always-on DigitalOcean droplet | ADR-0007, PLAN §Assumed defaults |
| Q15 | How do we know v1 actually works? | ASSUMED | 100% approval-gated publishes (auditable), scan cycle under ~2 min for the starter list, no duplicate prompts for the same thread | PLAN §Assumed defaults |
| Q16 | How are secrets handled? | ASSUMED | `.env` + gitignore; audit log stores content/IDs, never credentials | PLAN §Assumed defaults |
| Q17 | Is config/schema versioning needed now? | DEFERRED | v1 schema is small; revisit if a real shape change is needed | n/a |
| Q18 | Should the agent ever publish without human approval? | DECIDED (explicit, not a default) | No, permanently — the approval gate is not training wheels | PLAN §Scope |
| Q19 | Should the agent reply to replies on its own comments? | DEFERRED | Out of scope for v1; additive later | n/a |
| Q20 | Multi-account support, karma optimization, analytics dashboards? | DEFERRED | Out of scope for v1; additive later | n/a |
| Q21 | Who is the primary actor/approver, and who wins on conflict? | ASSUMED (directly derived from the idea) | Jian is sole approver; the agent never overrides a rejection | PLAN §Users and actors |

## Coverage

| Category | Covered by |
|----------|-----------|
| Primary user and actors | Q21 |
| Scope boundary | Q4, Q4a, Q9, Q18, Q19, Q20 |
| Data model and identity | Q12 |
| State and storage | Q6 |
| Concurrency and conflict | Q11 |
| Interfaces and contracts | Q1, Q8 |
| Failure behaviour | Q13 |
| External dependencies | Q5, Q7 |
| Runtime and deployment | Q14 |
| Measurable success | Q15 |
| Security and secrets | Q16, Q2 (account risk) |
| Versioning and migration | Q17 |
