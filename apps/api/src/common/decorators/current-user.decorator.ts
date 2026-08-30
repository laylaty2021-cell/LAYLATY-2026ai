import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../../modules/auth/auth.types';

// Reads the principal attached by JwtStrategy.validate(). Handlers pull the
// tenant scope from here, never from route/query params (blueprint §6:
// organization_id / store_id are derived server-side, not client-supplied).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
