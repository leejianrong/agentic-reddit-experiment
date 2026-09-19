import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const baseEnv = {
  TELEGRAM_BOT_TOKEN: 'bot-token',
  TELEGRAM_CHAT_ID: '12345',
  OPENROUTER_API_KEY: 'openrouter-key',
};

describe('loadConfig', () => {
  it('succeeds with official Reddit OAuth credentials and no Redlib URL', () => {
    const config = loadConfig({
      ...baseEnv,
      REDDIT_CLIENT_ID: 'id',
      REDDIT_CLIENT_SECRET: 'secret',
      REDDIT_REFRESH_TOKEN: 'refresh',
      REDDIT_USER_AGENT: 'test-agent/0.0.0',
    });
    expect(config.REDDIT_CLIENT_ID).toBe('id');
  });

  it('succeeds with only a Redlib URL and no Reddit OAuth credentials', () => {
    const config = loadConfig({ ...baseEnv, REDLIB_URL: 'http://redlib:8080' });
    expect(config.REDLIB_URL).toBe('http://redlib:8080');
    expect(config.REDDIT_CLIENT_ID).toBeUndefined();
  });

  it('throws when neither official Reddit credentials nor a Redlib URL are set', () => {
    expect(() => loadConfig({ ...baseEnv })).toThrow();
  });

  it('throws when a Reddit OAuth credential is partially set without a Redlib fallback', () => {
    expect(() => loadConfig({ ...baseEnv, REDDIT_CLIENT_ID: 'id' })).toThrow();
  });

  it('throws when a non-Reddit required secret is missing', () => {
    const { TELEGRAM_BOT_TOKEN: _omit, ...incomplete } = baseEnv;
    expect(() => loadConfig({ ...incomplete, REDLIB_URL: 'http://redlib:8080' })).toThrow();
  });
});
