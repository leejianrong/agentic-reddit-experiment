import type { ChatMessage, LlmClient } from './client.js';

export interface DraftContext {
  subreddit: string;
  kind: 'comment' | 'post';
  title: string;
  body: string;
  angle: string;
  persona: string;
}

export async function draftContent(
  client: LlmClient,
  model: string,
  context: DraftContext,
): Promise<string> {
  const text = await client.chatCompletion(
    model,
    [
      { role: 'system', content: buildSystemPrompt(context.persona) },
      { role: 'user', content: buildUserPrompt(context) },
    ],
    600,
  );
  return text.trim();
}

export async function redraftContent(
  client: LlmClient,
  model: string,
  context: DraftContext,
  previousText: string,
  feedback: string,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(context.persona) },
    { role: 'user', content: buildUserPrompt(context) },
    { role: 'assistant', content: previousText },
    { role: 'user', content: `Please revise based on this feedback: ${feedback}` },
  ];
  const text = await client.chatCompletion(model, messages, 600);
  return text.trim();
}

function buildSystemPrompt(persona: string): string {
  return [
    'You write Reddit comments and posts for a real practitioner building a genuine, helpful ',
    'presence in technical communities. ',
    persona,
    '\nWrite in plain, direct prose as this person would actually type it — no markdown headers, ',
    'no bullet-point lists unless truly natural, no corporate tone, no AI-assistant phrasing ',
    '("I hope this helps!", "Let me know if you have questions", "Happy to elaborate"). ',
    "Never mention or link to the author's own projects, tools, or content — that is explicitly ",
    'out of scope for now. Output ONLY the comment/post text itself, nothing else.',
  ].join('');
}

function buildUserPrompt(context: DraftContext): string {
  const target =
    context.kind === 'comment'
      ? `Write a reply comment for this thread in r/${context.subreddit}.\n` +
        `Title: ${context.title}\nBody: ${context.body || '(no body)'}\n`
      : `Write a new top-level self-post for r/${context.subreddit}.\nWorking title: ${context.title}\n`;
  return `${target}\nWhy this is worth engaging with: ${context.angle}`;
}
