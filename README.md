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
cp .env.example .env
git config core.hooksPath .githooks
npm run check
```

Then fill in `.env`:

1. Create a Reddit **script** app at <https://reddit.com/prefs/apps> (on the
   account the bot should post as) and set `REDDIT_CLIENT_ID` /
   `REDDIT_CLIENT_SECRET` from it, plus a `REDDIT_USER_AGENT`.
2. Run `npm run reddit:authorize` — it prints a URL to open in your browser,
   then prints a `REDDIT_REFRESH_TOKEN` to paste into `.env` once you approve.
3. Run `npm run reddit:smoke-test` to confirm read access works (add
   `-- --write` once you're ready to confirm a real throwaway comment posts
   to r/test).
4. Fill in `TELEGRAM_BOT_TOKEN` (via [@BotFather](https://t.me/BotFather)),
   `TELEGRAM_CHAT_ID`, and `ANTHROPIC_API_KEY`.

## Running in a container

Target deployment is an always-on host (e.g. a DigitalOcean droplet) via
Docker Compose (ADR-0007). The database file lives on the host at `./data`,
outside the container, so it survives rebuilds.

```sh
cp .env.example .env   # fill in credentials on the host
docker compose up -d --build
docker compose logs -f
```
