import { type Env, json, register, route } from "./router";

register("GET", "/v1/health", () => json({ ok: true, service: "hal0-bench-api" }));

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return route(req, env);
  },
} satisfies ExportedHandler<Env>;
