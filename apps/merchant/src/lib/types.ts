// Mirrors the relevant schemas in docs/api/openapi.yaml. Hand-written to
// match the real DTOs field-for-field (camelCase, as apps/api actually
// serializes — see docs/api/openapi.yaml's noted naming drift).

export type BusinessType =
  | "wedding_hall"
  | "florist"
  | "photographer"
  | "restaurant"
  | "beauty"
  | "transportation"
  | "catering"
  | "other";

export interface Organization {
  id: string;
  name: string;
  commercialRegistration?: string | null;
  taxNumber?: string | null;
  status: "pending" | "active" | "suspended" | "rejected";
}

export interface Store {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  description?: string | null;
  city?: string | null;
  status: "draft" | "pending_review" | "active" | "suspended" | "closed";
}

export interface StoreModule {
  moduleKey: string;
  enabled: boolean;
}

export type CatalogItemStatus = "draft" | "active" | "archived" | "out_of_stock";

export interface Product {
  id: string;
  storeId: string;
  categoryId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  // Prisma serializes Decimal fields as strings over JSON.
  basePrice: string;
  currency: string;
  status: CatalogItemStatus;
  requiresShipping: boolean;
}

export interface Service {
  id: string;
  storeId: string;
  categoryId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  price: string;
  currency: string;
  durationMinutes?: number | null;
  status: CatalogItemStatus;
}
