import { createHash } from 'node:crypto';
import { toIso } from './lib/time.js';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function stripHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeUrl(rawUrl = '') {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach((key) => url.searchParams.delete(key));
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    url.searchParams.sort();
    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}

const synonymMap = new Map([
  ['chilean', 'chile'], ['peruvian', 'peru'], ['indonesian', 'indonesia'], ['myanmarese', 'myanmar'],
  ['halted', 'stop'], ['halts', 'stop'], ['halt', 'stop'], ['stopped', 'stop'], ['stops', 'stop'],
  ['shutdown', 'stop'], ['closure', 'close'], ['closed', 'close'], ['operation', 'mine'], ['operations', 'mine'],
  ['aluminium', 'aluminum'], ['ferro-alloy', 'ferroalloy']
]);

export function normalizeTitle(title = '') {
  return stripHtml(title)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[|–—:;,.!?()[\]{}'"“”‘’/\\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => synonymMap.get(token) ?? token)
    .join(' ');
}

function resolveSource(item, title) {
  const embedded = typeof item.source === 'string' ? item.source : item.source?._ ?? item.source?.title;
  if (embedded) return stripHtml(embedded);
  if (item.feedSource?.startsWith('Google News')) {
    const segments = title.split(' - ');
    if (segments.length > 1) return segments.at(-1).trim();
  }
  return item.creator || item.feedSource || 'Unknown';
}

export function normalizeArticle(item, fetchedAt = new Date()) {
  const rawTitle = stripHtml(item.title || 'Untitled');
  const source = resolveSource(item, rawTitle);
  const suffix = ` - ${source}`;
  const title = item.feedSource?.startsWith('Google News') && rawTitle.endsWith(suffix)
    ? rawTitle.slice(0, -suffix.length).trim()
    : rawTitle;
  const url = normalizeUrl(item.link || item.guid || '');
  const description = stripHtml(item.contentSnippet || item.content || item.summary || item.description || '');
  const normalizedTitle = normalizeTitle(title);
  return {
    id: sha256(url || `${normalizedTitle}|${source.toLowerCase()}`),
    titleSourceHash: sha256(`${normalizedTitle}|${source.toLowerCase()}`),
    eventId: sha256(normalizedTitle),
    title,
    normalizedTitle,
    description,
    source,
    feedSource: item.feedSource,
    publishedAt: toIso(item.isoDate || item.pubDate || item.published || item.updated),
    fetchedAt: toIso(fetchedAt),
    url,
    language: item.language || 'en'
  };
}

export function normalizeNews(items, fetchedAt = new Date()) {
  return items.map((item) => normalizeArticle(item, fetchedAt)).filter((item) => item.title && item.url);
}
