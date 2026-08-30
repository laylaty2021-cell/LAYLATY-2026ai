import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { StoresService } from './stores.service';
import { UpdateStoreModulesDto } from './dto/update-store-modules.dto';

@Controller('merchant/stores/:storeId/modules')
@UseGuards(JwtAuthGuard)
export class StoreModulesController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.storesService.listModules(user.id, storeId);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreModulesDto,
  ) {
    return this.storesService.updateModules(user.id, storeId, dto);
  }
}
