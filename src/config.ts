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
  ANTHROPIC_SCORING_MODEL: z.string().min(1).default('claude-haiku-4-5-20251001'),
  ANTHROPIC_DRAFTING_MODEL: z.string().min(1).default('claude-sonnet-5'),
  SCAN_INTERVAL_MINUTES: z.coerce.number().int().positive().default(30),
  MAX_OPPORTUNITIES_PER_CYCLE: z.coerce.number().int().positive().default(3),
  RATE_CAP_COMMENTS_PER_DAY: z.coerce.number().int().positive().default(3),
  RATE_CAP_POST_EVERY_DAYS: z.coerce.number().int().positive().default(3),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
