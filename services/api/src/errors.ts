export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (entity: string) =>
  new ApiError(404, `${entity.toUpperCase()}_NOT_FOUND`, `${entity} not found`);

export const forbidden = (message = "Forbidden") => new ApiError(403, "FORBIDDEN", message);

export const unauthenticated = (message = "Missing or invalid credentials") =>
  new ApiError(401, "UNAUTHENTICATED", message);

/**
 * Maps a Postgres RLS/exclusion-constraint rejection to the standard error
 * envelope from docs/blueprint/05-rest-api.md instead of leaking a raw
 * database error to the client.
 */
export function fromPgError(err: unknown): ApiError {
  const pgErr = err as { code?: string; message?: string };
  if (pgErr?.code === "42501") {
    // insufficient_privilege / RLS policy violation
    return forbidden("You do not have access to this store's data");
  }
  if (pgErr?.code === "23P01") {
    // exclusion_violation (e.g. overlapping booking on the same resource)
    return new ApiError(409, "RESOURCE_NOT_AVAILABLE", "The requested time slot is no longer available");
  }
  if (pgErr?.code === "23505") {
    // unique_violation
    return new ApiError(409, "DUPLICATE", pgErr.message ?? "Duplicate resource");
  }
  throw err;
}
