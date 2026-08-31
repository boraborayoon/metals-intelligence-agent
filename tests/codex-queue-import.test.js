import { describe, expect, it } from 'vitest';
import { buildCodexQueue, shouldQueueForCodex } from '../scripts/codexQueue.js';
import { importCodexResults } from '../scripts/import-codex-results.js';

const queueSettings = {
  enabled: true,
  alwaysIncludeImportance: ['HIGH'],
  minimumImportanceForReview: 'MEDIUM',
  includeUnclear: true,
  includeConflictingSignals: true,
  reviewCategories: ['DISRUPTION'],
  maxItems: 100,
  retentionDays: 30
};

function article(overrides = {}) {
  const ruleAnalysis = {
    importance: 'MEDIUM', marketImpact: 'Bullish', procurementImpact: 'NEGATIVE',
    category: 'Supply', categories: ['SUPPLY'], region: 'Chile', regions: ['Chile'],
    summary: 'Rule summary', marketImpactReason: 'Rule market reason', procurementImpactReason: 'Rule procurement reason',
    keyEvidence: ['production cut'], confidence: 'MEDIUM', timeHorizon: 'SHORT_TERM', signals: ['Supply Tightening'], urgent: false,
    ...(overrides.ruleAnalysis || {})
  };
  return {
    id: 'article-1', commodity: 'COPPER', subCommodity: null, title: 'Copper event', description: 'Evidence',
    source: 'Fixture', url: 'https://example.com/1', publishedAt: '2026-08-26T00:00:00Z', priority: 40,
    importance: ruleAnalysis.importance, marketImpact: ruleAnalysis.marketImpact, procurementImpact: ruleAnalysis.procurementImpact,
    categories: ruleAnalysis.categories, regions: ruleAnalysis.regions, summaryKo: ruleAnalysis.summary,
    impactReasonKo: ruleAnalysis.marketImpactReason, procurementReasonKo: ruleAnalysis.procurementImpactReason,
    confidence: ruleAnalysis.confidence, signals: ruleAnalysis.signals, ruleAnalysis,
    ...overrides, ruleAnalysis
  };
}

describe('Codex analysis queue', () => {
  it('queues HIGH importance news', () => {
    expect(shouldQueueForCodex(article({ ruleAnalysis: { importance: 'HIGH' } }), queueSettings)).toBe(true);
  });

  it('queues an unclear MEDIUM article', () => {
    expect(shouldQueueForCodex(article({ ruleAnalysis: { marketImpact: 'Unclear', procurementImpact: 'UNCLEAR' } }), queueSettings)).toBe(true);
  });

  it('excludes ordinary LOW news', () => {
    expect(shouldQueueForCodex(article({ ruleAnalysis: { importance: 'LOW', marketImpact: 'Unclear', procurementImpact: 'UNCLEAR', categories: ['COMPANY'] } }), queueSettings)).toBe(false);
  });

  it('queues conflicting signals', () => {
    expect(shouldQueueForCodex(article({ conflictingSignals: true }), queueSettings)).toBe(true);
  });
});

describe('Codex result import', () => {
  it('keeps the rule analysis and gives valid Codex analysis precedence', async () => {
    const original = article({ ruleAnalysis: { importance: 'HIGH' } });
    const queue = buildCodexQueue([], [original], queueSettings, new Date('2026-08-26T01:00:00Z'));
    const results = { items: [{
      id: original.id, importance: 'MEDIUM', marketImpact: 'Bearish', procurementImpact: 'POSITIVE',
      category: 'Production Increase', region: 'Chile', summary: 'Codex summary',
      marketImpactReason: 'Production increased.', procurementImpactReason: 'Buyer availability may improve.',
      keyEvidence: ['output increased 10%'], confidence: 'HIGH'
    }] };
    const imported = await importCodexResults({
      persist: false, now: new Date('2026-08-26T02:00:00Z'), results, queue,
      latest: { items: [original] }, status: {}
    });
    expect(imported.analyzed).toBe(1);
    expect(imported.queue.items[0].codexStatus).toBe('ANALYZED');
    expect(imported.articles[0].analysisSource).toBe('CODEX');
    expect(imported.articles[0].effectiveAnalysis.marketImpact).toBe('Bearish');
    expect(imported.articles[0].ruleAnalysis.marketImpact).toBe('Bullish');
  });
});
