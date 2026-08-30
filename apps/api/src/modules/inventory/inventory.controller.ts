import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { InventoryService } from './inventory.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { SetStockDto } from './dto/set-stock.dto';

@Controller('merchant/stores/:storeId/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('locations')
  listLocations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.inventoryService.listLocations(user.id, storeId);
  }

  @Post('locations')
  createLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateLocationDto,
  ) {
    return this.inventoryService.createLocation(
      user.id,
      storeId,
      dto.name,
      dto.address,
    );
  }

  @Post('stock')
  setStock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: SetStockDto,
  ) {
    return this.inventoryService.setStock(
      user.id,
      storeId,
      dto.variantId,
      dto.locationId,
      dto.quantityOnHand,
    );
  }
}
