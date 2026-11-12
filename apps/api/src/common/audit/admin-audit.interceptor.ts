import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

/**
 * PH10-T06 — audit every admin API call (reads and writes) with actor,
 * method and route. Bodies are never logged (may contain content/PII).
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as Request & { user?: { id?: string; role?: string } }).user;
    if (!req.path.includes('/admin/') || user?.role !== 'admin') {
      return next.handle();
    }
    return next.handle().pipe(
      tap(() => {
        void this.audit.record({
          actorId: user.id ?? null,
          action: 'admin.access',
          objectType: 'route',
          objectId: `${req.method} ${req.path}`,
        });
      }),
    );
  }
}
