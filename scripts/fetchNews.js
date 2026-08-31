import Parser from 'rss-parser';
import { logger } from './lib/logger.js';

const parser = new Parser({ customFields: { item: ['source'] } });

async function fetchSource(source, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'user-agent': 'MetalsIntelligenceAgent/1.0 (+RSS reader)' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const feed = await parser.parseString(await response.text());
    return {
      articles: feed.items.map((item) => ({ ...item, feedSource: source.name, language: source.language })),
      stat: { name: source.name, status: 'OK', count: feed.items.length }
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchNews(sources, timeoutMs = 12000) {
  const results = await Promise.allSettled(sources.map((source) => fetchSource(source, timeoutMs)));
  const articles = [];
  const sourceStats = [];
  results.forEach((result, index) => {
    const source = sources[index];
    if (result.status === 'fulfilled') {
      articles.push(...result.value.articles);
      sourceStats.push(result.value.stat);
      logger.info(`Fetched ${result.value.articles.length} items`, source.name);
    } else {
      const message = result.reason?.name === 'AbortError' ? 'Timeout' : result.reason?.message ?? 'Unknown error';
      sourceStats.push({ name: source.name, status: 'ERROR', count: 0, error: message });
      logger.warn('Source failed; continuing', { source: source.name, error: message });
    }
  });
  return { articles, sourceStats };
}
