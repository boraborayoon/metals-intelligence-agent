import { normalizeTitle, sha256 } from './normalizeNews.js';

const STOP_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'is', 'of', 'on', 'the', 'to', 'with', 'says', 'said', 'major']);

function tokens(title) {
  return new Set(normalizeTitle(title).split(/\s+/).filter((token) => token && !STOP_WORDS.has(token)));
}

export function titleSimilarity(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return (2 * intersection) / (a.size + b.size);
}

export function createDuplicateHash(article) {
  return article.id || sha256(`${normalizeTitle(article.title)}|${String(article.source).toLowerCase()}`);
}

const numericFacts = (value = '') => new Set(value.match(/\b\d+(?:\.\d+)?%?\b/g) || []);

function hasMeaningfulUpdate(article, previous) {
  const currentNumbers = numericFacts(`${article.title} ${article.description}`);
  const previousNumbers = numericFacts(`${previous.title} ${previous.description || ''}`);
  if ([...currentNumbers].some((number) => !previousNumbers.has(number))) return true;
  return /\b(update|restart|resume|agreement|settlement|extended|revised|new guidance)\b/i.test(article.title)
    && !/\b(update|restart|resume|agreement|settlement|extended|revised|new guidance)\b/i.test(previous.title);
}

function isSemanticDuplicate(article, previous, threshold) {
  if (article.commodity && previous.commodity && article.commodity !== previous.commodity) return false;
  return titleSimilarity(article.title, previous.title) >= threshold && !hasMeaningfulUpdate(article, previous);
}

export function deduplicate(articles, sentItems = [], threshold = 0.66) {
  const exactSent = new Set(sentItems.flatMap((item) => [item.id, item.titleSourceHash]).filter(Boolean));
  const unique = [];
  const duplicates = [];

  const sorted = [...articles].sort((a, b) => Date.parse(b.publishedAt || b.fetchedAt) - Date.parse(a.publishedAt || a.fetchedAt));
  for (const article of sorted) {
    const exactHash = createDuplicateHash(article);
    const exactDuplicate = exactSent.has(exactHash) || exactSent.has(article.titleSourceHash);
    const semanticAgainstSent = sentItems.some((item) => isSemanticDuplicate(article, item, threshold));
    const semanticInBatch = unique.find((kept) => isSemanticDuplicate(article, kept, threshold));
    if (exactDuplicate || semanticAgainstSent || semanticInBatch) {
      duplicates.push({ article, reason: exactDuplicate ? 'EXACT' : 'SIMILAR_EVENT' });
    } else {
      unique.push(article);
    }
  }
  return { unique, duplicates };
}
