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

  it('does not reference OpenAI credentials in the rule-only workflow', () => {
    const raw = readFileSync(new URL('../.github/workflows/news-agent.yml', import.meta.url), 'utf8');
    expect(raw).not.toMatch(/OPENAI|MAX_AI|enableAi/i);
    expect(raw).toContain('TELEGRAM_BOT_TOKEN');
    expect(raw).toContain('codex-analysis-queue.json');
  });

  it('injects Kakao refresh credentials without storing their values in the workflow', () => {
    for (const name of ['news-agent.yml', 'daily-digest.yml']) {
      const document = workflow(name);
      const environment = Object.values(document.jobs)[0].env;
      expect(environment.KAKAO_REST_API_KEY).toBe('${{ secrets.KAKAO_REST_API_KEY }}');
      expect(environment.KAKAO_CLIENT_SECRET).toBe('${{ secrets.KAKAO_CLIENT_SECRET }}');
      expect(environment.KAKAO_REFRESH_TOKEN).toBe('${{ secrets.KAKAO_REFRESH_TOKEN }}');
      expect(environment.ENABLE_KAKAO).toBe('true');
      expect(environment.TELEGRAM_BOT_TOKEN).toBe('${{ secrets.TELEGRAM_BOT_TOKEN }}');
      expect(environment.TELEGRAM_CHAT_ID).toBe('${{ secrets.TELEGRAM_CHAT_ID }}');
      expect(environment.ENABLE_TELEGRAM).toBe('true');
    }
  });
});
