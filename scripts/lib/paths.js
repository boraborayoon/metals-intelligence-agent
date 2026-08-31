import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const projectRoot = path.resolve(currentDir, '..', '..');
export const paths = {
  commodities: path.join(projectRoot, 'config', 'commodities.json'),
  sources: path.join(projectRoot, 'config', 'sources.json'),
  settings: path.join(projectRoot, 'config', 'settings.json'),
  commonRules: path.join(projectRoot, 'config', 'rules', 'common.json'),
  rulesDirectory: path.join(projectRoot, 'config', 'rules'),
  sentItems: path.join(projectRoot, 'data', 'sent-items.json'),
  codexQueue: path.join(projectRoot, 'data', 'codex-analysis-queue.json'),
  codexResults: path.join(projectRoot, 'data', 'codex-analysis-results.json'),
  codexRequest: path.join(projectRoot, 'outputs', 'codex-analysis-request.md'),
  latestNews: path.join(projectRoot, 'public', 'data', 'latest-news.json'),
  status: path.join(projectRoot, 'public', 'data', 'status.json'),
  marketSummary: path.join(projectRoot, 'public', 'data', 'market-summary.json'),
  publicCodexQueue: path.join(projectRoot, 'public', 'data', 'codex-analysis-queue.json')
};
