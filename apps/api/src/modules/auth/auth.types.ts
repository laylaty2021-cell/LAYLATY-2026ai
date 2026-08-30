import { UserType } from '@prisma/client';

// Shape attached to `req.user` by JwtStrategy.validate() and read back via
// the @CurrentUser() decorator. Kept intentionally small: anything else a
// handler needs should be loaded from the DB using this id, not stuffed
// into the JWT payload.
export interface AuthenticatedUser {
  id: string;
  userType: UserType;
}

export interface AccessTokenPayload {
  sub: string;
  userType: UserType;
}
