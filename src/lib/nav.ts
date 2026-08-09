/**
 * Single source of truth for site chrome links. Every surface (marketing
 * layout, Starlight docnav, footer, future Discourse theme sync) reads
 * from nav.json via this module — never hardcode chrome hrefs elsewhere.
 */
import nav from '../data/nav.json';

export interface NavLink {
  label: string;
  href: string;
  match?: string | string[];
  exclude?: string[];
  sub?: NavLink[];
  hidden?: boolean;
  external?: boolean;
}
export interface SocialLink extends NavLink {
  id: 'github' | 'discord';
}
export interface FooterColumn {
  heading: string;
  links: NavLink[];
}

export const header = nav.header as NavLink[];
export const footerColumns = nav.footerColumns as FooterColumn[];
export const social = nav.social as SocialLink[];
export const footerBase = nav.footerBase as NavLink[];

export const visibleHeader = header.filter((l) => !l.hidden);

const matches = (path: string, prefix: string) =>
  path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : prefix + '/');

export function isActive(path: string, link: NavLink): boolean {
  if (!link.match) return false;
  const prefixes = Array.isArray(link.match) ? link.match : [link.match];
  return (
    prefixes.some((p) => matches(path, p)) &&
    !(link.exclude ?? []).some((e) => matches(path, e))
  );
}

/**
 * True when `path` and `href` refer to the exact same route, ignoring a
 * trailing-slash difference (Astro's trailingSlash config, and manifest
 * hrefs authored either way, can make href and Astro.url.pathname differ
 * by only a trailing `/`).
 */
export function isExactMatch(path: string, href: string): boolean {
  const norm = (s: string) => (s.length > 1 && s.endsWith('/') ? s.slice(0, -1) : s);
  return norm(path) === norm(href);
}

/**
 * The correct `aria-current` value for a nav link at the current path:
 * `"page"` when the link's href IS the current page (exact match,
 * trailing-slash tolerant), `"true"` when the link merely represents the
 * active section (e.g. an umbrella link whose `match` covers the current
 * path without being it), and `undefined` otherwise.
 */
export function ariaCurrent(path: string, link: NavLink): 'page' | 'true' | undefined {
  if (isExactMatch(path, link.href)) return 'page';
  return isActive(path, link) ? 'true' : undefined;
}

export function getSocial(id: SocialLink['id']): SocialLink {
  const link = social.find((s) => s.id === id);
  if (!link) throw new Error(`nav.json: missing social entry '${id}'`);
  return link;
}

/**
 * Returns the `sub` list of the header entry whose section is active for
 * `path`, restricted to visible header entries. Returns null when no
 * visible header entry with a sub-nav is active for the given path.
 *
 * Hub entries (array `match`, i.e. `learn`) are EXCLUDED since the
 * one-header unification: their sub links live flat in the main nav on
 * every surface (see `flatHeader`), so repeating them in a sub-nav row
 * was pure duplication. Sections with a real landing page (benchmarks)
 * keep their contextual sub-nav.
 */
export function subFor(path: string): NavLink[] | null {
  for (const link of visibleHeader) {
    if (link.sub && !Array.isArray(link.match) && isActive(path, link)) return link.sub;
  }
  return null;
}

/**
 * The flat site nav — ONE list for every header (marketing SiteHeader,
 * Starlight docnav, mobile drawers): hub entries with an array `match`
 * (i.e. `learn`, which has no page of its own) contribute their sub
 * links; real sections pass through as their umbrella link.
 */
export const flatHeader: NavLink[] = visibleHeader.flatMap((l) =>
  l.sub && Array.isArray(l.match) ? l.sub : [l],
);
