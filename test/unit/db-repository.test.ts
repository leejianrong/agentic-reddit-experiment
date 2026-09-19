import type { Client } from '@libsql/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDbClient, initSchema } from '../../src/db/client.js';
import {
  deletePendingApproval,
  getPendingApproval,
  insertDraft,
  insertDraftOutcome,
  insertOpportunity,
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

  it('records a draft outcome with detail and warning', async () => {
    await insertOpportunity(db, {
      id: 'opp-1',
      fullname: 't3_c',
      subreddit: 'python',
      kind: 'comment',
      title: 't',
      permalink: 'p',
      angle: 'a',
    });
    await insertDraft(db, {
      id: 'draft-1',
      opportunityId: 'opp-1',
      runId: 'run-1',
      text: 'x',
      version: 1,
      status: 'approved',
    });

    await insertDraftOutcome(db, {
      draftId: 'draft-1',
      outcome: 'ready-to-post',
      detail: 'final approved text',
      warning: 'thread may be stale',
    });

    const row = await db.execute({
      sql: 'SELECT outcome, detail, warning FROM draft_outcomes WHERE draft_id = ?',
      args: ['draft-1'],
    });
    expect(row.rows[0]).toMatchObject({
      outcome: 'ready-to-post',
      detail: 'final approved text',
      warning: 'thread may be stale',
    });
  });

  it('round-trips a pending approval mapping', async () => {
    await savePendingApproval(db, 42, 'run-abc');
    expect(await getPendingApproval(db, 42)).toEqual({ runId: 'run-abc' });

    await deletePendingApproval(db, 42);
    expect(await getPendingApproval(db, 42)).toBeNull();
  });
});
