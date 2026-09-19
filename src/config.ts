import { z } from 'zod';

const envSchema = z.object({
  REDDIT_CLIENT_ID: z.string().min(1),
  REDDIT_CLIENT_SECRET: z.string().min(1),
  REDDIT_REFRESH_TOKEN: z.string().min(1),
  REDDIT_USER_AGENT: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1).default('file:./data/app.db'),
  DRY_RUN: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
