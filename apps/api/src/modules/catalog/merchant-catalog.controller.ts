import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { CreatePackageDto } from './dto/create-package.dto';

@Controller('merchant/stores/:storeId')
@UseGuards(JwtAuthGuard)
export class MerchantCatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  listProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.catalogService.listProducts(user.id, storeId);
  }

  @Post('products')
  createProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.catalogService.createProduct(user.id, storeId, dto);
  }

  @Get('services')
  listServices(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.catalogService.listServices(user.id, storeId);
  }

  @Post('services')
  createService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateServiceDto,
  ) {
    return this.catalogService.createService(user.id, storeId, dto);
  }

  @Post('packages')
  createPackage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreatePackageDto,
  ) {
    return this.catalogService.createPackage(user.id, storeId, dto);
  }
}
