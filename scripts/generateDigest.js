import { formatKst } from './lib/time.js';
import { escapeHtml } from './formatTelegram.js';

export const COMMODITY_ORDER = ['COPPER', 'ALUMINUM', 'TIN', 'FERRO_ALLOY', 'MOLYBDENUM'];
const IMPORTANCE_ICON = { HIGH: '🔴', MEDIUM: '🟠', LOW: '⚪' };
const MARKET_ICON = { Bullish: '🔺', Bearish: '🔻', Neutral: '➖', Unclear: '❓' };

function resolveDirectional(items, field, positive, negative, neutralValue = 'Neutral') {
  const weighted = { positive: 0, negative: 0 };
  for (const item of items) {
    const weight = item.importance === 'HIGH' ? 3 : item.importance === 'MEDIUM' ? 2 : 1;
    if (positive.includes(item[field])) weighted.positive += weight;
    if (negative.includes(item[field])) weighted.negative += weight;
  }
  if (!weighted.positive && !weighted.negative) return 'Unclear';
  if (weighted.positive && weighted.negative && Math.max(weighted.positive, weighted.negative) / Math.min(weighted.positive, weighted.negative) < 1.8) return 'Unclear';
  if (weighted.positive === weighted.negative) return neutralValue;
  return weighted.positive > weighted.negative ? positive[0] : negative[0];
}

function signalFromArticles(items, tighteningSignals, looseningSignals, values) {
  const tightening = items.filter((item) => item.signals?.some((signal) => tighteningSignals.includes(signal))).length;
  const loosening = items.filter((item) => item.signals?.some((signal) => looseningSignals.includes(signal))).length;
  if (!tightening && !loosening) return 'UNCLEAR';
  if (tightening && loosening) return 'UNCLEAR';
  return tightening ? values[0] : values[1];
}

export function createMarketSummaries(articles, generatedAt = new Date()) {
  return COMMODITY_ORDER.map((commodity) => {
    const items = articles.filter((article) => article.commodity === commodity);
    if (!items.length) {
      return { commodity, overallMarketBias: 'Unclear', procurementRisk: 'UNCLEAR', mainDriver: 'Insufficient Data', supplySignal: 'UNCLEAR', demandSignal: 'UNCLEAR', inventorySignal: 'UNCLEAR', summaryKo: '분석할 데이터가 충분하지 않습니다.' };
    }
    const overallMarketBias = resolveDirectional(items, 'marketImpact', ['Bullish'], ['Bearish']);
    const negativeProcurement = items.filter((item) => item.procurementImpact === 'NEGATIVE');
    const procurementRisk = negativeProcurement.some((item) => item.importance === 'HIGH')
      ? 'HIGH' : negativeProcurement.length ? 'MEDIUM' : items.some((item) => item.procurementImpact === 'NEUTRAL' || item.procurementImpact === 'POSITIVE') ? 'LOW' : 'UNCLEAR';
    const supplySignal = signalFromArticles(items,
      ['Production Down', 'Mine Closure', 'Smelter Cut', 'Supply Disruption', 'Export Ban', 'Export Restriction'],
      ['Production Up', 'Mine Restart', 'Smelter Restart', 'New Capacity'], ['TIGHTENING', 'LOOSENING']);
    const demandSignal = signalFromArticles(items, ['Demand Up', 'China Demand', 'EV Demand', 'Construction Demand', 'Manufacturing Demand'], ['Demand Down'], ['STRENGTHENING', 'WEAKENING']);
    const inventorySignal = signalFromArticles(items, ['Inventory Up', 'Warehouse Inflow'], ['Inventory Down', 'Warehouse Outflow'], ['RISING', 'DECLINING']);
    const mainDriver = [...items].sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    return {
      commodity,
      overallMarketBias,
      procurementRisk,
      mainDriver: mainDriver.titleKo || mainDriver.title,
      supplySignal,
      demandSignal,
      inventorySignal,
      summaryKo: `${items.length}건의 기사 근거를 종합했습니다. 시장 방향 ${overallMarketBias}, 공급 ${supplySignal}, 구매 위험 ${procurementRisk}.`,
      generatedAt: generatedAt instanceof Date ? generatedAt.toISOString() : generatedAt
    };
  });
}

export function generateDigest(articles, summaries, generatedAt = new Date()) {
  const sections = COMMODITY_ORDER.map((commodity) => {
    const items = articles
      .filter((article) => article.commodity === commodity && article.importance !== 'LOW')
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, 2);
    const summary = summaries.find((item) => item.commodity === commodity);
    const news = items.length ? items.map((item) => `
${IMPORTANCE_ICON[item.importance]} <b>${item.importance}</b>
${escapeHtml(Array.from(item.titleKo || item.title).slice(0, 160).join(''))}
Market: ${item.marketImpact} ${MARKET_ICON[item.marketImpact]}
Procurement: ${item.procurementImpact}`).join('\n') : '\nNo major news';
    return `<b>${escapeHtml(commodity.replace('_', ' '))}</b>${news}

Signal: ${summary?.overallMarketBias || 'Unclear'} | Supply: ${summary?.supplySignal || 'UNCLEAR'} | Procurement: ${summary?.procurementRisk || 'UNCLEAR'}`;
  });

  return `<b>📊 METALS MARKET INTELLIGENCE</b>
${formatKst(generatedAt)}

━━━━━━━━━━━━

${sections.join('\n\n━━━━━━━━━━━━\n\n')}`;
}
