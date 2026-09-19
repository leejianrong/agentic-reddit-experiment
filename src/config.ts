import { z } from 'zod';

const envSchema = z
  .object({
    // Official Reddit OAuth "script" app — optional. When absent, REDLIB_URL
    // is required instead (ADR-0009). Only used for reads either way; the
    // app never calls Reddit's write API (ADR-0010).
    REDDIT_CLIENT_ID: z.string().min(1).optional(),
    REDDIT_CLIENT_SECRET: z.string().min(1).optional(),
    REDDIT_REFRESH_TOKEN: z.string().min(1).optional(),
    REDDIT_USER_AGENT: z.string().min(1).optional(),
    // Self-hosted Redlib instance URL, e.g. http://redlib:8080 (ADR-0009).
    REDLIB_URL: z.string().min(1).optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(1),
    TELEGRAM_CHAT_ID: z.string().min(1),
    OPENROUTER_API_KEY: z.string().min(1),
    DATABASE_URL: z.string().min(1).default('file:./data/app.db'),
    SCORING_MODEL: z.string().min(1).default('deepseek/deepseek-v4-flash'),
    DRAFTING_MODEL: z.string().min(1).default('deepseek/deepseek-v4-flash'),
    SCAN_INTERVAL_MINUTES: z.coerce.number().int().positive().default(30),
    MAX_OPPORTUNITIES_PER_CYCLE: z.coerce.number().int().positive().default(3),
  })
  .superRefine((env, ctx) => {
    const hasOfficialReddit = Boolean(
      env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET && env.REDDIT_REFRESH_TOKEN,
    );
    if (!hasOfficialReddit && !env.REDLIB_URL) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Set either REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET/REDDIT_REFRESH_TOKEN (official API) ' +
          'or REDLIB_URL (ADR-0009) — at least one Reddit read source is required.',
        path: ['REDLIB_URL'],
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
