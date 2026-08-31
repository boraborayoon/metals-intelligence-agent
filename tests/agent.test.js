import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runAgent } from '../scripts/run-agent.js';

const commodities = JSON.parse(readFileSync(new URL('../config/commodities.json', import.meta.url), 'utf8'));
const settings = JSON.parse(readFileSync(new URL('../config/settings.json', import.meta.url), 'utf8'));
const savedEnvironment = {};

beforeEach(() => {
  for (const key of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'KAKAO_ACCESS_TOKEN', 'KAKAO_LINK_URL']) savedEnvironment[key] = process.env[key];
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_CHAT_ID = 'test-chat';
  process.env.KAKAO_ACCESS_TOKEN = 'test-kakao-token';
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

const config = { commodities, rules: {}, sources: [{ name: 'Fixture' }], settings: { ...settings, enableTelegram: true, enableKakao: false } };
const fetchResult = (title, description) => ({
  articles: [{ title, description, link: `https://example.com/${encodeURIComponent(title)}`, feedSource: 'Fixture', language: 'en', isoDate: '2026-08-26T00:00:00Z' }],
  sourceStats: [{ name: 'Fixture', status: 'OK', count: 1 }]
});

describe('agent safety behavior', () => {
  it('uses rule analysis and does not mark a Telegram failure as sent', async () => {
    const result = await runAgent({
      dryRun: false, persist: false, now: new Date('2026-08-26T01:00:00Z'), config,
      queue: { items: [] }, sentData: { items: [] },
      fetchResult: fetchResult('Major Chile copper mine production halt after accident', 'A supply disruption stopped production.'),
      telegramSender: { sendMessage: async () => { throw new Error('simulated failure'); } }
    });
    expect(result.articles[0].analysisMode).toBe('RULE_BASED');
    expect(result.articles[0].analysisSource).toBe('RULE');
    expect(result.articles[0].sent).toBe(false);
    expect(result.runStats.sent).toBe(0);
    expect(result.runStats.failed).toBe(1);
  });

  it('marks an article sent when Kakao succeeds after Telegram fails', async () => {
    const result = await runAgent({
      dryRun: false, persist: false, now: new Date('2026-08-26T01:00:00Z'),
      config: { ...config, settings: { ...config.settings, enableKakao: true } },
      queue: { items: [] }, sentData: { items: [] },
      fetchResult: fetchResult('Major Chile copper mine production halt after accident', 'A supply disruption stopped production.'),
      telegramSender: { sendMessage: async () => { throw new Error('simulated Telegram block'); } },
      kakaoSender: { sendMessage: async () => ({ ok: true }) }
    });
    expect(result.articles[0].sent).toBe(true);
    expect(result.runStats.sent).toBe(1);
    expect(result.statuses.telegramStatus).toBe('ERROR');
    expect(result.statuses.kakaoStatus).toBe('OK');
  });

  it('excludes LOW news from Telegram by default', async () => {
    const result = await runAgent({
      dryRun: false, persist: false, now: new Date('2026-08-26T01:00:00Z'), config,
      queue: { items: [] }, sentData: { items: [] },
      fetchResult: fetchResult('LME copper price rose 0.3% today', ''),
      telegramSender: { sendMessage: async () => ({ ok: true }) }
    });
    expect(result.articles[0].importance).toBe('LOW');
    expect(result.eligible).toHaveLength(0);
  });

  it('skips Telegram safely when credentials are missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    let calls = 0;
    const result = await runAgent({
      dryRun: false, persist: false, now: new Date('2026-08-26T01:00:00Z'), config,
      queue: { items: [] }, sentData: { items: [] },
      fetchResult: fetchResult('Major Chile copper mine production halt after accident', 'A supply disruption stopped production.'),
      telegramSender: { sendMessage: async () => { calls += 1; } }
    });
    expect(calls).toBe(0);
    expect(result.runStats.failed).toBe(0);
    expect(result.statuses.telegramStatus).toBe('NOT_CONFIGURED');
  });

  it('does not resend an item already present in sent history', async () => {
    const first = await runAgent({
      dryRun: false, persist: false, now: new Date('2026-08-26T01:00:00Z'),
      config: { ...config, settings: { ...config.settings, enableTelegram: false } }, queue: { items: [] }, sentData: { items: [] },
      fetchResult: fetchResult('Major Chile copper mine production halt after accident', 'A supply disruption stopped production.')
    });
    const item = first.articles[0];
    const second = await runAgent({
      dryRun: false, persist: false, now: new Date('2026-08-26T02:00:00Z'), config, queue: { items: [] },
      sentData: { items: [{ id: item.id, title: item.title, commodity: item.commodity, sentAt: '2026-08-26T01:00:00Z' }] },
      fetchResult: fetchResult('Major Chile copper mine production halt after accident', 'A supply disruption stopped production.'),
      telegramSender: { sendMessage: async () => { throw new Error('must not send'); } }
    });
    expect(second.articles).toHaveLength(0);
    expect(second.eligible).toHaveLength(0);
  });
});
