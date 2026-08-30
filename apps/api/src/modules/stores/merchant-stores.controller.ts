import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { StoresService } from './stores.service';

@Controller('merchant/stores')
@UseGuards(JwtAuthGuard)
export class MerchantStoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.listMine(user.id);
  }
}
