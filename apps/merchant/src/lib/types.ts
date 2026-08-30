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
