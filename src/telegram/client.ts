import { TelegramApiError } from './errors.js';
import {
  getUpdatesResponseSchema,
  sendMessageResponseSchema,
  type TelegramMessage,
  type TelegramUpdate,
} from './types.js';

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

/** DI seam: the slice of TelegramClient the adapter actually calls. */
export interface TelegramClientLike {
  sendMessage(
    chatId: string,
    text: string,
    buttons?: InlineKeyboardButton[][],
  ): Promise<TelegramMessage>;
  editMessageText(chatId: string | number, messageId: number, text: string): Promise<void>;
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
  getUpdates(offset: number, timeoutSeconds: number): Promise<TelegramUpdate[]>;
}

/** Thin wrapper over the Telegram Bot API (ADR-0002) — long-polling only, no webhook. */
export class TelegramClient implements TelegramClientLike {
  constructor(
    private readonly botToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async sendMessage(
    chatId: string,
    text: string,
    buttons?: InlineKeyboardButton[][],
  ): Promise<TelegramMessage> {
    const body = await this.call('sendMessage', {
      chat_id: chatId,
      text,
      reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
    });
    return sendMessageResponseSchema.parse(body).result;
  }

  async editMessageText(chatId: string | number, messageId: number, text: string): Promise<void> {
    await this.call('editMessageText', { chat_id: chatId, message_id: messageId, text });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.call('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
  }

  async getUpdates(offset: number, timeoutSeconds: number): Promise<TelegramUpdate[]> {
    const body = await this.call('getUpdates', { offset, timeout: timeoutSeconds });
    return getUpdatesResponseSchema.parse(body).result;
  }

  private async call(method: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetchImpl(
      `https://api.telegram.org/bot${this.botToken}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    const body = await safeJson(response);
    if (!response.ok) {
      throw new TelegramApiError(`Telegram API call failed: ${method}`, response.status, body);
    }
    return body;
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
