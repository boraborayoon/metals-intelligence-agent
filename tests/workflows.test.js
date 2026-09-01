import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflow = (name) => parse(readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8'));

describe('GitHub Actions workflows', () => {
  it('parses all workflow YAML and exposes manual dispatch', () => {
    for (const name of ['news-agent.yml', 'daily-digest.yml', 'deploy-dashboard.yml']) {
      const document = workflow(name);
      expect(document.on.workflow_dispatch).toBeDefined();
      expect(document.jobs).toBeTypeOf('object');
    }
  });

  it('prevents concurrent data writers and grants only needed write access', () => {
    const news = workflow('news-agent.yml');
    const digest = workflow('daily-digest.yml');
    expect(news.concurrency.group).toBe('metals-intelligence-data-writer');
    expect(digest.concurrency.group).toBe('metals-intelligence-data-writer');
    expect(news.permissions.contents).toBe('write');
    expect(digest.permissions.contents).toBe('read');
  });

  it('registers the twice-hourly news schedule explicitly in Korea time', () => {
    const news = workflow('news-agent.yml');
    expect(news.on.schedule).toEqual([
      { cron: '17,47 * * * *', timezone: 'Asia/Seoul' }
    ]);
  });

  it('registers all daily digest times explicitly in Korea time', () => {
    const digest = workflow('daily-digest.yml');
    expect(digest.on.schedule).toEqual([
      { cron: '30 7,17 * * *', timezone: 'Asia/Seoul' },
      { cron: '0 12 * * *', timezone: 'Asia/Seoul' }
    ]);
  });

  it('uses clear workflow names and chains dashboard deployment after news collection', () => {
    const news = workflow('news-agent.yml');
    const dashboard = workflow('deploy-dashboard.yml');
    const digest = workflow('daily-digest.yml');
    expect(news.name).toBe('1. News Collection & Alerts (Every 30 min)');
    expect(dashboard.name).toBe('2. Dashboard Update (After News Collection)');
    expect(digest.name).toBe('3. Market Digest (07:30 / 12:00 / 17:30 KST)');
    expect(dashboard.on.workflow_run.workflows).toEqual([news.name]);
  });

  it('does not reference OpenAI credentials in the rule-only workflow', () => {
    const raw = readFileSync(new URL('../.github/workflows/news-agent.yml', import.meta.url), 'utf8');
    expect(raw).not.toMatch(/OPENAI|MAX_AI|enableAi/i);
    expect(raw).toContain('TELEGRAM_BOT_TOKEN');
    expect(raw).toContain('codex-analysis-queue.json');
  });

  it('keeps Telegram enabled while Kakao delivery is paused', () => {
    for (const name of ['news-agent.yml', 'daily-digest.yml']) {
      const document = workflow(name);
      const environment = Object.values(document.jobs)[0].env;
      expect(environment.KAKAO_REST_API_KEY).toBeUndefined();
      expect(environment.KAKAO_CLIENT_SECRET).toBeUndefined();
      expect(environment.KAKAO_REFRESH_TOKEN).toBeUndefined();
      expect(environment.ENABLE_KAKAO).toBe('false');
      expect(environment.TELEGRAM_BOT_TOKEN).toBe('${{ secrets.TELEGRAM_BOT_TOKEN }}');
      expect(environment.TELEGRAM_CHAT_ID).toBe('${{ secrets.TELEGRAM_CHAT_ID }}');
      expect(environment.ENABLE_TELEGRAM).toBe('true');
    }
  });
});
