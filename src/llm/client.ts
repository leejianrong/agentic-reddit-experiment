import Anthropic from '@anthropic-ai/sdk';

/** The slice of the Anthropic client this project actually calls — a DI seam so tests inject a fake. */
export interface AnthropicMessagesClient {
  messages: {
    create: Anthropic['messages']['create'];
    parse: Anthropic['messages']['parse'];
  };
}

export function createAnthropicClient(apiKey: string): AnthropicMessagesClient {
  return new Anthropic({ apiKey });
}

export function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!block) {
    throw new Error('LLM response contained no text block');
  }
  return block.text.trim();
}
