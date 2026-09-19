/**
 * Confirms the Reddit credentials in .env actually work: lists a few new
 * posts (read scope) and, only with --write, submits one throwaway comment
 * to r/test (write scope) so you can see it land on a real account before
 * trusting anything built on top of it.
 *
 *   npm run reddit:smoke-test           # read-only
 *   npm run reddit:smoke-test -- --write   # also posts one test comment
 */
import { loadConfig } from '../src/config.js';
import { RedditClient } from '../src/reddit/client.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new RedditClient({
    clientId: config.REDDIT_CLIENT_ID,
    clientSecret: config.REDDIT_CLIENT_SECRET,
    refreshToken: config.REDDIT_REFRESH_TOKEN,
    userAgent: config.REDDIT_USER_AGENT,
  });

  console.log('Listing new posts in r/test ...');
  const posts = await client.listNew('test', 5);
  for (const post of posts) {
    console.log(`- [${post.name}] ${post.title} (${post.num_comments} comments)`);
  }
  console.log(`Read check passed: fetched ${posts.length} post(s).`);

  if (!process.argv.includes('--write')) {
    console.log('\nSkipping write check (pass --write to also post a throwaway test comment).');
    return;
  }

  const target = posts[0];
  if (!target) {
    console.log(
      '\nNo posts in r/test to comment on right now — try again later or without --write.',
    );
    return;
  }

  console.log(`\nSubmitting a throwaway test comment on ${target.name} ...`);
  const result = await client.submitComment(
    target.name,
    'Automated credential smoke test for agentic-reddit-experiment — please ignore.',
  );
  console.log(`Write check passed: posted ${result.name}.`);
}

main().catch((error: unknown) => {
  console.error('Smoke test failed:', error);
  process.exitCode = 1;
});
