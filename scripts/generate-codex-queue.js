import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { paths } from './lib/paths.js';
import { logger } from './lib/logger.js';
import { readCodexQueue } from './codexQueue.js';

const value = (input) => input === undefined || input === null || input === '' ? 'Unclear' : input;

export function createCodexRequest(items, generatedAt = new Date()) {
  const articles = items.map((item, index) => `## ${index + 1}. [${item.commodity}][${item.ruleAnalysis.importance}] ${item.title}

- ID: \`${item.id}\`
- Source: ${item.source}
- Published: ${item.publishedAt}
- Original: ${item.url}
- Reason for review: ${item.reasonForCodexReview}

### Article summary

${value(item.summary)}

### Existing rule analysis

\`\`\`json
${JSON.stringify(item.ruleAnalysis, null, 2)}
\`\`\`
`).join('\n---\n\n');

  return `# Codex Metals Intelligence Analysis Request

Generated: ${generatedAt.toISOString()}
Pending articles: ${items.length}

Analyze only the evidence supplied below. Never invent facts. If direction is not supported, use \`Unclear\`; do not force Bullish or Bearish. Supply reduction and demand growth are generally Bullish candidates; supply growth and demand weakness are generally Bearish candidates, but conflicting evidence may remain Unclear. Procurement impact is from the buyer's cost, lead-time, and supply-risk perspective.

For every article, return one object in \`data/codex-analysis-results.json\` under \`items\` using this exact shape:

\`\`\`json
{
  "id": "article id",
  "importance": "HIGH | MEDIUM | LOW",
  "marketImpact": "Bullish | Bearish | Neutral | Unclear",
  "procurementImpact": "NEGATIVE | POSITIVE | NEUTRAL | UNCLEAR",
  "category": "event category",
  "region": "evidence-backed region or Unclear",
  "summary": "concise evidence-based summary",
  "marketImpactReason": "why the evidence supports this direction",
  "procurementImpactReason": "buyer cost, lead-time, or supply-risk effect",
  "keyEvidence": ["specific evidence from the supplied article"],
  "confidence": "HIGH | MEDIUM | LOW"
}
\`\`\`

## Required review fields

Commodity, Sub Commodity, Importance, Market Impact, Procurement Impact, Category, Region, Summary, Market Impact Reason, Procurement Impact Reason, Key Evidence, and Confidence.

${articles || 'No pending articles.'}
`;
}

export async function generateCodexQueueRequest(options = {}) {
  const queue = options.queue || await readCodexQueue();
  const pending = (queue.items || []).filter((item) => item.codexStatus === 'PENDING');
  const outputPath = options.outputPath || paths.codexRequest;
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, createCodexRequest(pending, options.now || new Date()), 'utf8');
  console.log(`Pending Codex Analysis: ${pending.length}`);
  pending.forEach((item, index) => console.log(`\n${index + 1}. [${item.commodity}][${item.ruleAnalysis.importance}]\n${item.title}`));
  console.log(`\nRequest written: ${outputPath}`);
  return { pending, outputPath };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  generateCodexQueueRequest().catch((error) => {
    logger.error('Codex queue generation failed', error.stack || error.message);
    process.exitCode = 1;
  });
}
