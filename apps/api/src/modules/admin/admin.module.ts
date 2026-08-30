import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';

// Platform-wide admin surfaces that don't belong to any single domain
// module (docs/database/schema.sql §12 audit_logs). Per-domain admin
// endpoints (e.g. organization approval) live in their own module instead
// — see modules/organizations/admin-organizations.controller.ts.
@Module({
  controllers: [AuditLogsController],
})
export class AdminModule {}
