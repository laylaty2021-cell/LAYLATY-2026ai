import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';

// Marks a handler as requiring one or more admin_permissions.key values
// (blueprint §19: super_admin vs. support). Combine with AdminGuard, which
// reads this metadata — see admin.guard.ts.
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
