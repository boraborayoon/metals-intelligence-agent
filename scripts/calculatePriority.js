const SUPPLY_RISK_SIGNALS = new Set(['Production Down', 'Mine Closure', 'Smelter Cut', 'Supply Disruption', 'Export Ban', 'Export Restriction', 'Supply Shortage Risk', 'Logistics Risk']);

export function calculatePriority(article, weights, now = new Date()) {
  const importance = weights.importance[article.importance] ?? 0;
  const relevance = Math.min(weights.maxRelevanceContribution, article.relevanceScore || 0);
  const ageHours = article.publishedAt ? Math.max(0, (now.getTime() - Date.parse(article.publishedAt)) / 3_600_000) : Infinity;
  const recency = ageHours <= 6
    ? weights.recency.under6Hours
    : ageHours <= 24
      ? weights.recency.under24Hours
      : ageHours <= 72 ? weights.recency.under72Hours : 0;
  const supplyRisk = article.signals?.some((signal) => SUPPLY_RISK_SIGNALS.has(signal)) ? weights.supplyRisk : 0;
  const urgent = article.urgent ? weights.urgent : 0;
  return importance + relevance + recency + supplyRisk + urgent;
}

export function rankByPriority(articles, weights, now = new Date()) {
  return articles
    .map((article) => ({ ...article, priority: calculatePriority(article, weights, now) }))
    .sort((a, b) => b.priority - a.priority || Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
}
