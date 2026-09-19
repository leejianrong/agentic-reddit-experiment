import type { Client } from '@libsql/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDbClient, initSchema } from '../../src/db/client.js';
import {
  countRealPublishesSince,
  deletePendingApproval,
  getPendingApproval,
  insertDraft,
  insertOpportunity,
  insertPostingRecord,
  isSeen,
  markSeen,
  savePendingApproval,
  updateDraft,
} from '../../src/db/repository.js';

describe('db repository', () => {
  let db: Client;

  beforeEach(async () => {
    db = createDbClient(':memory:');
    await initSchema(db);
  });

  it('tracks seen items for dedup', async () => {
    expect(await isSeen(db, 't3_abc')).toBe(false);
    await markSeen(db, 't3_abc', 'python');
    expect(await isSeen(db, 't3_abc')).toBe(true);
  });

  it('marking the same item seen twice does not error', async () => {
    await markSeen(db, 't3_abc', 'python');
    await markSeen(db, 't3_abc', 'python');
    expect(await isSeen(db, 't3_abc')).toBe(true);
  });

  it('stores and updates a draft', async () => {
    await insertOpportunity(db, {
      id: 'opp-1',
      fullname: 't3_abc',
      subreddit: 'python',
      kind: 'comment',
      title: 'A question',
      permalink: '/r/python/comments/abc',
      angle: 'Genuinely helpful answer available',
    });
    await insertDraft(db, {
      id: 'draft-1',
      opportunityId: 'opp-1',
      runId: 'run-1',
      text: 'first draft',
      version: 1,
      status: 'pending',
    });

    await updateDraft(db, 'draft-1', { text: 'edited draft', version: 2 });

    const row = await db.execute({
      sql: 'SELECT text, version, status FROM drafts WHERE id = ?',
      args: ['draft-1'],
    });
    expect(row.rows[0]).toMatchObject({ text: 'edited draft', version: 2, status: 'pending' });
  });

  it('counts only real, published records of the matching kind within the window', async () => {
    await insertOpportunity(db, {
      id: 'opp-comment',
      fullname: 't3_c',
      subreddit: 'python',
      kind: 'comment',
      title: 't',
      permalink: 'p',
      angle: 'a',
    });
    await insertOpportunity(db, {
      id: 'opp-post',
      fullname: 't3_p',
      subreddit: 'python',
      kind: 'post',
      title: 't',
      permalink: 'p',
      angle: 'a',
    });
    await insertDraft(db, {
      id: 'draft-comment',
      opportunityId: 'opp-comment',
      runId: 'run-c',
      text: 'x',
      version: 1,
      status: 'approved',
    });
    await insertDraft(db, {
      id: 'draft-post',
      opportunityId: 'opp-post',
      runId: 'run-p',
      text: 'x',
      version: 1,
      status: 'approved',
    });

    await insertPostingRecord(db, {
      draftId: 'draft-comment',
      outcome: 'published',
      dryRun: false,
    });
    await insertPostingRecord(db, { draftId: 'draft-comment', outcome: 'dry-run', dryRun: true });
    await insertPostingRecord(db, { draftId: 'draft-post', outcome: 'published', dryRun: false });

    const sinceStart = Date.now() - 1000;
    expect(await countRealPublishesSince(db, 'comment', sinceStart)).toBe(1);
    expect(await countRealPublishesSince(db, 'post', sinceStart)).toBe(1);

    const sinceFuture = Date.now() + 1000;
    expect(await countRealPublishesSince(db, 'comment', sinceFuture)).toBe(0);
  });

  it('round-trips a pending approval mapping', async () => {
    await savePendingApproval(db, 42, 'run-abc');
    expect(await getPendingApproval(db, 42)).toEqual({ runId: 'run-abc' });

    await deletePendingApproval(db, 42);
    expect(await getPendingApproval(db, 42)).toBeNull();
  });
});
