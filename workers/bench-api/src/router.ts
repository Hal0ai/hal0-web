export interface Env {
  DB: D1Database;
  BUNDLES: R2Bucket;
  ADMIN_TOKEN: string;
}

export type Handler = (
  req: Request,
  env: Env,
  params: Record<string, string>,
) => Promise<Response> | Response;

// Pattern segments starting with ":" capture into params.
const routes: { method: string; parts: string[]; handler: Handler }[] = [];

export function register(method: string, path: string, handler: Handler): void {
  routes.push({ method, parts: path.split("/").filter(Boolean), handler });
}

export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function errors(msgs: string[], status: number): Response {
  return json({ errors: msgs }, status);
}

export async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  for (const r of routes) {
    if (r.method !== req.method || r.parts.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      if (r.parts[i].startsWith(":")) params[r.parts[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (r.parts[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return r.handler(req, env, params);
  }
  return errors(["not found"], 404);
}
