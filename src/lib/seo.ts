/**
 * schema.org building blocks shared by every marketing page.
 *
 * MarketingLayout prepends `siteGraph()` to each page's JSON-LD @graph, so the
 * Organization and WebSite nodes are on every page and pages can point at them
 * by `@id` (`publisher: { '@id': ORG_ID }`) instead of repeating them. Pages
 * add their own nodes through the layout's `jsonLd` prop.
 */

export const SITE_URL = 'https://hal0.dev';
export const FORUM_URL = 'https://forum.hal0.dev';
export const ORG_ID = `${SITE_URL}/#org`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const ORG_LOGO = `${SITE_URL}/brand/logo-halo-dark.png`;

interface NavSocial {
  id: string;
  href: string;
}

/** The three public profiles that identify the organization. */
export function organizationSameAs(social: NavSocial[]): string[] {
  const href = (id: string) => {
    const entry = social.find((s) => s.id === id);
    if (!entry) throw new Error(`nav.json has no "${id}" social link`);
    return entry.href;
  };
  // nav.json links the repo (github.com/hal0ai/hal0); the organization is its owner.
  const githubOrg = new URL(`/${new URL(href('github')).pathname.split('/')[1]}`, href('github')).href;
  return [githubOrg, href('discord'), FORUM_URL];
}

/** Organization + WebSite, the two nodes every page's graph starts with. */
export function siteGraph(sameAs: string[]): Record<string, unknown>[] {
  return [
    {
      '@type': 'Organization',
      '@id': ORG_ID,
      name: 'hal0',
      url: `${SITE_URL}/`,
      logo: ORG_LOGO,
      sameAs,
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: 'hal0',
      url: `${SITE_URL}/`,
      publisher: { '@id': ORG_ID },
    },
  ];
}

/** Home > page trail for a top-level page. `path` is the page's own path, e.g. `/benchmarks/`. */
export function breadcrumbList(name: string, path: string): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'hal0', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name, item: new URL(path, SITE_URL).href },
    ],
  };
}
