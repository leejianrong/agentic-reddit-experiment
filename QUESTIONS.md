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
| Q2 | Which Reddit account posts/comments — a new dedicated account or the existing personal one? | DECIDED — **partly moot**: the app never posts at all now (ADR-0010), so this only matters for whichever account Jian manually posts from | Existing personal account (against recommendation; risk noted) | ADR-0003 |
| Q3 | Should posts/comments carry a blanket AI-disclosure? | DECIDED | No blanket disclosure; per-subreddit compliance check instead | ADR-0004 |
| Q4 | Should v1 support new top-level posts, or comments only first? | DECIDED, **corrected** | Originally "both from v1," but the implementation only ever produced comment opportunities (`scan.ts` hardcodes `kind: 'comment'`) — PLAN.md's scope now matches that reality: comments only for v1 | PLAN §Scope |
| Q4a | Is self-promotion in scope for v1 content? | DECIDED (user clarification, mid-session) | No — v1 is strictly non-promotional, expert-presence content; self-promotion is a deliberate, subtle, later addition | PLAN §Problem, §Scope, §Shape S2 |
| Q5 | Which LLM powers drafting/scoring? | DECIDED (superseded the earlier ASSUMED default) | OpenRouter (cheap open-weight models — DeepSeek by default, swappable per-model in config) | ADR-0008 |
| Q6 | Where does app state live relative to Mastra's own workflow storage? | ASSUMED | One shared LibSQL database | ADR-0006 |
| Q7 | Which Reddit API client library (official API)? | ASSUMED | Custom thin REST client (fetch + zod), not snoowrap | ADR-0005 |
| Q8 | How are the scan loop and Telegram bot triggered — webhook/server or polling? | ASSUMED, **corrected** | Plain `setInterval` scan loop (not node-cron, not Mastra's native `schedule` field — see PLAN Open risks history) + Telegram long-polling; no public server | PLAN §Assumed defaults |
| Q9 | What is the actual starter subreddit list, and are per-subreddit rules captured anywhere? | ASSUMED | Seed list in an editable config file; Jian edits it directly | PLAN §Scope |
| Q10 | What are the default safety rate caps and dry-run posture? | **Superseded by ADR-0010** | Moot — there is no automated write path to gate | n/a |
| Q11 | How are concurrent writers / stale approvals handled? | ASSUMED, **corrected** | Single approver; freshness check is advisory only now (Jian is the one physically posting, so he's the final check) | ADR-0010 |
| Q12 | What is the canonical identity for opportunities/dedup? | ASSUMED | Reddit fullname IDs (`t3_`/`t1_`) | PLAN §Assumed defaults |
| Q13 | What happens on Reddit/Telegram/LLM API failure? | ASSUMED, **corrected** | Log and skip; no automated retry of anything Reddit-facing | PLAN §Assumed defaults |
| Q14 | Where does this run — local machine, VPS, containers? | DECIDED (superseded the earlier ASSUMED default) | Containerized (Docker); target is an always-on DigitalOcean droplet | ADR-0007, PLAN §Assumed defaults |
| Q15 | How do we know v1 actually works? | ASSUMED, **corrected** | Every `ready-to-post` outcome traces to an explicit Approve action (auditable), scan cycle under ~2 min, no duplicate prompts for the same thread | PLAN §Assumed defaults |
| Q16 | How are secrets handled? | ASSUMED | `.env` + gitignore; audit log stores content/IDs, never credentials | PLAN §Assumed defaults |
| Q17 | Is config/schema versioning needed now? | DEFERRED | v1 schema is small; revisit if a real shape change is needed | n/a |
| Q18 | Should the agent ever publish without human approval? | DECIDED (explicit, not a default) | No, permanently — the approval gate is not training wheels. Superseded upward by ADR-0010: the agent never publishes at all, approved or not | PLAN §Scope, ADR-0010 |
| Q19 | Should the agent reply to replies on its own comments? | DEFERRED | Out of scope for v1; additive later | n/a |
| Q20 | Multi-account support, karma optimization, analytics dashboards? | DEFERRED | Out of scope for v1; additive later | n/a |
| Q21 | Who is the primary actor/approver, and who wins on conflict? | ASSUMED (directly derived from the idea) | Jian is sole approver; the agent never overrides a rejection | PLAN §Users and actors |
| Q22 | Given Reddit's Responsible Builder Policy blocks new OAuth app registration, how does the agent read Reddit at all? | DECIDED (user wanted to unblock immediately, mid-session) | Self-hosted Redlib instance (RSS feeds) by default, no credentials needed; official OAuth API remains an optional, better-reliability alternative when available | ADR-0009 |
| Q23 | Given Reddit write access is blocked, should the app automate publishing once/if access arrives, or stay manual permanently? | DECIDED (user chose manual, mid-session) | Manual, permanently — Jian copy-pastes the approved draft into Reddit himself; the app never calls Reddit's write API, not even later | ADR-0010 |

## Coverage

| Category | Covered by |
|----------|-----------|
| Primary user and actors | Q21 |
| Scope boundary | Q4, Q4a, Q9, Q18, Q19, Q20, Q23 |
| Data model and identity | Q12 |
| State and storage | Q6 |
| Concurrency and conflict | Q11 |
| Interfaces and contracts | Q1, Q8 |
| Failure behaviour | Q13 |
| External dependencies | Q5, Q7, Q22 |
| Runtime and deployment | Q14 |
| Measurable success | Q15 |
| Security and secrets | Q16, Q2 (account risk) |
| Versioning and migration | Q17 |
