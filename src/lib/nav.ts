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

export function getSocial(id: SocialLink['id']): SocialLink {
  const link = social.find((s) => s.id === id);
  if (!link) throw new Error(`nav.json: missing social entry '${id}'`);
  return link;
}

/**
 * Returns the `sub` list of the header entry whose section is active for
 * `path`, restricted to visible header entries. Returns null when no
 * visible header entry with a sub-nav is active for the given path.
 */
export function subFor(path: string): NavLink[] | null {
  for (const link of visibleHeader) {
    if (link.sub && isActive(path, link)) return link.sub;
  }
  return null;
}
