import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const validEnv = {
  REDDIT_CLIENT_ID: 'id',
  REDDIT_CLIENT_SECRET: 'secret',
  REDDIT_REFRESH_TOKEN: 'refresh',
  REDDIT_USER_AGENT: 'agentic-reddit-experiment/0.0.0',
  TELEGRAM_BOT_TOKEN: 'bot-token',
  TELEGRAM_CHAT_ID: '12345',
  ANTHROPIC_API_KEY: 'anthropic-key',
};

describe('loadConfig', () => {
  it('defaults DRY_RUN to true when unset', () => {
    const config = loadConfig({ ...validEnv });
    expect(config.DRY_RUN).toBe(true);
  });

  it('only treats the literal string "false" as disabling DRY_RUN', () => {
    const config = loadConfig({ ...validEnv, DRY_RUN: 'false' });
    expect(config.DRY_RUN).toBe(false);
  });

  it('throws when a required secret is missing', () => {
    const { REDDIT_CLIENT_ID: _omit, ...incomplete } = validEnv;
    expect(() => loadConfig({ ...incomplete })).toThrow();
  });
});
