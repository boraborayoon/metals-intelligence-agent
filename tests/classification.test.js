import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeArticle } from '../scripts/normalizeNews.js';
import { countTerm, scoreArticleRelevance } from '../scripts/scoreRelevance.js';
import { classifyRuleBased } from '../scripts/classifyRuleBased.js';

const commodities = JSON.parse(readFileSync(new URL('../config/commodities.json', import.meta.url), 'utf8'));

function analyze(title, description = '') {
  const normalized = normalizeArticle({ title, description, link: `https://example.com/${encodeURIComponent(title)}`, feedSource: 'Fixture', language: 'en', isoDate: '2026-08-26T00:00:00Z' });
  return classifyRuleBased(scoreArticleRelevance(normalized, commodities), commodities);
}

describe('keyword matching and relevance', () => {
  it('matches complete English terms without tin false positives', () => {
    expect(countTerm('Tin supply disruption', 'tin')).toBe(1);
    expect(countTerm('Company continues production', 'tin')).toBe(0);
  });

  it('weights title, producer, region and market context', () => {
    const article = analyze('Codelco halts copper mine production in Chile', 'A production halt affects copper supply.');
    expect(article.commodity).toBe('COPPER');
    expect(article.relevanceScore).toBeGreaterThanOrEqual(10);
    expect(article.regions).toContain('Chile');
    expect(article.companies).toContain('Codelco');
  });

  it('excludes Guri city news that only uses the ambiguous Korean word 구리', () => {
    const normalized = normalizeArticle({ title: '경기도 구리시, 지역치안협의회 개최', description: '구리경찰서와 구리시청이 행사 계획을 발표했다.', link: 'https://example.com/guri-city', feedSource: 'Fixture', language: 'ko', isoDate: '2026-08-26T00:00:00Z' });
    const result = scoreArticleRelevance(normalized, commodities);
    expect(result.commodity).toBe('COPPER');
    expect(result.relevanceScore).toBe(0);
    expect(result.exclusionReason).toMatch(/구리/);
  });

  it('excludes chairman Xi news that only uses 주석 as a title', () => {
    const normalized = normalizeArticle({ title: '시진핑 주석, 정상회의에서 연설', description: '중국 국가주석이 외교 정책을 설명했다.', link: 'https://example.com/xi-chairman', feedSource: 'Fixture', language: 'ko', isoDate: '2026-08-26T00:00:00Z' });
    const result = scoreArticleRelevance(normalized, commodities);
    expect(result.commodity).toBe('TIN');
    expect(result.relevanceScore).toBe(0);
    expect(result.exclusionReason).toBe('시진핑 주석');
  });

  it('keeps genuine Korean copper and tin market articles', () => {
    expect(analyze('칠레 구리 광산 생산 중단', '구리 공급 차질이 예상된다.').relevanceScore).toBeGreaterThanOrEqual(5);
    expect(analyze('인도네시아 주석 수출 제한', '주석 공급 감소 가능성이 제기됐다.').relevanceScore).toBeGreaterThanOrEqual(5);
  });
});

describe('required mock classification cases', () => {
  it('Case A: major Chile copper mine accident', () => {
    const result = analyze('Major Chile copper mine production halt after accident', 'The accident caused a supply disruption and production halt.');
    expect(result).toMatchObject({ commodity: 'COPPER', importance: 'HIGH', marketImpact: 'Bullish', procurementImpact: 'NEGATIVE' });
    expect(result.categories).toEqual(expect.arrayContaining(['SUPPLY', 'MINE', 'DISRUPTION', 'ACCIDENT']));
  });

  it('Case B: major aluminum capacity expansion', () => {
    const result = analyze('Alcoa announces major aluminum capacity expansion', 'The producer plans new capacity and a production increase.');
    expect(result).toMatchObject({ commodity: 'ALUMINUM', importance: 'HIGH', marketImpact: 'Bearish', procurementImpact: 'POSITIVE' });
    expect(result.categories).toEqual(expect.arrayContaining(['CAPACITY', 'PRODUCTION']));
  });

  it('Case C: unsupported CEO forecast stays Unclear', () => {
    const result = analyze('CEO says copper price will rise next year', 'No supply, demand, inventory or production evidence was provided.');
    expect(['LOW', 'MEDIUM']).toContain(result.importance);
    expect(result.marketImpact).toBe('Unclear');
    expect(result.confidence).toBe('LOW');
  });

  it('Case D: small unexplained daily price move is LOW', () => {
    const result = analyze('LME copper price rose 0.3% today');
    expect(result.importance).toBe('LOW');
    expect(result.marketImpact).toBe('Unclear');
  });

  it('Case E: Indonesia tin export regulation shock', () => {
    const result = analyze('Indonesia makes major change to tin export regulation', 'The government introduced an export restriction on refined tin.');
    expect(result).toMatchObject({ commodity: 'TIN', importance: 'HIGH' });
    expect(result.categories).toEqual(expect.arrayContaining(['EXPORT', 'POLICY', 'REGULATION']));
    expect(['Bullish', 'Bearish', 'Unclear']).toContain(result.marketImpact);
  });

  it('keeps a minor tariff mention below HIGH', () => {
    const result = analyze('Aluminum import tariff changes by 2%', 'The minor tariff adjustment takes effect next month.');
    expect(result.importance).toBe('MEDIUM');
  });

  it('only emits permitted impact values and allows HIGH plus Unclear', () => {
    const result = analyze('Major copper mine accident in Chile', 'The mine reported an accident; the effect on output is not yet known.');
    expect(result.importance).toBe('HIGH');
    expect(result.marketImpact).toBe('Unclear');
    expect(['Bullish', 'Bearish', 'Neutral', 'Unclear']).toContain(result.marketImpact);
    expect(['NEGATIVE', 'POSITIVE', 'NEUTRAL', 'UNCLEAR']).toContain(result.procurementImpact);
  });

  it('classifies demand slowdown as Bearish', () => {
    const result = analyze('Copper demand slowdown deepens', 'Manufacturing contraction is reducing copper demand.');
    expect(result.marketImpact).toBe('Bearish');
    expect(result.procurementImpact).toBe('POSITIVE');
  });

  it('classifies inventory decline as Bullish', () => {
    const result = analyze('LME copper inventory decline continues', 'Warehouse outflow depleted visible stockpiles.');
    expect(result.marketImpact).toBe('Bullish');
    expect(result.signals).toContain('Inventory Down');
  });

  it('keeps conflicting supply and demand signals Unclear', () => {
    const result = analyze('Copper mine shutdown meets demand slowdown', 'A production halt tightened supply while manufacturing contraction weakened demand.');
    expect(result.marketImpact).toBe('Unclear');
    expect(result.procurementImpact).toBe('UNCLEAR');
    expect(result.conflictingSignals).toBe(true);
  });
});
