const STATIC_ORIGINS = new Set([
  "https://hal0.dev",
  "https://www.hal0.dev",
  "http://localhost:4321",
]);

const PAGES_DEV_RE = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.pages\.dev$/;

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  return STATIC_ORIGINS.has(origin) || PAGES_DEV_RE.test(origin);
}

/** CORS response headers for `req`: echoes allow-origin only for allowed origins. */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = { vary: "origin" };
  if (isAllowedOrigin(origin)) headers["access-control-allow-origin"] = origin;
  return headers;
}

/** Handles an OPTIONS preflight request for any /v1/* path. */
export function handlePreflight(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(req),
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
