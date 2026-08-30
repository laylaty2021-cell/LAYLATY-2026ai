import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  list(storeId: string) {
    return this.prisma.review.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // "must have a completed order at this store" (docs/api/openapi.yaml).
  async create(customerId: string, storeId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (
      !order ||
      order.customerId !== customerId ||
      order.storeId !== storeId ||
      order.status !== 'completed'
    ) {
      throw new BadRequestException(
        'You can only review a store after completing an order there',
      );
    }

    return this.prisma.review.create({
      data: {
        customerId,
        storeId,
        itemType: dto.itemType,
        itemId: dto.itemId,
        orderId: dto.orderId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });
  }
}
