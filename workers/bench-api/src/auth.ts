import type { Env } from "./router";

async function digest(s: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
}

export async function checkAdmin(req: Request, env: Env): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!env.ADMIN_TOKEN) return false; // unset secret must never mean open door
  const [a, b] = await Promise.all([digest(token), digest(env.ADMIN_TOKEN)]);
  return crypto.subtle.timingSafeEqual(a, b);
}
