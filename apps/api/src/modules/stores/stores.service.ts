import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantAccessService } from '../../common/access/tenant-access.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { SearchStoresDto } from './dto/search-stores.dto';
import { UpdateStoreModulesDto } from './dto/update-store-modules.dto';
import { DEFAULT_MODULES_BY_BUSINESS_TYPE } from './business-templates';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
  ) {}

  async create(userId: string, dto: CreateStoreDto) {
    await this.access.assertOrganizationAccess(userId, dto.organizationId, [
      'owner',
      'manager',
    ]);

    const slugTaken = await this.prisma.store.findUnique({
      where: { slug: dto.slug },
    });
    if (slugTaken) throw new ConflictException('Slug already in use');

    const defaultModules = DEFAULT_MODULES_BY_BUSINESS_TYPE[dto.businessType];

    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          organizationId: dto.organizationId,
          name: dto.name,
          slug: dto.slug,
          businessType: dto.businessType,
          description: dto.description,
          city: dto.city,
          status: 'pending_review',
        },
      });
      await tx.storeModule.createMany({
        data: defaultModules.map((moduleKey) => ({
          storeId: store.id,
          moduleKey,
          enabled: true,
        })),
      });
      return store;
    });
  }

  search(dto: SearchStoresDto) {
    const where: Prisma.StoreWhereInput = {
      status: 'active',
      businessType: dto.businessType,
      city: dto.city ? { equals: dto.city, mode: 'insensitive' } : undefined,
      OR: dto.q
        ? [
            { name: { contains: dto.q, mode: 'insensitive' } },
            { description: { contains: dto.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    return this.prisma.store.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBySlug(slug: string) {
    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store || store.status !== 'active') {
      throw new NotFoundException('Store not found');
    }
    return store;
  }

  async listModules(userId: string, storeId: string) {
    await this.access.assertStoreAccess(userId, storeId);
    return this.prisma.storeModule.findMany({ where: { storeId } });
  }

  async updateModules(
    userId: string,
    storeId: string,
    dto: UpdateStoreModulesDto,
  ) {
    await this.access.assertStoreAccess(userId, storeId);
    await this.prisma.$transaction(
      dto.modules.map((m) =>
        this.prisma.storeModule.upsert({
          where: { storeId_moduleKey: { storeId, moduleKey: m.moduleKey } },
          create: { storeId, moduleKey: m.moduleKey, enabled: m.enabled },
          update: { enabled: m.enabled },
        }),
      ),
    );
    return this.prisma.storeModule.findMany({ where: { storeId } });
  }
}
