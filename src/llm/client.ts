import { z } from 'zod';
import { LlmApiError } from './errors.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** DI seam: the one operation this project needs from an LLM provider. */
export interface LlmClient {
  chatCompletion(model: string, messages: ChatMessage[], maxTokens: number): Promise<string>;
}

const chatCompletionResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string().nullable() }),
    }),
  ),
});

/**
 * Thin client for OpenRouter's OpenAI-compatible chat completions API
 * (https://openrouter.ai/api/v1/chat/completions). Model routing (DeepSeek,
 * GLM, MiniMax, etc.) is just a `model` string — see SCORING_MODEL /
 * DRAFTING_MODEL in .env.
 */
export class OpenRouterClient implements LlmClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async chatCompletion(model: string, messages: ChatMessage[], maxTokens: number): Promise<string> {
    const response = await this.fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
    });
    const body = await safeJson(response);
    if (!response.ok) {
      throw new LlmApiError(`OpenRouter request failed for model ${model}`, response.status, body);
    }
    const parsed = chatCompletionResponseSchema.parse(body);
    const content = parsed.choices[0]?.message.content;
    if (!content) {
      throw new LlmApiError(
        `OpenRouter response for ${model} had no content`,
        response.status,
        body,
      );
    }
    return content;
  }
}

export function createLlmClient(apiKey: string): LlmClient {
  return new OpenRouterClient(apiKey);
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
