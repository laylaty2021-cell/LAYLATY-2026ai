import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../");
const dbDir = path.join(repoRoot, "db");

const TEST_DB = "laylaty_test";

const MIGRATION_FILES = [
  "schema.sql",
  "roles.sql",
  "auth_uid_selfhosted.sql",
  "seed_permissions.sql",
  "rls_policies.sql",
];

/**
 * Drops and recreates the test database, then replays the full migration
 * stack in order — the same sequence documented in
 * docs/blueprint/02-database-schema.md. Requires passwordless `sudo -u
 * postgres` (available in CI/dev containers for this repo).
 */
export function resetDatabase(): void {
  execFileSync("sudo", ["-u", "postgres", "dropdb", "--if-exists", TEST_DB], { stdio: "pipe" });
  execFileSync("sudo", ["-u", "postgres", "createdb", TEST_DB], { stdio: "pipe" });
  for (const file of MIGRATION_FILES) {
    execFileSync(
      "sudo",
      ["-u", "postgres", "psql", "-d", TEST_DB, "-v", "ON_ERROR_STOP=1", "-f", path.join(dbDir, file)],
      { stdio: "pipe" },
    );
  }
}
