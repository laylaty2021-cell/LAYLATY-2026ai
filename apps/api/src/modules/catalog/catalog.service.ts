import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantAccessService } from '../../common/access/tenant-access.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { SearchCatalogDto } from './dto/search-catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
  ) {}

  // ---- Products ----

  async listProducts(userId: string, storeId: string) {
    await this.access.assertStoreAccess(userId, storeId);
    return this.prisma.product.findMany({
      where: { storeId },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProduct(userId: string, storeId: string, dto: CreateProductDto) {
    await this.access.assertStoreAccess(userId, storeId);
    const slugTaken = await this.prisma.product.findUnique({
      where: { storeId_slug: { storeId, slug: dto.slug } },
    });
    if (slugTaken)
      throw new ConflictException('Slug already in use for this store');

    return this.prisma.product.create({
      data: {
        storeId,
        categoryId: dto.categoryId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        basePrice: dto.basePrice,
        currency: dto.currency ?? 'SAR',
        requiresShipping: dto.requiresShipping ?? true,
        // No moderation/review queue in the MVP catalog flow — a merchant
        // creating an item means it, so it goes live immediately.
        status: 'active',
      },
    });
  }

  // ---- Services ----

  async listServices(userId: string, storeId: string) {
    await this.access.assertStoreAccess(userId, storeId);
    return this.prisma.service.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createService(userId: string, storeId: string, dto: CreateServiceDto) {
    await this.access.assertStoreAccess(userId, storeId);
    const slugTaken = await this.prisma.service.findUnique({
      where: { storeId_slug: { storeId, slug: dto.slug } },
    });
    if (slugTaken)
      throw new ConflictException('Slug already in use for this store');

    return this.prisma.service.create({
      data: {
        storeId,
        categoryId: dto.categoryId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        price: dto.price,
        durationMinutes: dto.durationMinutes,
        status: 'active',
      },
    });
  }

  // ---- Packages ----

  async createPackage(userId: string, storeId: string, dto: CreatePackageDto) {
    await this.access.assertStoreAccess(userId, storeId);
    const slugTaken = await this.prisma.package.findUnique({
      where: { storeId_slug: { storeId, slug: dto.slug } },
    });
    if (slugTaken)
      throw new ConflictException('Slug already in use for this store');

    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.package.create({
        data: {
          storeId,
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          price: dto.price,
          status: 'active',
        },
      });
      await tx.packageItem.createMany({
        data: dto.items.map((item) => ({
          packageId: pkg.id,
          itemType: item.itemType,
          itemId: item.itemId,
          quantity: item.quantity ?? 1,
        })),
      });
      return tx.package.findUniqueOrThrow({
        where: { id: pkg.id },
        include: { items: true },
      });
    });
  }

  // ---- Public search ----
  // Simple Postgres ILIKE search across products/services/packages,
  // unioned client-side into the SellableItem shape from
  // docs/api/openapi.yaml. Sprint 15 (§15) upgrades this to full-text /
  // OpenSearch once volume justifies it.
  async search(dto: SearchCatalogDto) {
    const priceFilter =
      dto.minPrice !== undefined || dto.maxPrice !== undefined
        ? { gte: dto.minPrice, lte: dto.maxPrice }
        : undefined;

    const [products, services, packages] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          status: 'active',
          storeId: dto.storeId,
          categoryId: dto.categoryId,
          basePrice: priceFilter,
          store: dto.city ? { city: dto.city } : undefined,
          name: dto.q ? { contains: dto.q, mode: 'insensitive' } : undefined,
        },
        take: 25,
      }),
      this.prisma.service.findMany({
        where: {
          status: 'active',
          storeId: dto.storeId,
          categoryId: dto.categoryId,
          price: priceFilter,
          store: dto.city ? { city: dto.city } : undefined,
          name: dto.q ? { contains: dto.q, mode: 'insensitive' } : undefined,
        },
        take: 25,
      }),
      this.prisma.package.findMany({
        where: {
          status: 'active',
          storeId: dto.storeId,
          price: priceFilter,
          store: dto.city ? { city: dto.city } : undefined,
          name: dto.q ? { contains: dto.q, mode: 'insensitive' } : undefined,
        },
        take: 25,
      }),
    ]);

    return [
      ...products.map((p) => ({
        itemType: 'product' as const,
        itemId: p.id,
        storeId: p.storeId,
        name: p.name,
        price: p.basePrice,
        currency: p.currency,
      })),
      ...services.map((s) => ({
        itemType: 'service' as const,
        itemId: s.id,
        storeId: s.storeId,
        name: s.name,
        price: s.price,
        currency: s.currency,
      })),
      ...packages.map((pk) => ({
        itemType: 'package' as const,
        itemId: pk.id,
        storeId: pk.storeId,
        name: pk.name,
        price: pk.price,
        currency: pk.currency,
      })),
    ];
  }
}
