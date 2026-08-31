const IMPORTANCE = {
  HIGH: { icon: '🔴', label: '중요' },
  MEDIUM: { icon: '🟠', label: '보통' },
  LOW: { icon: '⚪', label: '낮음' }
};

const COMMODITY = {
  COPPER: '구리',
  ALUMINUM: '알루미늄',
  TIN: '주석',
  FERRO_ALLOY: '합금철',
  MOLYBDENUM: '몰리브덴'
};

const MARKET = { Bullish: '강세 ↑', Bearish: '약세 ↓', Neutral: '중립', Unclear: '불명확' };
const PROCUREMENT = { POSITIVE: '유리', NEGATIVE: '불리', NEUTRAL: '중립', UNCLEAR: '불명확' };
const CATEGORY = {
  'Operational Accident': '운영 사고',
  Disruption: '공급 차질',
  Strike: '파업',
  Sanction: '제재',
  Tariff: '관세',
  Policy: '정책',
  Regulation: '규제',
  Inventory: '재고',
  Guidance: '전망',
  Supply: '공급',
  Demand: '수요'
};

const clean = (value = '') => String(value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const truncate = (value, limit) => {
  const characters = Array.from(clean(value));
  return characters.length <= limit ? characters.join('') : `${characters.slice(0, Math.max(0, limit - 1)).join('')}…`;
};
const truncateMessage = (value, limit) => {
  const characters = Array.from(String(value));
  return characters.length <= limit ? characters.join('') : `${characters.slice(0, Math.max(0, limit - 1)).join('')}…`;
};

const extractUsefulSummary = (article, title) => {
  const source = clean(article.source);
  let summary = clean(article.summaryKo || article.description);
  if (!summary) return '';
  if (summary.startsWith(title)) summary = summary.slice(title.length).trim();
  if (source && summary.endsWith(source)) summary = summary.slice(0, -source.length).trim();
  return Array.from(summary).length >= 12 ? summary : '';
};

export function formatKakaoArticle(article) {
  const importance = IMPORTANCE[article.importance] || { icon: '⚪', label: article.importance || '일반' };
  const commodity = COMMODITY[article.commodity] || article.commodity || '금속';
  const categoryKey = article.primaryCategory || article.categories?.[0] || 'General';
  const category = CATEGORY[categoryKey] || categoryKey;
  const region = article.regions?.length ? article.regions.join(', ') : '지역 미상';
  const title = clean(article.titleKo || article.title || '제목 없음');
  const summary = extractUsefulSummary(article, title);
  const detail = summary ? `📝 ${truncate(summary, 58)}` : `📰 ${truncate(article.source || '출처 미상', 42)}`;
  const titleLimit = summary ? 72 : 98;

  const message = `${importance.icon} ${commodity} · ${importance.label}
${truncate(title, titleLimit)}

📊 시장 ${MARKET[article.marketImpact] || article.marketImpact || '불명확'} | 구매 ${PROCUREMENT[article.procurementImpact] || article.procurementImpact || '불명확'}
🏷 ${truncate(category, 18)} · ${truncate(region, 20)}
${detail}`;

  return truncateMessage(message, 200);
}
