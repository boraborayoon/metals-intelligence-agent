import { paths } from './lib/paths.js';
import { readJson, writeJsonAtomic } from './lib/jsonStore.js';
import { createRuleAnalysis } from './analysisModel.js';
import { scoreArticleRelevance } from './scoreRelevance.js';

const IMPORTANCE_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const VALID_STATUSES = new Set(['PENDING', 'ANALYZED', 'SKIPPED']);

const ageInDays = (value, now) => (now.getTime() - Date.parse(value || 0)) / 86_400_000;

export function codexReviewReasons(article, queueSettings = {}) {
  if (!queueSettings.enabled) return [];
  const rule = article.ruleAnalysis || createRuleAnalysis(article);
  const reasons = [];
  if ((queueSettings.alwaysIncludeImportance || ['HIGH']).includes(rule.importance)) reasons.push('HIGH importance');
  const minimum = IMPORTANCE_RANK[queueSettings.minimumImportanceForReview || 'MEDIUM'] ?? 1;
  if ((IMPORTANCE_RANK[rule.importance] ?? 0) < minimum) return reasons;
  if (queueSettings.includeUnclear && (rule.marketImpact === 'Unclear' || rule.procurementImpact === 'UNCLEAR')) reasons.push('Rule direction is unclear');
  if (queueSettings.includeConflictingSignals && article.conflictingSignals) reasons.push('Conflicting market signals');
  if ((queueSettings.reviewCategories || []).some((category) => rule.categories.includes(category))) reasons.push('Material event taxonomy');
  if (article.codexReviewEvent) reasons.push('High-impact event requires evidence review');
  return [...new Set(reasons)];
}

export function shouldQueueForCodex(article, queueSettings) {
  return codexReviewReasons(article, queueSettings).length > 0;
}

function queueEntry(article, existing, reasons, now) {
  const status = VALID_STATUSES.has(existing?.codexStatus) ? existing.codexStatus : 'PENDING';
  return {
    id: article.id,
    commodity: article.commodity,
    subCommodity: article.subCommodity,
    title: article.title,
    summary: article.description || article.summaryKo || article.title,
    source: article.source,
    url: article.url,
    publishedAt: article.publishedAt,
    priority: article.priority,
    reasonForCodexReview: reasons.join('; '),
    ruleAnalysis: article.ruleAnalysis || createRuleAnalysis(article),
    codexAnalysis: existing?.codexAnalysis || article.codexAnalysis || null,
    codexStatus: status,
    queuedAt: existing?.queuedAt || now.toISOString(),
    updatedAt: now.toISOString(),
    analyzedAt: existing?.analyzedAt || null
  };
}

export function buildCodexQueue(existingItems, articles, queueSettings, now = new Date(), commodities = null) {
  const retentionDays = queueSettings.retentionDays ?? 30;
  const existingById = new Map((existingItems || [])
    .filter((item) => ageInDays(item.publishedAt || item.queuedAt, now) <= retentionDays)
    .filter((item) => !commodities || !scoreArticleRelevance({ title: item.title, description: item.summary }, commodities).exclusionReason)
    .map((item) => [item.id, item]));
  for (const article of articles) {
    const reasons = codexReviewReasons(article, queueSettings);
    if (!reasons.length && !existingById.has(article.id)) continue;
    const existing = existingById.get(article.id);
    existingById.set(article.id, queueEntry(article, existing, reasons.length ? reasons : [existing.reasonForCodexReview], now));
  }
  const statusOrder = { PENDING: 0, ANALYZED: 1, SKIPPED: 2 };
  const items = [...existingById.values()]
    .sort((a, b) => (statusOrder[a.codexStatus] ?? 9) - (statusOrder[b.codexStatus] ?? 9) || (b.priority || 0) - (a.priority || 0))
    .slice(0, queueSettings.maxItems ?? 500);
  return { generatedAt: now.toISOString(), items, counts: countCodexStatuses(items) };
}

export function countCodexStatuses(items) {
  return items.reduce((counts, item) => {
    if (VALID_STATUSES.has(item.codexStatus)) counts[item.codexStatus] += 1;
    return counts;
  }, { PENDING: 0, ANALYZED: 0, SKIPPED: 0 });
}

export function attachQueueState(articles, queueItems) {
  const byId = new Map(queueItems.map((item) => [item.id, item]));
  return articles.map((article) => {
    const queued = byId.get(article.id);
    return { ...article, codexStatus: queued?.codexStatus || null, codexReviewReason: queued?.reasonForCodexReview || null };
  });
}

export async function readCodexQueue() {
  return readJson(paths.codexQueue, { generatedAt: null, items: [] });
}

export async function writeCodexQueue(queueState) {
  const counts = queueState.counts || countCodexStatuses(queueState.items || []);
  await Promise.all([
    writeJsonAtomic(paths.codexQueue, { generatedAt: queueState.generatedAt, items: queueState.items || [] }),
    writeJsonAtomic(paths.publicCodexQueue, {
      generatedAt: queueState.generatedAt,
      counts,
      items: (queueState.items || []).map((item) => ({
        id: item.id, commodity: item.commodity, importance: item.ruleAnalysis?.importance,
        title: item.title, reasonForCodexReview: item.reasonForCodexReview,
        codexStatus: item.codexStatus, source: item.source, publishedAt: item.publishedAt
      }))
    })
  ]);
  return { ...queueState, counts };
}
