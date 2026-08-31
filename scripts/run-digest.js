import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.js';
import { logger } from './lib/logger.js';
import { paths } from './lib/paths.js';
import { readJson } from './lib/jsonStore.js';
import { createMarketSummaries, generateDigest } from './generateDigest.js';
import { formatTelegramDigest } from './formatTelegram.js';
import { createTelegramSender } from '../src/services/senders/telegramSender.js';
import { createKakaoSender } from '../src/services/senders/kakaoSender.js';

const kstDay = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));

export async function runDigest(options = {}) {
  const dryRun = options.dryRun ?? (process.argv.includes('--dry-run') || String(process.env.DRY_RUN).toLowerCase() === 'true');
  const now = options.now || new Date();
  const { settings } = options.config || await loadConfig();
  const latest = options.latest || await readJson(paths.latestNews, { items: [] });
  const today = latest.items.filter((item) => kstDay(item.publishedAt || item.fetchedAt) === kstDay(now));
  const summaries = createMarketSummaries(today, now);
  const message = formatTelegramDigest(generateDigest(today, summaries, now));
  const telegram = options.telegramSender || createTelegramSender({ dryRun });
  const kakao = options.kakaoSender || createKakaoSender({ dryRun });
  let sent = false;

  if (settings.enableTelegram && (dryRun || (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID))) {
    try {
      await telegram.sendMessage(message);
      sent = true;
    } catch (error) {
      logger.error('Telegram digest send failed', { error: error.message });
    }
  } else if (settings.enableTelegram) {
    logger.warn('Digest not sent: Telegram credentials are not configured');
  }
  if (settings.enableKakao && (dryRun || process.env.KAKAO_ACCESS_TOKEN)) {
    try {
      await kakao.sendMessage(message);
      sent = true;
    } catch (error) {
      logger.error('Kakao digest send failed', { error: error.message });
    }
  } else if (settings.enableKakao) {
    logger.warn('Digest not sent: Kakao credentials are not configured');
  }
  logger.info('Digest run completed', { dryRun, articleCount: today.length, sent });
  return { message, summaries, articleCount: today.length, sent };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  runDigest().catch((error) => {
    logger.error('Digest run failed', error.stack || error.message);
    process.exitCode = 1;
  });
}
