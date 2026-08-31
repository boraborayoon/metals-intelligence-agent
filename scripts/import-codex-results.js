import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from './lib/paths.js';
import { logger } from './lib/logger.js';
import { readJson, writeJsonAtomic } from './lib/jsonStore.js';
import { applyEffectiveAnalysis, normalizeCodexAnalysis } from './analysisModel.js';
import { countCodexStatuses, readCodexQueue, writeCodexQueue } from './codexQueue.js';
import { createMarketSummaries } from './generateDigest.js';

const kstDay = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));

export async function importCodexResults(options = {}) {
  const now = options.now || new Date();
  const resultsDocument = options.results || await readJson(paths.codexResults, { items: [] });
  const queue = options.queue || await readCodexQueue();
  const resultById = new Map((resultsDocument.items || []).map((item) => [item.id, item]));
  let analyzed = 0;
  let skipped = 0;
  const items = (queue.items || []).map((item) => {
    const result = resultById.get(item.id);
    if (!result) return item;
    if (result.codexStatus === 'SKIPPED') {
      skipped += 1;
      return { ...item, codexStatus: 'SKIPPED', updatedAt: now.toISOString() };
    }
    const codexAnalysis = normalizeCodexAnalysis(result, item.ruleAnalysis);
    analyzed += 1;
    return { ...item, codexAnalysis, codexStatus: 'ANALYZED', analysisSource: 'CODEX', analyzedAt: now.toISOString(), updatedAt: now.toISOString() };
  });
  const queueState = { generatedAt: now.toISOString(), items, counts: countCodexStatuses(items) };
  if (options.persist !== false) await writeCodexQueue(queueState);

  const latest = options.latest || await readJson(paths.latestNews, { generatedAt: null, items: [] });
  const queueById = new Map(items.map((item) => [item.id, item]));
  const newsItems = (latest.items || []).map((article) => {
    const queued = queueById.get(article.id);
    const effective = applyEffectiveAnalysis(article, queued?.codexStatus === 'ANALYZED' ? queued.codexAnalysis : null);
    return { ...effective, codexStatus: queued?.codexStatus || article.codexStatus || null, codexReviewReason: queued?.reasonForCodexReview || article.codexReviewReason || null };
  });
  const todayItems = newsItems.filter((item) => kstDay(item.publishedAt || item.fetchedAt) === kstDay(now));
  const status = options.status || await readJson(paths.status, {});
  if (options.persist !== false) {
    await Promise.all([
      writeJsonAtomic(paths.latestNews, { generatedAt: now.toISOString(), items: newsItems }),
      writeJsonAtomic(paths.marketSummary, { generatedAt: now.toISOString(), summaries: createMarketSummaries(todayItems, now) }),
      writeJsonAtomic(paths.status, { ...status, codexImportedAt: now.toISOString(), codexQueue: queueState.counts })
    ]);
  }
  logger.info('Codex results imported', { analyzed, skipped, unmatched: resultById.size - analyzed - skipped });
  return { analyzed, skipped, queue: queueState, articles: newsItems };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  importCodexResults().catch((error) => {
    logger.error('Codex result import failed', error.stack || error.message);
    process.exitCode = 1;
  });
}
