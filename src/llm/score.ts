import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { RedditPost } from '../reddit/types.js';
import type { AnthropicMessagesClient } from './client.js';

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
  client: AnthropicMessagesClient,
  model: string,
  input: ScoreCandidateInput,
): Promise<ScoreResult> {
  const message = await client.messages.parse({
    model,
    max_tokens: 300,
    system: buildSystemPrompt(input.persona),
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
    output_config: { format: zodOutputFormat(scoreResultSchema) },
  });
  return message.parsed_output ?? { relevant: false, angle: '' };
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
