/**
 * Helper functions for testing AUDIT_FAIL_MODE behavior
 */
import { InternalServerErrorException } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';

/**
 * Creates a mock AuditLogService that simulates OPEN mode behavior
 * (logs error but doesn't throw)
 */
export function createMockAuditLogServiceOpenMode(): Partial<AuditLogService> {
  return {
    log: jest.fn().mockImplementation(async () => {
      // OPEN mode: log error but don't throw
      // In real implementation, error is caught and logged internally
      return Promise.resolve();
    }),
  };
}

/**
 * Creates a mock AuditLogService that simulates CLOSED mode behavior
 * (throws InternalServerErrorException when log fails)
 */
export function createMockAuditLogServiceClosedMode(): Partial<AuditLogService> {
  return {
    log: jest.fn().mockRejectedValue(
      new InternalServerErrorException({
        statusCode: 500,
        message: 'Audit log failed',
        errorCode: 'AUDIT_LOG_FAILED',
        error: 'InternalServerError',
      }),
    ),
  };
}
