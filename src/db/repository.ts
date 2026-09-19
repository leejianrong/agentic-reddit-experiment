import type { Client } from '@libsql/client';

export type OpportunityKind = 'comment' | 'post';
export type DraftStatus = 'pending' | 'approved' | 'rejected';
export type PublishOutcome = 'published' | 'dry-run' | 'skipped-stale' | 'rate-limited' | 'failed';

export interface Opportunity {
  id: string;
  fullname: string;
  subreddit: string;
  kind: OpportunityKind;
  title: string;
  permalink: string;
  angle: string;
}

export interface Draft {
  id: string;
  opportunityId: string;
  runId: string;
  text: string;
  version: number;
  status: DraftStatus;
}

export interface PostingRecord {
  draftId: string;
  outcome: PublishOutcome;
  dryRun: boolean;
  redditFullname?: string;
  detail?: string;
}

export async function isSeen(db: Client, fullname: string): Promise<boolean> {
  const result = await db.execute({
    sql: 'SELECT 1 FROM seen_items WHERE fullname = ?',
    args: [fullname],
  });
  return result.rows.length > 0;
}

export async function markSeen(db: Client, fullname: string, subreddit: string): Promise<void> {
  await db.execute({
    sql: 'INSERT OR IGNORE INTO seen_items (fullname, subreddit, seen_at) VALUES (?, ?, ?)',
    args: [fullname, subreddit, Date.now()],
  });
}

export async function insertOpportunity(db: Client, opportunity: Opportunity): Promise<void> {
  await db.execute({
    sql: `INSERT INTO opportunities (id, fullname, subreddit, kind, title, permalink, angle, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      opportunity.id,
      opportunity.fullname,
      opportunity.subreddit,
      opportunity.kind,
      opportunity.title,
      opportunity.permalink,
      opportunity.angle,
      Date.now(),
    ],
  });
}

export async function insertDraft(db: Client, draft: Draft): Promise<void> {
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO drafts (id, opportunity_id, run_id, text, version, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      draft.id,
      draft.opportunityId,
      draft.runId,
      draft.text,
      draft.version,
      draft.status,
      now,
      now,
    ],
  });
}

export async function updateDraft(
  db: Client,
  id: string,
  changes: Partial<Pick<Draft, 'text' | 'version' | 'status'>>,
): Promise<void> {
  const fields: string[] = [];
  const args: (string | number)[] = [];
  if (changes.text !== undefined) {
    fields.push('text = ?');
    args.push(changes.text);
  }
  if (changes.version !== undefined) {
    fields.push('version = ?');
    args.push(changes.version);
  }
  if (changes.status !== undefined) {
    fields.push('status = ?');
    args.push(changes.status);
  }
  fields.push('updated_at = ?');
  args.push(Date.now());
  args.push(id);

  await db.execute({
    sql: `UPDATE drafts SET ${fields.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function insertPostingRecord(db: Client, record: PostingRecord): Promise<void> {
  await db.execute({
    sql: `INSERT INTO posting_records (id, draft_id, outcome, dry_run, reddit_fullname, detail, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      record.draftId,
      record.outcome,
      record.dryRun ? 1 : 0,
      record.redditFullname ?? null,
      record.detail ?? null,
      Date.now(),
    ],
  });
}

/** Counts real (non-dry-run) publishes of a kind since `sinceMs`, for rate-cap enforcement (ADR-0003). */
export async function countRealPublishesSince(
  db: Client,
  kind: OpportunityKind,
  sinceMs: number,
): Promise<number> {
  const result = await db.execute({
    sql: `SELECT COUNT(*) as count
          FROM posting_records pr
          JOIN drafts d ON d.id = pr.draft_id
          JOIN opportunities o ON o.id = d.opportunity_id
          WHERE pr.outcome = 'published' AND pr.dry_run = 0 AND o.kind = ? AND pr.created_at >= ?`,
    args: [kind, sinceMs],
  });
  const row = result.rows[0];
  return row ? Number(row.count) : 0;
}

export async function savePendingApproval(
  db: Client,
  telegramMessageId: number,
  runId: string,
): Promise<void> {
  await db.execute({
    sql: 'INSERT OR REPLACE INTO pending_approvals (telegram_message_id, run_id, created_at) VALUES (?, ?, ?)',
    args: [telegramMessageId, runId, Date.now()],
  });
}

export async function getPendingApproval(
  db: Client,
  telegramMessageId: number,
): Promise<{ runId: string } | null> {
  const result = await db.execute({
    sql: 'SELECT run_id FROM pending_approvals WHERE telegram_message_id = ?',
    args: [telegramMessageId],
  });
  const row = result.rows[0];
  return row ? { runId: String(row.run_id) } : null;
}

export async function deletePendingApproval(db: Client, telegramMessageId: number): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM pending_approvals WHERE telegram_message_id = ?',
    args: [telegramMessageId],
  });
}
