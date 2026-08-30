import { Module } from '@nestjs/common';

// Owns: organizations, organization_members (docs/database/schema.sql §2).
// Implemented in docs/backlog/sprint-backlog.md Sprint 1 (S1.4) and
// Sprint 2 (S2.4, KYC/approval). Left as a boundary placeholder here so
// AppModule's module graph matches the target architecture (blueprint §5)
// before the business logic lands.
@Module({})
export class OrganizationsModule {}
