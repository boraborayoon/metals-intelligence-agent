import { applyEffectiveAnalysis } from './analysisModel.js';

const CATEGORY_PATTERNS = {
  PRICE: ['price', 'premium', '가격', '프리미엄'], SUPPLY: ['supply', 'shortage', 'surplus', '공급', '부족'],
  DEMAND: ['demand', 'consumption', '수요', '소비'], INVENTORY: ['inventory', 'stockpile', 'warehouse stock', '재고', '비축'],
  MINE: ['mine', 'mining', 'ore grade', '광산', '광업', '품위'], SMELTER: ['smelter', 'smelting', 'treatment charge', '제련소', '제련', '제련수수료'],
  REFINERY: ['refinery', 'refining', '정련소', '정련'], PRODUCTION: ['production', 'output', '생산량', '생산', '가이던스'],
  DISRUPTION: ['disruption', 'halt', 'shutdown', 'stoppage', 'suspend', 'force majeure', 'curtailment', '차질', '중단', '가동 중단', '불가항력', '전력 제한'],
  STRIKE: ['strike', 'walkout', '파업'], ACCIDENT: ['accident', 'collapse', 'explosion', 'fatality', 'flood', 'earthquake', '사고', '붕괴', '폭발', '홍수', '지진'],
  LOGISTICS: ['port', 'rail', 'shipping', 'freight', 'logistics', '항구', '철도', '운송', '물류'], EXPORT: ['export', '수출'], IMPORT: ['import', '수입'],
  TRADE: ['trade', 'quota', '무역', '쿼터'], TARIFF: ['tariff', 'duty', '관세'], SANCTION: ['sanction', '제재'],
  POLICY: ['policy', 'government', 'ministry', 'stimulus', '정책', '정부', '부양책'], REGULATION: ['regulation', 'rule change', 'permit', 'restriction', 'ban', '규정', '규제', '허가', '제한', '금지'],
  CHINA: ['china', 'chinese', '중국'], COMPANY: ['company', 'producer', 'corporation', '기업', '생산업체'], EARNINGS: ['earnings', 'profit', 'quarterly result', '실적', '이익'],
  GUIDANCE: ['guidance', 'outlook', '전망치', '가이던스'], 'M&A': ['acquisition', 'merger', 'takeover', '인수', '합병'], PROJECT: ['project', 'feasibility', 'development study', '개발 사업', '프로젝트'],
  CAPACITY: ['capacity', 'expansion', 'new plant', '증설', '생산능력'], ENERGY: ['power', 'electricity', 'energy', '전력', '에너지'],
  FX: ['currency', 'exchange rate', 'dollar', '환율', '달러'], MACRO: ['inflation', 'interest rate', 'recession', 'gdp', 'manufacturing pmi', '인플레이션', '금리', '경기 침체', '국내총생산']
};

const DEFAULT_MARKET_SIGNALS = {
  supplyBullish: ['mine shutdown', 'mine closure', 'production halt', 'production cut', 'output cut', 'supply disruption', 'shortage', 'strike', 'accident', 'export ban', 'export restriction', 'sanction', 'smelter shutdown', 'smelter cut', 'force majeure', 'logistics disruption', '광산 폐쇄', '생산 중단', '감산', '공급 차질', '공급 부족', '파업', '사고', '수출 금지', '수출 제한', '제재', '제련소 가동 중단', '제련소 감산', '불가항력', '물류 차질'],
  supplyBearish: ['mine expansion', 'new mine', 'production increase', 'output increase', 'mine restart', 'smelter restart', 'capacity expansion', 'new capacity', 'export increase', '광산 확장', '신규 광산', '생산 증가', '광산 재가동', '제련소 재가동', '증설', '생산능력 확대', '수출 증가'],
  demandBullish: ['demand increase', 'demand rises', 'ev demand increase', 'grid investment', 'construction recovery', 'manufacturing recovery', 'china stimulus', '수요 증가', '전기차 수요 증가', '전력망 투자', '건설 회복', '제조업 회복', '중국 부양책'],
  demandBearish: ['demand decline', 'demand falls', 'demand slowdown', 'recession', 'construction slowdown', 'manufacturing contraction', '수요 감소', '수요 둔화', '경기 침체', '건설 둔화', '제조업 위축'],
  inventoryBullish: ['inventory decline', 'inventory fell', 'inventory drops', 'stockpile depletion', 'warehouse outflow', '재고 감소', '재고 급감', '비축량 고갈', '창고 유출'],
  inventoryBearish: ['inventory increase', 'inventory rose', 'inventory rises', 'warehouse inflow', '재고 증가', '재고 급증', '창고 유입']
};

const OPINION_PATTERNS = ['expects price', 'price will', 'price could', 'price may', 'forecast price', 'predicts price', '가격이 오를', '가격 상승 전망', '가격 하락 전망'];
const EXPLICIT_UNCERTAINTY_PATTERNS = ['effect on output is not yet known', 'impact on output is not yet known', 'production impact is unclear', 'supply impact is unclear', 'effect on production remains unknown', '생산 영향은 아직 알려지지', '생산 영향 불명확', '공급 영향 불명확'];
const PRIMARY_CATEGORY = [['STRIKE', 'Labor Disruption'], ['ACCIDENT', 'Operational Accident'], ['DISRUPTION', 'Supply Disruption'], ['SANCTION', 'Sanctions'], ['TARIFF', 'Tariff'], ['REGULATION', 'Regulation'], ['POLICY', 'Government Policy'], ['INVENTORY', 'Inventory'], ['GUIDANCE', 'Production Guidance'], ['CAPACITY', 'Capacity'], ['DEMAND', 'Demand'], ['SUPPLY', 'Supply'], ['PRODUCTION', 'Production'], ['MINE', 'Mine'], ['SMELTER', 'Smelter']];
const normalize = (value = '') => String(value).normalize('NFKC').toLowerCase();
const includesAny = (text, patterns = []) => patterns.some((pattern) => text.includes(normalize(pattern)));
const matchingPatterns = (text, patterns = []) => patterns.filter((pattern) => text.includes(normalize(pattern)));
const unique = (values) => [...new Set(values)];

function mergeRuleArrays(common = {}, commodity = {}) {
  const marketSignals = {};
  for (const key of Object.keys(DEFAULT_MARKET_SIGNALS)) marketSignals[key] = unique([...(DEFAULT_MARKET_SIGNALS[key] || []), ...(common.marketSignals?.[key] || []), ...(commodity.marketSignals?.[key] || [])]);
  return { marketSignals, highImpactPatterns: unique([...(common.highImpactPatterns || []), ...(commodity.highImpactPatterns || [])]), urgentPatterns: unique([...(common.urgentPatterns || []), ...(commodity.urgentPatterns || [])]), reviewPatterns: unique([...(common.reviewPatterns || []), ...(commodity.reviewPatterns || [])]) };
}

export function classifyCategories(article) {
  const text = normalize(`${article.title} ${article.description}`);
  const categories = Object.entries(CATEGORY_PATTERNS).filter(([, patterns]) => includesAny(text, patterns)).map(([category]) => category);
  return categories.length ? categories : ['COMPANY'];
}

function detectSubCommodity(article, commodityConfig) {
  if (!commodityConfig?.subCommodities) return null;
  const text = normalize(`${article.title} ${article.description}`);
  return Object.entries(commodityConfig.subCommodities).find(([, patterns]) => includesAny(text, patterns))?.[0] ?? null;
}

function isOpinionOnly(text, concretePatterns) { return includesAny(text, OPINION_PATTERNS) && !includesAny(text, concretePatterns); }
function isSimplePriceMove(text, categories) { return /(?:rose|fell|up|down|gained|lost|상승|하락)\s*(?:by\s*)?0?[.,]\d+\s*%/i.test(text) && categories.every((category) => ['PRICE', 'COMPANY'].includes(category)); }

function classifyMarket(text, signalRules, categories) {
  const evidence = Object.fromEntries(Object.entries(signalRules).map(([key, patterns]) => [key, matchingPatterns(text, patterns)]));
  const bullish = [...evidence.supplyBullish, ...evidence.demandBullish, ...evidence.inventoryBullish];
  const bearish = [...evidence.supplyBearish, ...evidence.demandBearish, ...evidence.inventoryBearish];
  if (includesAny(text, EXPLICIT_UNCERTAINTY_PATTERNS) || isOpinionOnly(text, Object.values(signalRules).flat()) || isSimplePriceMove(text, categories)) return { impact: 'Unclear', conflicting: false, evidence };
  if (bullish.length && bearish.length) return { impact: 'Unclear', conflicting: true, evidence };
  if (bullish.length) return { impact: 'Bullish', conflicting: false, evidence };
  if (bearish.length) return { impact: 'Bearish', conflicting: false, evidence };
  return { impact: 'Unclear', conflicting: false, evidence };
}

function classifyImportance(article, categories, text, rules, market) {
  if (isOpinionOnly(text, Object.values(rules.marketSignals).flat()) || isSimplePriceMove(text, categories)) return 'LOW';
  const major = includesAny(text, ['major', 'large', 'large-scale', 'significant', 'record', 'sharp', 'plunge', 'surge', '대형', '대규모', '대폭', '급감', '급증', '사상 최대', '사상 최저']);
  const supplyAsset = categories.some((category) => ['MINE', 'SMELTER', 'REFINERY', 'PRODUCTION'].includes(category));
  const materialDisruption = categories.some((category) => ['DISRUPTION', 'STRIKE', 'ACCIDENT'].includes(category)) && supplyAsset && (major || article.matchedRegions?.length || article.matchedCompanies?.length);
  const policyShock = categories.includes('SANCTION') || (categories.some((category) => ['POLICY', 'REGULATION'].includes(category)) && includesAny(text, ['ban', 'restriction', 'quota', 'sanction', 'intervention', '금지', '제한', '쿼터', '제재', '개입']));
  const tariffPercent = Number.parseFloat(text.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] || '0');
  const tariffShock = categories.includes('TARIFF') && (major || tariffPercent >= 20);
  const highMagnitude = (categories.includes('INVENTORY') || categories.includes('CAPACITY') || categories.includes('GUIDANCE')) && major;
  if (includesAny(text, rules.highImpactPatterns) || materialDisruption || policyShock || tariffShock || highMagnitude) return 'HIGH';
  if (market.impact !== 'Unclear' || categories.some((category) => ['SUPPLY', 'DEMAND', 'INVENTORY', 'PRODUCTION', 'CAPACITY', 'EXPORT', 'IMPORT', 'TRADE', 'TARIFF', 'GUIDANCE', 'EARNINGS', 'M&A', 'PROJECT'].includes(category))) return 'MEDIUM';
  return article.relevanceScore >= 9 ? 'MEDIUM' : 'LOW';
}

function marketReason(market) {
  if (market.conflicting) return '기사에 가격 상승·하락 방향의 근거가 동시에 있어 규칙만으로 단일 방향을 확정하지 않았습니다.';
  if (market.impact === 'Bullish') return '공급 축소, 수요 증가 또는 재고 감소를 나타내는 명시적 사건 근거를 확인했습니다.';
  if (market.impact === 'Bearish') return '공급 확대, 수요 둔화 또는 재고 증가를 나타내는 명시적 사건 근거를 확인했습니다.';
  return '기사에 가격 방향을 판단할 충분하고 명확한 사건 근거가 없어 Unclear로 처리했습니다.';
}
function procurementImpact(marketImpact) { return marketImpact === 'Bullish' ? 'NEGATIVE' : marketImpact === 'Bearish' ? 'POSITIVE' : marketImpact === 'Neutral' ? 'NEUTRAL' : 'UNCLEAR'; }
function procurementReason(impact) { return impact === 'NEGATIVE' ? '공급 축소 또는 가격 상승 압력은 구매비용, 리드타임, 공급 안정성에 불리할 수 있습니다.' : impact === 'POSITIVE' ? '공급 확대 또는 가격 하락 압력은 구매조건과 가용성에 유리할 수 있습니다.' : impact === 'NEUTRAL' ? '확인된 요인이 구매조건에 미치는 순효과가 제한적입니다.' : '구매비용, 리드타임 또는 공급 위험에 대한 방향성 근거가 충분하지 않습니다.'; }

function detectSignals(market, categories) {
  const signals = [];
  if (market.evidence.supplyBullish.length) signals.push('Supply Tightening', 'Supply Disruption', 'Price Increase Risk');
  if (market.evidence.supplyBearish.length) signals.push('Supply Loosening', 'New Capacity', 'Price Decline Opportunity');
  if (market.evidence.demandBullish.length) signals.push('Demand Up');
  if (market.evidence.demandBearish.length) signals.push('Demand Down');
  if (market.evidence.inventoryBullish.length) signals.push('Inventory Down');
  if (market.evidence.inventoryBearish.length) signals.push('Inventory Up');
  if (categories.includes('EXPORT') && categories.includes('REGULATION')) signals.push('Export Restriction');
  if (categories.includes('SANCTION')) signals.push('Sanctions');
  if (categories.includes('LOGISTICS') && categories.includes('DISRUPTION')) signals.push('Logistics Risk');
  return unique(signals);
}

function timeHorizon(categories, text) {
  if (categories.some((category) => ['ACCIDENT', 'STRIKE', 'DISRUPTION', 'SANCTION'].includes(category))) return 'IMMEDIATE';
  if (categories.includes('CAPACITY') || categories.includes('PROJECT')) return includesAny(text, ['year', '2027', '2028', '2029', '2030', '장기']) ? 'LONG_TERM' : 'MEDIUM_TERM';
  if (categories.some((category) => ['PRICE', 'INVENTORY', 'EXPORT', 'IMPORT'].includes(category))) return 'SHORT_TERM';
  return 'UNCLEAR';
}

export function classifyRuleBased(article, commodities, configuredRules = {}) {
  const commodityConfig = Object.values(commodities).find((commodity) => commodity.id === article.commodity);
  const rules = mergeRuleArrays(configuredRules.common, configuredRules.commodities?.[article.commodity]);
  const categories = classifyCategories(article);
  const text = normalize(`${article.title} ${article.description}`);
  const market = classifyMarket(text, rules.marketSignals, categories);
  const importance = classifyImportance(article, categories, text, rules, market);
  const procurement = procurementImpact(market.impact);
  const primaryCategory = PRIMARY_CATEGORY.find(([category]) => categories.includes(category))?.[1] || 'General';
  const keyEvidence = unique(Object.values(market.evidence).flat()).slice(0, 8);
  return applyEffectiveAnalysis({
    ...article, subCommodity: detectSubCommodity(article, commodityConfig), importance, categories, primaryCategory,
    titleKo: article.title, summaryKo: article.description || article.title, marketImpact: market.impact,
    impactReasonKo: marketReason(market), procurementImpact: procurement, procurementReasonKo: procurementReason(procurement),
    regions: article.matchedRegions || [], companies: article.matchedCompanies || [], timeHorizon: timeHorizon(categories, text),
    confidence: keyEvidence.length && !market.conflicting ? 'MEDIUM' : 'LOW', signals: detectSignals(market, categories), keyEvidence,
    conflictingSignals: market.conflicting, codexReviewEvent: includesAny(text, rules.reviewPatterns) || includesAny(text, rules.highImpactPatterns),
    urgent: importance === 'HIGH' && includesAny(text, rules.urgentPatterns), analysisMode: 'RULE_BASED', analysisSource: 'RULE'
  });
}
