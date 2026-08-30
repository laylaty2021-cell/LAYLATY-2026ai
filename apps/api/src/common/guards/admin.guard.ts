import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../modules/auth/auth.types';

// Coarse admin gate for the scaffold: userType === 'admin'. Real role/
// permission checks (super_admin vs support, blueprint §19) belong in
// admin_roles/admin_permissions once the Admin module's RBAC lands — this
// guard is the extension point that will wrap that lookup.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user || user.userType !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
