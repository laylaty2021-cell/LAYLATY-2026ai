import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  receive(
    @Param('provider') provider: string,
    @Body() payload: unknown,
    @Headers('x-webhook-signature') signature: string | undefined,
  ) {
    return this.paymentsService.handleWebhook(provider, payload, signature);
  }
}
