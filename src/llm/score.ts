import { z } from 'zod';
import type { RedditPost } from '../reddit/types.js';
import type { LlmClient } from './client.js';
import { extractJsonObject } from './json.js';

const scoreResultSchema = z.object({
  relevant: z.boolean(),
  angle: z.string(),
});
export type ScoreResult = z.infer<typeof scoreResultSchema>;

export interface ScoreCandidateInput {
  subreddit: string;
  post: RedditPost;
  persona: string;
}

export async function scoreCandidate(
  client: LlmClient,
  model: string,
  input: ScoreCandidateInput,
): Promise<ScoreResult> {
  const raw = await client.chatCompletion(
    model,
    [
      { role: 'system', content: buildSystemPrompt(input.persona) },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    300,
  );

  const parsed = scoreResultSchema.safeParse(extractJsonObject(raw));
  return parsed.success ? parsed.data : { relevant: false, angle: '' };
}

function buildSystemPrompt(persona: string): string {
  return [
    'You are screening Reddit threads for a real practitioner who wants to build a genuine, ',
    'helpful presence in technical communities. ',
    persona,
    '\nYou are NOT looking for self-promotion opportunities — only threads where a substantive, ',
    'non-promotional reply would add real value and read as expert, not generic.',
    '\nBe selective: most threads are not worth a reply. Only mark something relevant if a ',
    'knowledgeable person would genuinely have something specific and useful to add.',
    '\nReply with ONLY a JSON object, no other text, no markdown formatting: ',
    '{"relevant": boolean, "angle": string}. "angle" is a one-sentence description of what a ',
    'genuinely useful reply would cover, or an empty string if not relevant.',
  ].join('');
}

function buildUserPrompt(input: ScoreCandidateInput): string {
  return (
    `Subreddit: r/${input.subreddit}\n` +
    `Title: ${input.post.title}\n` +
    `Body: ${input.post.selftext || '(no body)'}\n` +
    `Existing comments: ${input.post.num_comments}`
  );
}
