import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Central place that answers "may this user act on this store/org?" — every
// merchant-facing controller calls this instead of trusting a storeId from
// the URL. This is the code-level enforcement of blueprint §6: tenant scope
// is derived server-side, never accepted as client input.
@Injectable()
export class TenantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertStoreAccess(userId: string, storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, organizationId: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: store.organizationId,
          userId,
        },
      },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this store');
    }
    return store;
  }

  async assertOrganizationAccess(
    userId: string,
    organizationId: string,
    roles?: string[],
  ) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }
    if (roles && !roles.includes(membership.role)) {
      throw new ForbiddenException(
        `Requires one of roles: ${roles.join(', ')}`,
      );
    }
    return membership;
  }
}
