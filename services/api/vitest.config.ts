import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgres://laylaty_app:laylaty_app_password@127.0.0.1:5432/laylaty_test",
      SERVICE_DATABASE_URL: "postgres://laylaty_service:laylaty_service_password@127.0.0.1:5432/laylaty_test",
      JWT_SECRET: "test-secret",
    },
  },
});
