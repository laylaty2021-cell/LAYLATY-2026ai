import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantAccessService } from '../../common/access/tenant-access.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
  ) {}

  // blueprint §8 step 1: creating an org makes the caller its 'owner'
  // member in the same transaction — there is no such thing as an
  // organization with zero owners.
  create(userId: string, dto: CreateOrganizationDto) {
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          ownerUserId: userId,
          name: dto.name,
          commercialRegistration: dto.commercialRegistration,
          taxNumber: dto.taxNumber,
        },
      });
      await tx.organizationMember.create({
        data: { organizationId: organization.id, userId, role: 'owner' },
      });
      return organization;
    });
  }

  async listMembers(userId: string, organizationId: string) {
    await this.access.assertOrganizationAccess(userId, organizationId);
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
  }

  // Sprint 2 follow-up: invite-by-email for a not-yet-registered user via
  // the Notifications module. For now the invitee must already have an
  // account.
  async inviteMember(
    userId: string,
    organizationId: string,
    dto: InviteMemberDto,
  ) {
    await this.access.assertOrganizationAccess(userId, organizationId, [
      'owner',
      'manager',
    ]);

    const invitee = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!invitee) {
      throw new NotFoundException(
        'No account found for that email yet — ask them to register first',
      );
    }

    const existingMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: invitee.id },
      },
    });
    if (existingMembership) {
      throw new ConflictException('User is already a member');
    }

    return this.prisma.organizationMember.create({
      data: { organizationId, userId: invitee.id, role: dto.role },
    });
  }

  // ---- Admin ----

  listForAdmin(status?: string) {
    return this.prisma.organization.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { status: 'active' },
    });
  }
}
