/**
 * Single source of truth for site chrome links. Every surface (marketing
 * layout, Starlight docnav, footer, future Discourse theme sync) reads
 * from nav.json via this module — never hardcode chrome hrefs elsewhere.
 */
import nav from '../data/nav.json';

export interface NavLink {
  label: string;
  href: string;
  match?: string;
  exclude?: string[];
}
export interface SocialLink extends NavLink {
  id: 'github' | 'discord';
}

export const header = nav.header as NavLink[];
export const footer = nav.footer as NavLink[];
export const social = nav.social as SocialLink[];

const matches = (path: string, prefix: string) =>
  path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : prefix + '/');

export function isActive(path: string, link: NavLink): boolean {
  if (!link.match) return false;
  return matches(path, link.match) && !(link.exclude ?? []).some((e) => matches(path, e));
}

export function getSocial(id: SocialLink['id']): SocialLink {
  const link = social.find((s) => s.id === id);
  if (!link) throw new Error(`nav.json: missing social entry '${id}'`);
  return link;
}
