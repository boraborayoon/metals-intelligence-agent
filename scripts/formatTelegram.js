import { formatKst } from './lib/time.js';

const IMPORTANCE_ICON = { HIGH: '🔴', MEDIUM: '🟠', LOW: '⚪' };
const MARKET_ICON = { Bullish: '🔺', Bearish: '🔻', Neutral: '➖', Unclear: '❓' };

export function escapeHtml(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const truncate = (value, max) => Array.from(String(value)).slice(0, max).join('');

export function formatTelegramArticle(article) {
  const alert = article.urgent ? '<b>🚨 MARKET ALERT</b>\n\n' : '';
  const regions = article.regions?.length ? truncate(article.regions.join(', '), 200) : '확인 불가';
  const safeUrl = escapeHtml(article.url);
  const category = article.primaryCategory || article.categories?.[0] || 'General';
  const message = `${alert}<b>${IMPORTANCE_ICON[article.importance]} [${escapeHtml(article.commodity)} | ${article.importance}]</b>

<b>${escapeHtml(truncate(article.titleKo, 300))}</b>

<b>Market</b>
${article.marketImpact} ${MARKET_ICON[article.marketImpact]}

<b>Procurement</b>
${article.procurementImpact}

<b>Category</b>
${escapeHtml(category)}

<b>Region</b>
${escapeHtml(regions)}

<b>Summary</b>
${escapeHtml(truncate(article.summaryKo, 700))}

<b>Why it matters</b>
${escapeHtml(truncate(article.impactReasonKo, 600))}

${escapeHtml(truncate(article.procurementReasonKo, 600))}

<b>Source</b>
${escapeHtml(truncate(article.source, 100))}

<b>Published</b>
${formatKst(article.publishedAt)}

<b>Analysis</b>
${escapeHtml(article.analysisSource || 'RULE')}

<a href="${safeUrl}">Original ↗</a>`;
  return message;
}

export function formatTelegramDigest(digest) {
  return digest;
}
