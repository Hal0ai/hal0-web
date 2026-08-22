/**
 * Env var access for the DiscourseConnect auth routes (src/pages/api/**).
 *
 * These routes only ever run on-demand (`export const prerender = false`),
 * so reading `process.env` at request time is safe — it never runs during
 * the static build, where the values won't exist. `import.meta.env` is
 * checked first since that's Astro/Vite's own merged view (and what local
 * `.env` files populate in dev); `process.env` covers the plain runtime
 * env vars Vercel injects into the deployed function.
 */

function readEnv(name: string): string | undefined {
	const fromImportMeta = (import.meta.env as Record<string, string | undefined>)[name];
	if (fromImportMeta) return fromImportMeta;
	return process.env[name];
}

export function requireEnv(name: string): string {
	const value = readEnv(name);
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

export { readEnv };
