import { createServer } from 'vite';
import { logger } from './lib/logger.js';
import { loadConfig } from './lib/config.js';
import { projectRoot } from './lib/paths.js';
import { createAgentScheduler } from './scheduler.js';

async function startApplication() {
  const { settings } = await loadConfig();
  const host = process.env.DASHBOARD_HOST || '127.0.0.1';
  const port = Number.parseInt(process.env.DASHBOARD_PORT || '4173', 10);
  const server = await createServer({ root: projectRoot, server: { host, port, strictPort: false } });
  await server.listen();
  server.printUrls();

  const scheduler = createAgentScheduler({ intervalMinutes: settings.agentIntervalMinutes });
  logger.info('Local dashboard and agent scheduler started', { host, requestedPort: port, intervalMinutes: scheduler.intervalMinutes });
  await scheduler.start({ runImmediately: true });

  async function shutdown(signal) {
    logger.info('Stopping local dashboard and scheduler', { signal });
    scheduler.stop();
    await server.close();
    process.exit(0);
  }
  process.once('SIGINT', () => { void shutdown('SIGINT'); });
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
}

startApplication().catch((error) => {
  logger.error('Application startup failed', error.stack || error.message);
  process.exitCode = 1;
});
