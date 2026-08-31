import { paths } from './lib/paths.js';
import { readJson, writeJsonAtomic } from './lib/jsonStore.js';
import { createMarketSummaries } from './generateDigest.js';
import { applyEffectiveAnalysis } from './analysisModel.js';
import { scoreArticleRelevance } from './scoreRelevance.js';

const ageInDays = (iso, now) => (now.getTime() - Date.parse(iso || 0)) / 86_400_000;

function kstDateKey(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export function mergeDashboardNews(existingItems, newItems, settings, now = new Date(), commodities = null) {
  const byId = new Map();
  [...newItems, ...existingItems].forEach((item) => {
    if (!byId.has(item.id)) byId.set(item.id, item);
  });
  return [...byId.values()]
    .filter((item) => !commodities || !scoreArticleRelevance(item, commodities).exclusionReason)
    .map((item) => applyEffectiveAnalysis(item, item.codexAnalysis))
    .filter((item) => ageInDays(item.publishedAt || item.fetchedAt, now) <= settings.dashboardNewsRetentionDays)
    .sort((a, b) => Date.parse(b.publishedAt || b.fetchedAt) - Date.parse(a.publishedAt || a.fetchedAt))
    .slice(0, settings.dashboardMaxItems);
}

export function pruneSentItems(items, retentionDays, now = new Date()) {
  return items.filter((item) => ageInDays(item.sentAt, now) <= retentionDays);
}

export async function updateDashboardData({ articles, sourceStats, runStats, statuses, settings, commodities, now = new Date() }) {
  const existing = await readJson(paths.latestNews, { generatedAt: null, items: [] });
  const merged = mergeDashboardNews(existing.items || [], articles, settings, now, commodities);
  const todayKey = kstDateKey(now);
  const todayItems = merged.filter((item) => kstDateKey(item.publishedAt || item.fetchedAt) === todayKey);
  const summaries = createMarketSummaries(todayItems, now);
  const generatedAt = now.toISOString();

  await Promise.all([
    writeJsonAtomic(paths.latestNews, { generatedAt, items: merged }),
    writeJsonAtomic(paths.marketSummary, { generatedAt, summaries }),
    writeJsonAtomic(paths.status, {
      lastUpdated: generatedAt,
      nextScheduledRun: statuses.nextScheduledRun,
      agentStatus: statuses.agentStatus,
      telegramStatus: statuses.telegramStatus,
      kakaoStatus: statuses.kakaoStatus,
      intelligenceMode: statuses.intelligenceMode,
      codexQueue: statuses.codexQueue,
      sourceStats,
      runStats
    })
  ]);
  return { merged, summaries };
}
