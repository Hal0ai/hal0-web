import type { Env as WorkerEnv } from "../src/router";

// `cloudflare:test`'s `env` and `cloudflare:workers`'s `env` are both typed as
// `Cloudflare.Env`, which is an empty interface meant to be extended via
// declaration merging (normally by `wrangler types`). This project hand-rolls
// its `Env` in `src/router.ts`, so merge it in here for test-time typing.
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
      FIXTURE_VALID_TAR_GZ_B64: string;
    }
  }
}

export {};
