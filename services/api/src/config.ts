export const config = {
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://laylaty_app:laylaty_app_password@localhost:5432/laylaty",
  serviceDatabaseUrl:
    process.env.SERVICE_DATABASE_URL ??
    "postgres://laylaty_service:laylaty_service_password@localhost:5432/laylaty",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  port: Number(process.env.PORT ?? 3000),
};
