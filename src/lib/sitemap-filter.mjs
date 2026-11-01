// src/lib/sitemap-filter.mjs
//
// Which pages @astrojs/sitemap leaves out (astro.config.mjs). A page that is
// noindex (MarketingLayout's `noindex` prop) must not be advertised to
// crawlers either: a sitemap entry that resolves to a noindex page is flagged
// as a conflict in Search Console. Keep this list in step with the pages that
// pass `noindex`.
//
// Paths are matched exactly, never by prefix: a prefix match on
// /profiles/submitted would also drop a community profile whose slug starts
// with "submitted".

import { SITE_URL } from './seo.ts';

export const SITEMAP_EXCLUDED_PATHS = ['/profiles/submitted/'];

/**
 * @param {string} page - page URL, as @astrojs/sitemap hands it over (resolved against SITE_URL)
 * @returns {boolean} true to keep the page in the sitemap
 */
export function sitemapFilter(page) {
  const { pathname } = new URL(page, SITE_URL);
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return !SITEMAP_EXCLUDED_PATHS.includes(path);
}
