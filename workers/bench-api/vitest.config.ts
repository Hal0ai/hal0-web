import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const migrationsPath = fileURLToPath(new URL("./migrations", import.meta.url));
const migrations = await readD1Migrations(migrationsPath);

// workerd's `node:fs` shim inside test files has no access to the real host
// filesystem (verified empirically: readFileSync/readdirSync both fail with
// ENOENT for real paths even under nodejs_compat-less default config). This
// vitest.config.ts, however, runs under real Node.js at Vite config-load
// time, so read the binary fixture here and hand it to the worker as a
// base64 string binding; tests decode it back to bytes with atob().
const fixtureTarGzPath = fileURLToPath(
  new URL("./test/fixtures/valid.hal0bench.tar.gz", import.meta.url),
);
const fixtureTarGzB64 = readFileSync(fixtureTarGzPath).toString("base64");

export default defineConfig({
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          ADMIN_TOKEN: "test-admin-token",
          TEST_MIGRATIONS: migrations,
          FIXTURE_VALID_TAR_GZ_B64: fixtureTarGzB64,
        },
      },
    }),
  ],
});
