# ADR-0004: No blanket AI-disclosure; per-subreddit rule compliance instead

- Status: Accepted
- Date: 2026-09-19
- Deciders: Jian

## Context

Every draft is reviewed, and can be edited, by Jian before it is approved —
nothing reaches Reddit without his explicit sign-off on that exact text. Some
subreddits explicitly ban AI-assisted content; Reddit's communities generally
react badly to visibly AI-labelled posts.

## Decision

Do not attach a blanket "written with AI assistance" disclosure to published
content — an approved, possibly hand-edited draft is treated as Jian's own
published word, the same way text drafted with a grammar tool or thesaurus
would be. Instead, each subreddit's config entry carries a
`allowsAiAssistance` flag (default `true`, flip to `false` per subreddit as
rules are found that prohibit it); the scan step skips generating any
opportunity for a subreddit flagged `false`.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Always disclose AI involvement | Undermines the goal of genuine engagement in these communities, several of which react negatively to visible AI-content labels; also unnecessary given every item is human-reviewed and can be edited before it goes out. |
| No compliance check at all | Leaves no defence against subreddits that explicitly ban AI-assisted content, which is a bannable-offense risk against ADR-0003's existing personal account. |

## Consequences

- Compliance is only as good as the `allowsAiAssistance` config, which starts
  empty/permissive per subreddit — someone (Jian, during subreddit setup) has
  to actually check each subreddit's rules and set the flag; this is not
  automatically discovered from Reddit's API.
- If Reddit-wide policy shifts toward mandatory AI-content labelling, this
  decision needs revisiting — noted as an open risk in PLAN.md.
