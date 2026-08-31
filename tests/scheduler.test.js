import { describe, expect, it } from 'vitest';
import { createAgentScheduler } from '../scripts/scheduler.js';

const silentLogger = { info() {}, warn() {}, error() {} };

describe('local agent scheduler', () => {
  it('runs immediately and again on the configured interval', async () => {
    let calls = 0;
    let intervalCallback;
    let intervalDelay;
    const scheduler = createAgentScheduler({
      run: async () => { calls += 1; }, intervalMinutes: 2, logger: silentLogger,
      setIntervalImpl: (callback, delay) => { intervalCallback = callback; intervalDelay = delay; return 1; },
      clearIntervalImpl: () => {}
    });
    await scheduler.start();
    expect(calls).toBe(1);
    expect(intervalDelay).toBe(120_000);
    intervalCallback();
    await new Promise((resolve) => setImmediate(resolve));
    expect(calls).toBe(2);
    scheduler.stop();
  });

  it('skips a run while the previous run is still active', async () => {
    let release;
    const scheduler = createAgentScheduler({
      run: () => new Promise((resolve) => { release = resolve; }), logger: silentLogger,
      setIntervalImpl: () => 1, clearIntervalImpl: () => {}
    });
    const first = scheduler.runOnce('first');
    const second = await scheduler.runOnce('scheduled');
    expect(second).toMatchObject({ skipped: true, trigger: 'scheduled' });
    release({ ok: true });
    await first;
  });
});
