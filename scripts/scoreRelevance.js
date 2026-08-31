const MARKET_TERMS = [
  'price', 'premium', 'supply', 'demand', 'inventory', 'stockpile', 'production', 'capacity',
  'mine', 'mining', 'smelter', 'refinery', 'export', 'import', 'tariff', 'sanction', 'strike',
  'accident', 'disruption', 'shortage', 'surplus', 'warehouse', 'lead time', 'output',
  '가격', '공급', '수요', '재고', '생산', '광산', '제련', '수출', '수입', '관세', '파업', '사고', '차질'
];

const GENERIC_TERMS = new Set(['copper', 'aluminum', 'aluminium', 'tin', 'ferroalloy', 'ferro alloy', 'moly', 'molybdenum', '구리', '알루미늄', '주석', '철합금', '몰리브덴']);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function countTerm(text, term) {
  if (!text || !term) return 0;
  const escaped = escapeRegExp(term.normalize('NFKC').toLowerCase());
  const asciiEdges = /^[a-z0-9]/i.test(term) && /[a-z0-9]$/i.test(term);
  const pattern = asciiEdges ? `(?<![a-z0-9])${escaped}(?![a-z0-9])` : escaped;
  return [...text.normalize('NFKC').toLowerCase().matchAll(new RegExp(pattern, 'giu'))].length;
}

const matchedTerms = (text, terms) => terms.filter((term) => countTerm(text, term) > 0);

export function commodityExclusionReason(article, commodity) {
  const combined = `${article.title || ''} ${article.description || article.summary || ''}`;
  const keywordMatches = matchedTerms(combined, commodity.keywords || []);
  const ambiguous = new Set((commodity.ambiguousKeywords || []).map((term) => term.normalize('NFKC').toLowerCase()));
  const ambiguousOnly = keywordMatches.length > 0 && keywordMatches.every((term) => ambiguous.has(term.normalize('NFKC').toLowerCase()));
  if (!ambiguousOnly) return null;
  return matchedTerms(combined, commodity.exclusionPatterns || [])[0] || null;
}

export function scoreForCommodity(article, commodity) {
  const title = article.title || '';
  const description = article.description || '';
  const combined = `${title} ${description}`;
  const titleKeywords = matchedTerms(title, commodity.keywords);
  const descriptionKeywords = matchedTerms(description, commodity.keywords);
  const companies = matchedTerms(combined, commodity.companies || []);
  const regions = matchedTerms(combined, commodity.regions || []);
  const marketTerms = matchedTerms(combined, MARKET_TERMS);
  const exclusionReason = commodityExclusionReason(article, commodity);

  if (exclusionReason) {
    return {
      commodity: commodity.id,
      score: 0,
      matchedKeywords: [...new Set([...titleKeywords, ...descriptionKeywords])],
      matchedCompanies: companies,
      matchedRegions: regions,
      matchedMarketTerms: marketTerms,
      exclusionReason
    };
  }

  let score = 0;
  if (titleKeywords.length) score += 5 + Math.min(3, titleKeywords.length - 1);
  if (descriptionKeywords.length) score += 2 + Math.min(2, descriptionKeywords.length - 1);
  if (companies.length && (titleKeywords.length || descriptionKeywords.length)) score += 2;
  if (regions.length && (titleKeywords.length || descriptionKeywords.length)) score += 1;
  if (marketTerms.length) score += 2;

  const occurrences = commodity.keywords.reduce(
    (total, keyword) => total + countTerm(title, keyword) + countTerm(description, keyword), 0
  );
  if (occurrences >= 3) score += Math.min(3, occurrences - 2);

  const allKeywordMatches = [...new Set([...titleKeywords, ...descriptionKeywords])];
  const genericOnly = allKeywordMatches.length === 1 && GENERIC_TERMS.has(allKeywordMatches[0].toLowerCase());
  if (genericOnly && !companies.length && !regions.length && !marketTerms.length) score -= 3;

  return {
    commodity: commodity.id,
    score: Math.max(0, score),
    matchedKeywords: allKeywordMatches,
    matchedCompanies: companies,
    matchedRegions: regions,
    matchedMarketTerms: marketTerms,
    exclusionReason: null
  };
}

export function scoreArticleRelevance(article, commodities) {
  const commodityScores = Object.values(commodities)
    .map((commodity) => scoreForCommodity(article, commodity))
    .filter((result) => result.matchedKeywords.length)
    .sort((a, b) => b.score - a.score);
  const primary = commodityScores[0];
  return {
    ...article,
    commodity: primary?.commodity ?? null,
    relevanceScore: primary?.score ?? 0,
    matchedKeywords: primary?.matchedKeywords ?? [],
    matchedCompanies: primary?.matchedCompanies ?? [],
    matchedRegions: primary?.matchedRegions ?? [],
    matchedMarketTerms: primary?.matchedMarketTerms ?? [],
    exclusionReason: primary?.exclusionReason ?? null,
    commodityMatches: commodityScores
  };
}

export function scoreRelevance(articles, commodities) {
  return articles.map((article) => scoreArticleRelevance(article, commodities));
}
