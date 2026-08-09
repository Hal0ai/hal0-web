import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("GET /v1/health", () => {
  it("returns ok json", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/v1/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "hal0-bench-api" });
  });

  it("unknown path is 404 with errors shape", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ errors: ["not found"] });
  });
});
