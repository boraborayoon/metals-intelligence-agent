const IMPORTANCE_VALUES = new Set(['HIGH', 'MEDIUM', 'LOW']);
const MARKET_VALUES = new Set(['Bullish', 'Bearish', 'Neutral', 'Unclear']);
const PROCUREMENT_VALUES = new Set(['NEGATIVE', 'POSITIVE', 'NEUTRAL', 'UNCLEAR']);
const CONFIDENCE_VALUES = new Set(['HIGH', 'MEDIUM', 'LOW']);

const uniqueStrings = (values = []) => [...new Set(values.filter(Boolean).map(String))];
const asArray = (value) => Array.isArray(value) ? uniqueStrings(value) : value ? [String(value)] : [];

export function createRuleAnalysis(article) {
  const categories = uniqueStrings(article.categories || []);
  const regions = uniqueStrings(article.regions || article.matchedRegions || []);
  return {
    importance: IMPORTANCE_VALUES.has(article.importance) ? article.importance : 'LOW',
    marketImpact: MARKET_VALUES.has(article.marketImpact) ? article.marketImpact : 'Unclear',
    procurementImpact: PROCUREMENT_VALUES.has(article.procurementImpact) ? article.procurementImpact : 'UNCLEAR',
    category: article.primaryCategory || categories[0] || 'General',
    categories,
    region: regions[0] || 'Unclear',
    regions,
    summary: article.summaryKo || article.description || article.title,
    marketImpactReason: article.impactReasonKo || 'Insufficient evidence.',
    procurementImpactReason: article.procurementReasonKo || 'Insufficient evidence.',
    keyEvidence: uniqueStrings(article.keyEvidence || article.signals || []),
    confidence: CONFIDENCE_VALUES.has(article.confidence) ? article.confidence : 'LOW',
    timeHorizon: article.timeHorizon || 'UNCLEAR',
    signals: uniqueStrings(article.signals || []),
    urgent: Boolean(article.urgent)
  };
}

export function normalizeCodexAnalysis(input, fallback = {}) {
  if (!input || typeof input !== 'object') throw new Error('Codex analysis must be an object');
  if (!IMPORTANCE_VALUES.has(input.importance)) throw new Error(`Invalid importance: ${input.importance}`);
  if (!MARKET_VALUES.has(input.marketImpact)) throw new Error(`Invalid marketImpact: ${input.marketImpact}`);
  if (!PROCUREMENT_VALUES.has(input.procurementImpact)) throw new Error(`Invalid procurementImpact: ${input.procurementImpact}`);
  if (!CONFIDENCE_VALUES.has(input.confidence)) throw new Error(`Invalid confidence: ${input.confidence}`);
  const categories = asArray(input.categories || input.category || fallback.categories);
  const regions = asArray(input.regions || (input.region && input.region !== 'Unclear' ? input.region : []) || fallback.regions);
  return {
    importance: input.importance,
    marketImpact: input.marketImpact,
    procurementImpact: input.procurementImpact,
    category: input.category || categories[0] || fallback.category || 'General',
    categories: categories.length ? categories : asArray(fallback.categories),
    region: input.region || regions[0] || fallback.region || 'Unclear',
    regions,
    summary: String(input.summary || fallback.summary || ''),
    marketImpactReason: String(input.marketImpactReason || input.reason || fallback.marketImpactReason || ''),
    procurementImpactReason: String(input.procurementImpactReason || fallback.procurementImpactReason || ''),
    keyEvidence: asArray(input.keyEvidence),
    confidence: input.confidence,
    timeHorizon: input.timeHorizon || fallback.timeHorizon || 'UNCLEAR',
    signals: asArray(input.signals || fallback.signals),
    urgent: input.urgent ?? fallback.urgent ?? false
  };
}

export function applyEffectiveAnalysis(article, codexAnalysis = article.codexAnalysis) {
  const ruleAnalysis = article.ruleAnalysis || createRuleAnalysis(article);
  const normalizedCodex = codexAnalysis ? normalizeCodexAnalysis(codexAnalysis, ruleAnalysis) : null;
  const effectiveAnalysis = normalizedCodex || ruleAnalysis;
  return {
    ...article,
    ruleAnalysis,
    codexAnalysis: normalizedCodex,
    effectiveAnalysis,
    analysisSource: normalizedCodex ? 'CODEX' : 'RULE',
    analysisMode: normalizedCodex ? 'CODEX' : 'RULE_BASED',
    importance: effectiveAnalysis.importance,
    marketImpact: effectiveAnalysis.marketImpact,
    procurementImpact: effectiveAnalysis.procurementImpact,
    primaryCategory: effectiveAnalysis.category,
    categories: effectiveAnalysis.categories,
    summaryKo: effectiveAnalysis.summary,
    impactReasonKo: effectiveAnalysis.marketImpactReason,
    procurementReasonKo: effectiveAnalysis.procurementImpactReason,
    regions: effectiveAnalysis.regions,
    confidence: effectiveAnalysis.confidence,
    timeHorizon: effectiveAnalysis.timeHorizon,
    signals: effectiveAnalysis.signals,
    urgent: effectiveAnalysis.urgent
  };
}

export const analysisEnums = {
  importance: [...IMPORTANCE_VALUES],
  marketImpact: [...MARKET_VALUES],
  procurementImpact: [...PROCUREMENT_VALUES],
  confidence: [...CONFIDENCE_VALUES]
};
