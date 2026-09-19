# agentic-reddit-experiment

A [Mastra](https://mastra.ai) agent that scans selected technical subreddits
(Python, ML, data visualization, AI, agentic workflows, LLMs) for genuine
opportunities to be helpful and drafts a comment, sending it to Telegram for
review. You approve, edit, or reject each draft; once approved, the agent
hands the final text back to you to post yourself — it never posts to Reddit
on its own (ADR-0010).

See [`PLAN.md`](./PLAN.md) for the problem/scope/requirements,
[`docs/adr/`](./docs/adr/) for the architectural decisions and why they were
made, and [`SLICES.md`](./SLICES.md) for the build plan.

## Status

See [`CLAUDE.md`](./CLAUDE.md) for exact build status and commands.

## Setup

```sh
npm ci
cp .env.example .env
git config core.hooksPath .githooks
npm run check
```

Then fill in `.env`:

1. **Reddit read access** — pick one (ADR-0009):
   - **Redlib (default, no setup):** running via Docker (see below) already
     gives you this — leave `REDDIT_*` blank and `REDLIB_URL` gets set
     automatically to the self-hosted instance. Running outside Docker?
     Point `REDLIB_URL` at any Redlib instance.
   - **Official Reddit API (optional, better reliability):** create a
     Reddit **script** app at <https://reddit.com/prefs/apps>. As of late
     2025 this is gated behind Reddit's [Responsible Builder
     Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy)
     and may require manual review — not required to use this project at
     all, just an upgrade path if you get access. Set **redirect uri** to
     exactly `http://localhost:8765/callback` and leave **about url**
     blank, then run `npm run reddit:authorize` (prints a URL to open, then
     a `REDDIT_REFRESH_TOKEN` to paste into `.env`) and
     `npm run reddit:smoke-test` to confirm it works.
2. Fill in `TELEGRAM_BOT_TOKEN` (via [@BotFather](https://t.me/BotFather)),
   `TELEGRAM_CHAT_ID`, and `OPENROUTER_API_KEY` (from
   [openrouter.ai/keys](https://openrouter.ai/keys) — ADR-0008).

**Publishing is manual.** Once you approve a draft on Telegram, you get the
final text back to copy into Reddit yourself — the agent has no Reddit
write credentials and never calls Reddit's write API (ADR-0010).

## Running in a container

Target deployment is an always-on host (e.g. a DigitalOcean droplet) via
Docker Compose (ADR-0007), which also runs a self-hosted Redlib instance
(ADR-0009) for you. The database file lives on the host at `./data`, outside
the container, so it survives rebuilds.

```sh
cp .env.example .env   # fill in Telegram/OpenRouter credentials
docker compose up -d --build
docker compose logs -f
```
