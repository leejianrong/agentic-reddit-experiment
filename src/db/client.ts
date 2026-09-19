import { type Client, createClient } from '@libsql/client';

export function createDbClient(databaseUrl: string): Client {
  return createClient({ url: databaseUrl });
}

export async function initSchema(db: Client): Promise<void> {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS seen_items (
        fullname TEXT PRIMARY KEY,
        subreddit TEXT NOT NULL,
        seen_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS opportunities (
        id TEXT PRIMARY KEY,
        fullname TEXT NOT NULL,
        subreddit TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        permalink TEXT NOT NULL,
        angle TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        opportunity_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        text TEXT NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS posting_records (
        id TEXT PRIMARY KEY,
        draft_id TEXT NOT NULL,
        outcome TEXT NOT NULL,
        dry_run INTEGER NOT NULL,
        reddit_fullname TEXT,
        detail TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS pending_approvals (
        telegram_message_id INTEGER PRIMARY KEY,
        run_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ],
    'write',
  );
}
