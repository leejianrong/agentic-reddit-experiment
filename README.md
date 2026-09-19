# agentic-reddit-experiment

A [Mastra](https://mastra.ai) agent that scans selected technical subreddits
(Python, ML, data visualization, AI, agentic workflows, LLMs) for genuine
opportunities to be helpful, drafts a post or comment, and sends it to
Telegram for review. Nothing is ever published to Reddit without an explicit
human approval of that exact text.

See [`PLAN.md`](./PLAN.md) for the problem/scope/requirements,
[`docs/adr/`](./docs/adr/) for the architectural decisions and why they were
made, and [`SLICES.md`](./SLICES.md) for the build plan.

## Status

Early scaffold — see [`CLAUDE.md`](./CLAUDE.md) for exact build status and
commands.

## Setup

```sh
npm ci
cp .env.example .env   # fill in Reddit/Telegram/Anthropic credentials
git config core.hooksPath .githooks
npm run check
```
