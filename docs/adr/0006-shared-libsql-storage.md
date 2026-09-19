# ADR-0006: One shared LibSQL database for Mastra snapshots and app state

- Status: Accepted
- Date: 2026-09-19
- Deciders: Jian (assumed default, not user-escalated)

## Context

Mastra persists workflow suspend/resume snapshots to LibSQL (SQLite-compatible)
by default. The app also needs its own tables: subreddit config, the
seen-items dedup ledger, opportunities, drafts, and the posting audit log.
This is a single-user tool with modest write volume.

## Decision

Use one LibSQL database file for both Mastra's workflow snapshots and the
app's own tables, rather than standing up a second database.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Separate Postgres for app tables | Adds an operational dependency (a server to run and back up) with no volume or concurrency need that justifies it for one user. |
| Plain JSON files for app state | Fine for config, but the seen-items ledger and audit log need queryability (dedup lookups, "what's pending" views) that flat files make awkward. |

## Consequences

- One file to back up, inspect, and reset during development.
- Ties app-state storage to whatever Mastra uses internally; if Mastra changes
  its default storage engine, both the workflow snapshots and the app tables
  move together, which is a single migration rather than two.
