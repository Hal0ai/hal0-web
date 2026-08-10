import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// `TEST_MIGRATIONS` is injected as a JSON binding by vitest.config.ts (via
// `readD1Migrations`). Apply it once per worker instance so every test file
// runs against a fully migrated D1 database.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
