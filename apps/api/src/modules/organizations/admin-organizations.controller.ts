import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { OrganizationsService } from './organizations.service';

@Controller('admin/organizations')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminOrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.organizationsService.listForAdmin(status);
  }

  @Post(':organizationId/approve')
  approve(@Param('organizationId') organizationId: string) {
    return this.organizationsService.approve(organizationId);
  }
}
