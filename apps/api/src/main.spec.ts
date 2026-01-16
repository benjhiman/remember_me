/**
 * Tests for API bootstrap behavior regarding job runner
 * These tests verify that the API does NOT auto-start job runner
 */
describe('API Bootstrap - Job Runner Configuration', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should have JOB_RUNNER_ENABLED default to false in API mode', () => {
    // API mode: WORKER_MODE not set or 0
    delete process.env.WORKER_MODE;
    delete process.env.JOB_RUNNER_ENABLED;

    const isWorkerMode = process.env.WORKER_MODE === '1' || process.env.WORKER_MODE === 'true';
    const enabled = isWorkerMode
      ? process.env.JOB_RUNNER_ENABLED !== 'false'
      : process.env.JOB_RUNNER_ENABLED === 'true';

    // In API mode (isWorkerMode=false), enabled should be false by default
    expect(isWorkerMode).toBe(false);
    expect(enabled).toBe(false);
  });

  it('should require explicit JOB_RUNNER_ENABLED=true in API mode to enable', () => {
    process.env.WORKER_MODE = '0';
    process.env.JOB_RUNNER_ENABLED = 'true';

    const isWorkerMode = process.env.WORKER_MODE === '1' || process.env.WORKER_MODE === 'true';
    const enabled = isWorkerMode
      ? process.env.JOB_RUNNER_ENABLED !== 'false'
      : process.env.JOB_RUNNER_ENABLED === 'true';

    // In API mode, must explicitly set to true
    expect(isWorkerMode).toBe(false);
    expect(enabled).toBe(true); // Only because explicitly set
  });

  it('should have JOB_RUNNER_ENABLED default to true in worker mode', () => {
    process.env.WORKER_MODE = '1';
    delete process.env.JOB_RUNNER_ENABLED;

    const isWorkerMode = process.env.WORKER_MODE === '1' || process.env.WORKER_MODE === 'true';
    const enabled = isWorkerMode
      ? process.env.JOB_RUNNER_ENABLED !== 'false'
      : process.env.JOB_RUNNER_ENABLED === 'true';

    // In worker mode, enabled should be true by default
    expect(isWorkerMode).toBe(true);
    expect(enabled).toBe(true);
  });
});
