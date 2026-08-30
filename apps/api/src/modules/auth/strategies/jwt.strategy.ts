import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessTokenPayload, AuthenticatedUser } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt.accessSecret'),
    });
  }

  // Return value becomes `req.user` — kept to {id, userType} only, per
  // AuthenticatedUser (see auth.types.ts).
  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return { id: payload.sub, userType: payload.userType };
  }
}
