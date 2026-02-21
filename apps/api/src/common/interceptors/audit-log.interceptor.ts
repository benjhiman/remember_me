import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction, AuditEntityType } from '@remember-me/prisma';
import { extractIp, extractUserAgent } from '../utils/request-helpers';

/**
 * AuditLogInterceptor
 * 
 * Automatically logs mutations (POST/PATCH/PUT/DELETE) to AuditLog.
 * This interceptor complements manual audit logging in services.
 * 
 * It captures:
 * - HTTP method and path
 * - Request ID
 * - User and organization context
 * - Response status
 * 
 * Note: This is a basic interceptor. For detailed before/after state tracking,
 * services should continue using AuditLogService.log() manually.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, path } = request;
    const requestId = (request as any).requestId || null;
    const user = (request as any).user;
    const userId = user?.userId || null;
    const organizationId = user?.organizationId || (request as any).organizationId || null;
    const actorRole = user?.role || null;
    const actorEmail = user?.email || null;
    const ip = extractIp(request);
    const userAgent = extractUserAgent(request);

    // Only intercept mutations
    const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
    if (!isMutation || !organizationId) {
      return next.handle();
    }

    // Try to infer entity type from path
    const entityType = this.inferEntityType(path);
    if (!entityType) {
      // If we can't infer entity type, skip automatic audit
      // Services should handle audit manually
      return next.handle();
    }

    // Try to extract entity ID from path or body
    const entityId = this.extractEntityId(path, request);

    // Determine action from HTTP method
    const action = this.mapMethodToAction(method, path);

    return next.handle().pipe(
      tap({
        next: async (data) => {
          // Only log successful mutations (2xx status)
          if (data && typeof data === 'object' && 'statusCode' in data) {
            const statusCode = data.statusCode;
            if (statusCode >= 200 && statusCode < 300) {
              await this.logAudit({
                organizationId,
                actorUserId: userId,
                actorRole,
                actorEmail,
                requestId,
                action,
                entityType,
                entityId: entityId || this.extractIdFromResponse(data),
                before: null,
                after: this.extractRelevantData(data),
                metadata: {
                  method,
                  path,
                  url,
                  statusCode,
                  inferred: true, // Mark as inferred/automatic
                },
                ip,
                userAgent,
                source: 'api',
                severity: 'info',
              });
            }
          } else if (data && typeof data === 'object' && 'id' in data) {
            // Direct entity response
            await this.logAudit({
              organizationId,
              actorUserId: userId,
              actorRole,
              actorEmail,
              requestId,
              action,
              entityType,
              entityId: entityId || data.id,
              before: null,
              after: this.extractRelevantData(data),
              metadata: {
                method,
                path,
                url,
                inferred: true,
              },
              ip,
              userAgent,
              source: 'api',
              severity: 'info',
            });
          }
        },
        error: async (error) => {
          // Log failed mutations for audit trail
          const statusCode = error.status || error.statusCode || 500;
          if (statusCode >= 400 && statusCode < 500) {
            // Client errors (4xx) - might be validation, not found, etc.
            // Still log for audit trail
            await this.logAudit({
              organizationId,
              actorUserId: userId,
              actorRole,
              actorEmail,
              requestId,
              action,
              entityType,
              entityId: entityId || null,
              before: null,
              after: null,
              metadata: {
                method,
                path,
                url,
                statusCode,
                error: error.message,
                inferred: true,
                failed: true,
              },
              ip,
              userAgent,
              source: 'api',
              severity: statusCode >= 500 ? 'error' : 'warn',
            });
          }
        },
      }),
    );
  }

  private async logAudit(data: {
    organizationId: string;
    actorUserId: string | null;
    actorRole?: string | null;
    actorEmail?: string | null;
    requestId: string | null;
    action: AuditAction;
    entityType: AuditEntityType;
    entityId: string | null;
    before: any;
    after: any;
    metadata: any;
    ip?: string | null;
    userAgent?: string | null;
    source?: 'web' | 'api' | 'worker' | 'system';
    severity?: 'info' | 'warn' | 'error';
  }): Promise<void> {
    if (!data.entityId) {
      // Can't log without entity ID
      return;
    }

    try {
      await this.auditLogService.log({
        organizationId: data.organizationId,
        actorUserId: data.actorUserId,
        actorRole: data.actorRole,
        actorEmail: data.actorEmail,
        requestId: data.requestId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        before: data.before,
        after: data.after,
        metadata: data.metadata,
        ip: data.ip,
        userAgent: data.userAgent,
        source: data.source,
        severity: data.severity,
      });
    } catch (error) {
      // Audit log failures are handled by AuditLogService based on AUDIT_FAIL_MODE
      // This interceptor should not throw to avoid breaking the request
    }
  }

  private inferEntityType(path: string): AuditEntityType | null {
    // Map common paths to entity types
    const pathLower = path.toLowerCase();
    
    if (pathLower.includes('/stock') && pathLower.includes('/items')) return AuditEntityType.StockItem;
    if (pathLower.includes('/sales')) return AuditEntityType.Sale;
    if (pathLower.includes('/pricing') && pathLower.includes('/rules')) return AuditEntityType.PricingRule;

    return null;
  }

  private extractEntityId(path: string, request: Request): string | null {
    // Try to extract ID from path params
    const pathParts = path.split('/').filter(Boolean);
    const idIndex = pathParts.findIndex((part, index) => {
      // Look for ID-like patterns after entity name
      const prevPart = pathParts[index - 1];
      if (prevPart && ['sales', 'stock', 'pricing'].includes(prevPart.toLowerCase())) {
        return true;
      }
      return false;
    });

    if (idIndex >= 0 && idIndex < pathParts.length - 1) {
      const potentialId = pathParts[idIndex + 1];
      // Basic validation: IDs are usually non-empty strings
      if (potentialId && potentialId.length > 0 && !['pay', 'cancel', 'restore', 'assign'].includes(potentialId.toLowerCase())) {
        return potentialId;
      }
    }

    // Try to extract from request params
    const params = (request as any).params;
    if (params && params.id) {
      return params.id;
    }

    // Try to extract from body (for create operations)
    const body = request.body;
    if (body && body.id) {
      return body.id;
    }

    return null;
  }

  private extractIdFromResponse(data: any): string | null {
    if (data && typeof data === 'object') {
      if (data.id) return data.id;
      if (data.data && data.data.id) return data.data.id;
      if (Array.isArray(data.data) && data.data.length > 0 && data.data[0].id) {
        return data.data[0].id;
      }
    }
    return null;
  }

  private extractRelevantData(data: any): any {
    if (!data || typeof data !== 'object') {
      return null;
    }

    // Extract relevant fields from response
    const relevant: any = {};
    
    if (data.id) relevant.id = data.id;
    if (data.name) relevant.name = data.name;
    if (data.status) relevant.status = data.status;
    if (data.organizationId) relevant.organizationId = data.organizationId;
    
    // If data has a nested data property (common in list responses)
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const firstItem = data.data[0];
      if (firstItem.id) relevant.id = firstItem.id;
      if (firstItem.name) relevant.name = firstItem.name;
      if (firstItem.status) relevant.status = firstItem.status;
    } else if (data.data && typeof data.data === 'object' && data.data.id) {
      // Single item response wrapped in data
      const item = data.data;
      if (item.id) relevant.id = item.id;
      if (item.name) relevant.name = item.name;
      if (item.status) relevant.status = item.status;
    }

    return Object.keys(relevant).length > 0 ? relevant : null;
  }

  private mapMethodToAction(method: string, path: string): AuditAction {
    const pathLower = path.toLowerCase();
    
    if (method === 'POST') {
      if (pathLower.includes('/restore')) return AuditAction.RESTORE;
      if (pathLower.includes('/pay')) return AuditAction.PAY;
      if (pathLower.includes('/cancel')) return AuditAction.CANCEL;
      if (pathLower.includes('/ship')) return AuditAction.SHIP;
      if (pathLower.includes('/deliver')) return AuditAction.DELIVER;
      if (pathLower.includes('/assign')) return AuditAction.ASSIGN;
      return AuditAction.CREATE;
    }
    
    if (method === 'PATCH' || method === 'PUT') {
      if (pathLower.includes('/restore')) return AuditAction.RESTORE;
      if (pathLower.includes('/pay')) return AuditAction.PAY;
      if (pathLower.includes('/cancel')) return AuditAction.CANCEL;
      if (pathLower.includes('/ship')) return AuditAction.SHIP;
      if (pathLower.includes('/deliver')) return AuditAction.DELIVER;
      if (pathLower.includes('/assign')) return AuditAction.ASSIGN;
      return AuditAction.UPDATE;
    }
    
    if (method === 'DELETE') {
      return AuditAction.DELETE;
    }
    
    return AuditAction.UPDATE; // Default fallback
  }
}
