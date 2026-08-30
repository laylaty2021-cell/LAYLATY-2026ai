import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../../modules/auth/auth.types';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

// Real RBAC (blueprint §19), not just a userType check: an "admin" is
// anyone assigned at least one row in admin_user_roles (seeded roles:
// super_admin, support — see prisma/seed.ts). A route annotated with
// @RequirePermissions(...) additionally requires that permission key to
// be attached to one of the caller's roles via admin_role_permissions —
// this is how `support` gets locked out of e.g. `payments.refund` while
// `super_admin` (seeded with every permission) is not.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) throw new ForbiddenException('Admin access required');

    const roleAssignments = await this.prisma.adminUserRole.findMany({
      where: { userId: user.id },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });
    if (roleAssignments.length === 0) {
      throw new ForbiddenException('Admin access required');
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const grantedPermissions = new Set(
      roleAssignments.flatMap((assignment) =>
        assignment.role.rolePermissions.map((rp) => rp.permission.key),
      ),
    );
    const missing = requiredPermissions.filter(
      (p) => !grantedPermissions.has(p),
    );
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing permission(s): ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
