import { BusinessType } from '@prisma/client';

// Business Template System (blueprint §9): which modules a new store of a
// given type gets enabled by default. A merchant can still toggle these
// afterwards via PATCH /merchant/stores/:id/modules.
export const DEFAULT_MODULES_BY_BUSINESS_TYPE: Record<BusinessType, string[]> =
  {
    wedding_hall: ['booking', 'calendar', 'packages', 'payments'],
    florist: ['catalog', 'inventory', 'shipping', 'orders'],
    photographer: ['services', 'booking', 'calendar', 'packages'],
    restaurant: ['catalog', 'orders', 'shipping', 'booking'],
    beauty: ['services', 'booking', 'calendar'],
    transportation: ['booking', 'calendar'],
    catering: ['catalog', 'packages', 'orders'],
    other: ['catalog'],
  };
