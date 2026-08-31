import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatTelegramArticle } from '../scripts/formatTelegram.js';
import { calculatePriority } from '../scripts/calculatePriority.js';

const settings = JSON.parse(readFileSync(new URL('../config/settings.json', import.meta.url), 'utf8'));

const baseArticle = {
  commodity: 'COPPER', subCommodity: null, importance: 'HIGH', categories: ['SUPPLY', 'MINE', 'DISRUPTION'],
  titleKo: '칠레 <주요> 구리광산 생산 차질', summaryKo: '공급 감소 가능성이 제기됨.', marketImpact: 'Bullish',
  impactReasonKo: '기사에 공급 차질이 명시됨.', procurementImpact: 'NEGATIVE', procurementReasonKo: '조달 부담 가능성.',
  regions: ['Chile'], companies: [], timeHorizon: 'SHORT_TERM', confidence: 'MEDIUM', signals: ['Supply Disruption'],
  urgent: true, source: 'Fixture & News', publishedAt: '2026-08-26T00:00:00Z', url: 'https://example.com/a?x=1&y=2', relevanceScore: 10,
  analysisSource: 'RULE', primaryCategory: 'Supply Disruption'
};

describe('Telegram formatter', () => {
  it('formats urgent HTML safely with required fields', () => {
    const message = formatTelegramArticle(baseArticle);
    expect(message).toContain('🚨 MARKET ALERT');
    expect(message).toContain('🔴 [COPPER | HIGH]');
    expect(message).toContain('Bullish 🔺');
    expect(message).toContain('칠레 &lt;주요&gt;');
    expect(message).toContain('Fixture &amp; News');
    expect(message).toContain('https://example.com/a?x=1&amp;y=2');
    expect(message).toContain('Analysis');
    expect(message).toContain('RULE');
    expect(Array.from(message).length).toBeLessThanOrEqual(4096);
  });
});

describe('priority calculation', () => {
  it('combines configured importance, relevance, recency, supply risk and urgency', () => {
    const priority = calculatePriority(baseArticle, settings.priorityWeights, new Date('2026-08-26T03:00:00Z'));
    expect(priority).toBe(68);
  });
});
