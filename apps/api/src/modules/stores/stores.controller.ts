import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { SearchStoresDto } from './dto/search-stores.dto';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStoreDto) {
    return this.storesService.create(user.id, dto);
  }

  @Get()
  search(@Query() dto: SearchStoresDto) {
    return this.storesService.search(dto);
  }

  @Get(':storeSlug')
  getBySlug(@Param('storeSlug') storeSlug: string) {
    return this.storesService.getBySlug(storeSlug);
  }
}
