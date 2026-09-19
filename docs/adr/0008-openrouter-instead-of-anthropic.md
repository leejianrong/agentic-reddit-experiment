# ADR-0008: Use OpenRouter instead of the Anthropic API directly

- Status: Accepted
- Date: 2026-09-19
- Deciders: Jian

## Context

The original assumed default (PLAN.md Q5) was Claude via the Anthropic API,
chosen for its native structured-outputs feature (`messages.parse` +
`zodOutputFormat`), which made the relevance-scoring step's JSON output
reliable by construction. Jian wants to run this on cheap open-weight models
instead — DeepSeek, GLM, MiniMax, or whatever is currently cheapest and good
enough — routed through OpenRouter rather than committing to one provider's
direct API.

## Decision

Replace the Anthropic SDK with a thin custom client (`src/llm/client.ts`,
`OpenRouterClient`) against OpenRouter's OpenAI-compatible chat completions
endpoint, consistent with this project's existing pattern for Reddit and
Telegram (ADR-0005): a small `fetch`-based client behind a `LlmClient`
interface, model selection is just a string (`SCORING_MODEL` /
`DRAFTING_MODEL`, e.g. `deepseek/deepseek-v4-flash`), swappable per-call via
config with no code change.

Since arbitrary OpenRouter-routed models don't uniformly support native
structured outputs the way Claude's Messages API does, the relevance-scoring
step (`src/llm/score.ts`) drops `zodOutputFormat` in favor of prompt
instructions ("reply with ONLY a JSON object") plus a permissive extractor
(`src/llm/json.ts`) that strips markdown code fences or stray prose before
parsing, validated against the same zod schema as before. A response that
still fails to parse is treated as "not relevant" (the same safe default the
original implementation used for a missing `parsed_output`).

## Alternatives considered

| Option | Why not |
|--------|---------|
| Keep Anthropic direct, add OpenRouter as an alternative | Doubles the LLM client surface for no real benefit — OpenRouter already fronts Anthropic's models too, if Jian ever wants them back it's just a model-string change. |
| Use the `openai` npm package pointed at OpenRouter's base URL | OpenRouter's actually-used surface here is one endpoint (chat completions); a full SDK dependency isn't proportionate, and it doesn't match this project's established thin-client pattern (ADR-0005). |
| Rely on `response_format: json_object` / `json_schema` on the request | Support varies by which underlying provider OpenRouter routes a given model to, and an unsupported param can hard-error some providers rather than being ignored. Prompt instructions + a lenient parser degrade gracefully everywhere instead. |

## Consequences

- Scoring reliability is now probabilistic (a lenient parser catching most
  formatting variance) rather than guaranteed by the API. The two known
  failure modes — no JSON found, or JSON that fails the zod schema — both
  resolve to "not relevant," which is the safe direction to fail in (a
  missed opportunity, not a bad publish).
- Model choice is now a pure config string, not a code change — swapping
  DeepSeek for GLM or MiniMax, or using different models for scoring
  (high-volume, low-stakes) vs. drafting (low-volume, quality-sensitive), is
  a `.env` edit.
- Drops the `@anthropic-ai/sdk` dependency entirely; no vendor SDK lock-in
  for the LLM layer, at the cost of maintaining the thin client ourselves
  (small surface, same tradeoff already accepted for Reddit in ADR-0005).
