import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SearchCatalogDto } from './dto/search-catalog.dto';

@Controller('catalog')
export class CatalogSearchController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('search')
  search(@Query() dto: SearchCatalogDto) {
    return this.catalogService.search(dto);
  }
}
