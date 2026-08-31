import { describe, expect, it } from 'vitest';
import { deduplicate, titleSimilarity } from '../scripts/deduplicate.js';
import { normalizeArticle, normalizeTitle, normalizeUrl } from '../scripts/normalizeNews.js';

const article = (title, url, description = '') => ({ ...normalizeArticle({ title, link: url, description, feedSource: 'Test', isoDate: '2026-08-26T00:00:00Z' }), commodity: 'COPPER' });

describe('normalization and duplicate filtering', () => {
  it('normalizes titles and tracking URLs', () => {
    expect(normalizeTitle('  Copper—Mine: HALTED! ')).toBe('copper mine stop');
    expect(normalizeUrl('https://EXAMPLE.com/news/?utm_source=x&id=1#top')).toBe('https://example.com/news?id=1');
  });

  it('recognizes cross-publisher wording for the same event', () => {
    expect(titleSimilarity('Chile copper mine stops production', 'Major Chilean copper operation halted')).toBeGreaterThan(0.66);
    const first = article('Chile copper mine stops production', 'https://a.example/1');
    const second = article('Major Chilean copper operation halted', 'https://b.example/2');
    const result = deduplicate([first, second], [], 0.66);
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it('keeps follow-ups with a new numeric fact', () => {
    const first = article('Chile copper mine stops production', 'https://a.example/1', 'Operations stopped.');
    const followup = article('Chile copper mine production halted: output down 20%', 'https://b.example/2', 'Output is down 20%.');
    const result = deduplicate([first, followup], [], 0.45);
    expect(result.unique).toHaveLength(2);
  });

  it('removes an exact item found in sent history', () => {
    const item = article('Copper mine halt', 'https://example.com/news');
    expect(deduplicate([item], [{ id: item.id, title: item.title, commodity: item.commodity }]).unique).toHaveLength(0);
  });
});
