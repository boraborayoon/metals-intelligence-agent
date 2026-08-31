import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.js';
import { logger } from './lib/logger.js';
import { paths } from './lib/paths.js';
import { readJson, writeJsonAtomic } from './lib/jsonStore.js';
import { nextScheduledRun } from './lib/time.js';
import { fetchNews } from './fetchNews.js';
import { normalizeNews } from './normalizeNews.js';
import { scoreRelevance } from './scoreRelevance.js';
import { deduplicate } from './deduplicate.js';
import { classifyRuleBased } from './classifyRuleBased.js';
import { applyEffectiveAnalysis } from './analysisModel.js';
import { attachQueueState, buildCodexQueue, readCodexQueue, writeCodexQueue } from './codexQueue.js';
import { rankByPriority } from './calculatePriority.js';
import { formatTelegramArticle } from './formatTelegram.js';
import { formatKakaoArticle } from './formatKakao.js';
import { createTelegramSender } from '../src/services/senders/telegramSender.js';
import { createKakaoSender, hasKakaoCredentials } from '../src/services/senders/kakaoSender.js';
import { pruneSentItems, updateDashboardData } from './updateDashboardData.js';

const importanceRank = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const isDryRun = () => process.argv.includes('--dry-run') || String(process.env.DRY_RUN).toLowerCase() === 'true';

export async function runAgent(options = {}) {
  const dryRun = options.dryRun ?? isDryRun();
  const now = options.now || new Date();
  const config = options.config || await loadConfig();
  const { commodities, rules = {}, sources, settings } = config;
  const fetchResult = options.fetchResult || await fetchNews(sources, settings.sourceTimeoutMs);
  const normalized = normalizeNews(fetchResult.articles, now);
  const scored = scoreRelevance(normalized, commodities);
  const relevant = scored.filter((article) => article.relevanceScore >= settings.minimumRelevanceScore && article.commodity);
  const sentData = options.sentData || await readJson(paths.sentItems, { items: [] });
  const retainedSent = pruneSentItems(sentData.items || [], settings.historyRetentionDays, now);
  const { unique, duplicates } = deduplicate(relevant, retainedSent, settings.titleSimilarityThreshold);

  const queueDocument = options.queue || await readCodexQueue();
  const existingQueueById = new Map((queueDocument.items || []).map((item) => [item.id, item]));
  const ruleAnalyzed = unique.map((article) => classifyRuleBased(article, commodities, rules));
  const withImportedAnalysis = ruleAnalyzed.map((article) => {
    const queued = existingQueueById.get(article.id);
    return applyEffectiveAnalysis(article, queued?.codexStatus === 'ANALYZED' ? queued.codexAnalysis : null);
  });
  const rankedBase = rankByPriority(withImportedAnalysis, settings.priorityWeights, now);
  const queueState = buildCodexQueue(queueDocument.items || [], rankedBase, settings.codexQueue || { enabled: false }, now, commodities);
  const ranked = attachQueueState(rankedBase, queueState.items);

  const minimumImportance = importanceRank[settings.telegramMinimumImportance];
  const eligible = ranked.filter((article) => importanceRank[article.importance] >= minimumImportance).slice(0, settings.maxMessagesPerRun);
  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  const kakaoConfigured = hasKakaoCredentials();
  const telegram = options.telegramSender || createTelegramSender({ dryRun });
  const kakao = options.kakaoSender || createKakaoSender({ dryRun });
  const successfulIds = new Set();
  let telegramFailures = 0;
  let kakaoFailures = 0;

  if (settings.enableTelegram && !dryRun && !telegramConfigured && eligible.length) {
    logger.warn('Telegram not configured. Skipping delivery.');
  }
  for (const article of eligible) {
    const telegramMessage = formatTelegramArticle(article);
    const kakaoMessage = formatKakaoArticle(article);
    let telegramSuccess = false;
    let kakaoSuccess = false;
    if (settings.enableTelegram && (dryRun || telegramConfigured)) {
      try {
        await telegram.sendMessage(telegramMessage);
        telegramSuccess = true;
      } catch (error) {
        telegramFailures += 1;
        logger.error('Telegram send failed', { title: article.title, error: error.message });
      }
    }
    if (settings.enableKakao && (dryRun || kakaoConfigured)) {
      try {
        await kakao.sendMessage(kakaoMessage, { linkUrl: article.url, buttonTitle: '기사 원문 보기' });
        kakaoSuccess = true;
      } catch (error) {
        kakaoFailures += 1;
        logger.error('Kakao send failed', { title: article.title, error: error.message });
      }
    }
    if (telegramSuccess || kakaoSuccess) successfulIds.add(article.id);
  }

  const dashboardArticles = ranked.map((article) => ({ ...article, sent: successfulIds.has(article.id), sentAt: successfulIds.has(article.id) ? now.toISOString() : null }));
  const newSentItems = dashboardArticles.filter((article) => article.sent).map((article) => ({
    id: article.id, titleSourceHash: article.titleSourceHash, eventId: article.eventId,
    commodity: article.commodity, title: article.title, description: article.description,
    source: article.source, url: article.url, sentAt: article.sentAt
  }));

  const sourceFailures = fetchResult.sourceStats.filter((source) => source.status !== 'OK').length;
  const sendFailures = telegramFailures + kakaoFailures;
  const runStats = {
    fetched: normalized.length,
    relevant: relevant.length,
    duplicates: duplicates.length,
    analyzed: ranked.length,
    ruleAnalyzed: ruleAnalyzed.length,
    codexPending: queueState.counts.PENDING,
    sent: successfulIds.size,
    failed: sourceFailures + sendFailures
  };
  const statuses = {
    nextScheduledRun: nextScheduledRun(now, settings.agentIntervalMinutes),
    agentStatus: sourceFailures === sources.length ? 'DEGRADED' : sendFailures ? 'DEGRADED' : 'OK',
    telegramStatus: !settings.enableTelegram ? 'DISABLED' : dryRun ? 'DRY_RUN' : !telegramConfigured ? 'NOT_CONFIGURED' : telegramFailures ? 'ERROR' : 'OK',
    kakaoStatus: !settings.enableKakao ? 'DISABLED' : dryRun ? 'DRY_RUN' : !kakaoConfigured ? 'NOT_CONFIGURED' : kakaoFailures ? 'ERROR' : 'OK',
    intelligenceMode: 'RULE_ONLY',
    codexQueue: queueState.counts
  };

  if (options.persist ?? !dryRun) {
    await Promise.all([
      writeJsonAtomic(paths.sentItems, { items: [...newSentItems, ...retainedSent] }),
      writeCodexQueue(queueState),
      updateDashboardData({ articles: dashboardArticles, sourceStats: fetchResult.sourceStats, runStats, statuses, settings, commodities, now })
    ]);
  }
  logger.info('Agent run completed', { dryRun, ...runStats });
  return { dryRun, articles: dashboardArticles, eligible, runStats, statuses, sourceStats: fetchResult.sourceStats, queue: queueState };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  runAgent().catch((error) => {
    logger.error('Agent run failed', error.stack || error.message);
    process.exitCode = 1;
  });
}
