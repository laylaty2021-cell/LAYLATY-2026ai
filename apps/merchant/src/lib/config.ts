// Same idea as apps/customer's AppConfig: one place the API base URL comes
// from, overridable per environment without touching call sites.
//   NEXT_PUBLIC_API_BASE_URL=https://api.staging.laylaty.com/v1 npm run build
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/v1";
