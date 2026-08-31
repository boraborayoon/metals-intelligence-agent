import { logger as defaultLogger } from './lib/logger.js';
import { runAgent } from './run-agent.js';

export function createAgentScheduler(options = {}) {
  const run = options.run || runAgent;
  const intervalMinutes = Math.max(1, options.intervalMinutes || 30);
  const log = options.logger || defaultLogger;
  const setIntervalImpl = options.setIntervalImpl || setInterval;
  const clearIntervalImpl = options.clearIntervalImpl || clearInterval;
  let running = false;
  let timer = null;

  async function runOnce(trigger = 'manual') {
    if (running) {
      log.warn('Agent already running. Skipping scheduled run.', { trigger });
      return { skipped: true, trigger };
    }
    running = true;
    try {
      const result = await run();
      return { skipped: false, trigger, result };
    } finally {
      running = false;
    }
  }

  async function start({ runImmediately = true } = {}) {
    if (timer) return;
    timer = setIntervalImpl(() => { void runOnce('scheduled'); }, intervalMinutes * 60_000);
    if (runImmediately) await runOnce('startup');
  }

  function stop() {
    if (timer) clearIntervalImpl(timer);
    timer = null;
  }

  return { runOnce, start, stop, isRunning: () => running, intervalMinutes };
}
