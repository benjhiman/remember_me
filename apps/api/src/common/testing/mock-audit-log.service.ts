/**
 * Mock implementation of AuditLogService for testing
 * Provides a standard mock that can be reused across test suites
 */
export function createMockAuditLogService() {
  return {
    log: jest.fn().mockResolvedValue(undefined),
  };
}
