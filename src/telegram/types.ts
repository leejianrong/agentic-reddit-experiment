import { z } from 'zod';

export const telegramMessageSchema = z.object({
  message_id: z.number(),
  text: z.string().optional(),
  reply_to_message: z.object({ message_id: z.number() }).optional(),
  chat: z.object({ id: z.union([z.number(), z.string()]) }),
});
export type TelegramMessage = z.infer<typeof telegramMessageSchema>;

export const telegramCallbackQuerySchema = z.object({
  id: z.string(),
  data: z.string().optional(),
  message: telegramMessageSchema.optional(),
});
export type TelegramCallbackQuery = z.infer<typeof telegramCallbackQuerySchema>;

export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: telegramMessageSchema.optional(),
  callback_query: telegramCallbackQuerySchema.optional(),
});
export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

export const getUpdatesResponseSchema = z.object({
  ok: z.literal(true),
  result: z.array(telegramUpdateSchema),
});

export const sendMessageResponseSchema = z.object({
  ok: z.literal(true),
  result: telegramMessageSchema,
});
