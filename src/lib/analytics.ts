/**
 * Google Analytics 4 wiring shared by the marketing layout and the Starlight
 * Head override (src/components/Analytics.astro renders it on every page).
 *
 * The measurement ID resolves in two steps (see resolveSiteMeasurementId):
 * an explicit PUBLIC_GA_MEASUREMENT_ID build-time env var wins; otherwise a
 * production build on Vercel (VERCEL_ENV=production) falls back to the
 * committed hal0.dev property ID. Anywhere else nothing is rendered: no
 * request to googletagmanager.com, no cookies, byte-identical HTML to before
 * this file existed. Local builds and preview deploys therefore stay
 * analytics-free unless they opt in. A GA4 measurement ID is public by
 * nature (it ships in every page's HTML), so committing it leaks nothing.
 *
 * Cross-domain tracking: hal0.dev and forum.hal0.dev share ONE GA4 property
 * so a visit that starts on the landing page and ends on a forum topic is
 * a single session, not a self-referral. The gtag linker below decorates
 * outbound links to the listed domains with the `_gl` parameter; the forum
 * side is configured in Discourse (`ga_universal_auto_link_domains` =
 * hal0.dev) so the hop back is stitched the same way. GA4 Admin > Data
 * Streams > Configure tag settings > Configure your domains must list both
 * hosts too, otherwise GA treats forum.hal0.dev as a referral source.
 */

/** GA4 measurement IDs look like G-XXXXXXXXXX (Google uses 6-12 upper-case alphanumerics). */
export const GA_MEASUREMENT_ID_RE = /^G-[A-Z0-9]{6,12}$/;

/** Hosts that belong to the same GA4 property; outbound links between them carry the linker param. */
export const GA_LINKER_DOMAINS = ['hal0.dev', 'forum.hal0.dev'] as const;

export const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js';

/** The hal0.dev web data stream. Used only for production builds with no explicit override. */
export const GA_PRODUCTION_ID = 'G-5KSZFRDWXR';

/**
 * Normalise the raw env value to a usable measurement ID, or null.
 * Trims whitespace and upper-cases so a pasted `g-abc123` still works;
 * anything that does not match the G- shape is rejected rather than
 * shipped to every visitor's browser as a broken script tag.
 */
export function resolveMeasurementId(raw: string | undefined | null): string | null {
	if (typeof raw !== 'string') return null;
	const id = raw.trim().toUpperCase();
	return GA_MEASUREMENT_ID_RE.test(id) ? id : null;
}

/** Absolute URL of the gtag loader for a given measurement ID. */
export function gtagScriptSrc(id: string): string {
	return `${GTAG_SRC}?id=${encodeURIComponent(id)}`;
}

/**
 * The inline bootstrap that follows the async loader. Mirrors Google's
 * stock snippet plus the cross-domain linker. The ID is interpolated as a
 * JSON string literal so an unexpected character can never break out of
 * the script context (resolveMeasurementId already restricts it to
 * [A-Z0-9-], this is belt-and-braces).
 */
export function gtagInlineScript(id: string): string {
	const config = JSON.stringify({ linker: { domains: [...GA_LINKER_DOMAINS] } });
	return [
		'window.dataLayer=window.dataLayer||[];',
		'function gtag(){dataLayer.push(arguments);}',
		"gtag('js',new Date());",
		`gtag('config',${JSON.stringify(id)},${config});`,
	].join('');
}

/**
 * Pick the measurement ID for this build. An explicit PUBLIC_GA_MEASUREMENT_ID
 * (valid or not) always decides: a valid value is used, an invalid one
 * disables the tag so a typo never silently falls back to the real property.
 * With no override, only a Vercel production build gets GA_PRODUCTION_ID.
 */
export function resolveSiteMeasurementId(env: {
	PUBLIC_GA_MEASUREMENT_ID?: string | null;
	VERCEL_ENV?: string | null;
}): string | null {
	const override = env.PUBLIC_GA_MEASUREMENT_ID;
	if (typeof override === 'string' && override.trim() !== '') return resolveMeasurementId(override);
	return env.VERCEL_ENV === 'production' ? GA_PRODUCTION_ID : null;
}
