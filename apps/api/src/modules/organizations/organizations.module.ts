import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { AdminOrganizationsController } from './admin-organizations.controller';
import { OrganizationsService } from './organizations.service';

// Owns: organizations, organization_members (docs/database/schema.sql §2).
// docs/backlog/sprint-backlog.md Sprint 1 (S1.4) / Sprint 2 (S2.4).
@Module({
  controllers: [OrganizationsController, AdminOrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
