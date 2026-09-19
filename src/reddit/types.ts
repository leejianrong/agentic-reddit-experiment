import { z } from 'zod';

export const redditPostSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  selftext: z.string().default(''),
  subreddit: z.string(),
  permalink: z.string(),
  url: z.string(),
  author: z.string(),
  created_utc: z.number(),
  num_comments: z.number(),
  locked: z.boolean().default(false),
});
export type RedditPost = z.infer<typeof redditPostSchema>;

const listingChildSchema = z.object({
  kind: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const listingSchema = z.object({
  kind: z.literal('Listing'),
  data: z.object({
    children: z.array(listingChildSchema),
    after: z.string().nullable().optional(),
  }),
});

export const threadStateSchema = z.object({
  name: z.string(),
  author: z.string(),
  locked: z.boolean().default(false),
  archived: z.boolean().default(false),
  num_comments: z.number(),
});
export type ThreadState = z.infer<typeof threadStateSchema>;

export const accessTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  scope: z.string(),
});

export const submitResponseSchema = z.object({
  json: z.object({
    errors: z.array(z.array(z.string())).default([]),
    data: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
        url: z.string().optional(),
      })
      .optional(),
  }),
});

export interface SubmitResult {
  id: string;
  name: string;
}
