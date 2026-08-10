import { deleteHandler } from "./admin";
import { handlePreflight } from "./cors";
import { ingestHandler } from "./ingest";
import {
  bundleHandler,
  cellsHandler,
  evalsHandler,
  historyHandler,
  profileByIdHandler,
  profilesHandler,
  rosterHandler,
  runHandler,
} from "./reads";
import { type Env, json, register, route } from "./router";

register("GET", "/v1/health", () => json({ ok: true, service: "hal0-bench-api" }));
register("POST", "/v1/bundles", ingestHandler);
register("DELETE", "/v1/bundles/:id", deleteHandler);
register("GET", "/v1/roster", rosterHandler);
register("GET", "/v1/cells", cellsHandler);
register("GET", "/v1/runs/:run_id", runHandler);
register("GET", "/v1/bundles/:id", bundleHandler);
register("GET", "/v1/profiles", profilesHandler);
register("GET", "/v1/profiles/:bundle_id/:name", profileByIdHandler);
register("GET", "/v1/evals", evalsHandler);
register("GET", "/v1/history", historyHandler);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS" && url.pathname.startsWith("/v1/")) return handlePreflight(req);
    return route(req, env);
  },
} satisfies ExportedHandler<Env>;
