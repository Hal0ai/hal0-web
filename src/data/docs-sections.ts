/**
 * Single source of truth for the five docs sections' presentation copy —
 * consumed by src/components/DocsSectionCards.astro (the grid on the docs
 * landing page) and src/pages/docs/index.astro (the /docs hub).
 *
 * Deliberately copy ONLY. Page counts, page titles and hrefs are derived
 * from the content collection at build time (see deriveSectionRows in
 * src/lib/section-pages.mjs), so adding a docs page never requires an
 * edit here — the same rule the KB landing follows with KB_CATEGORIES,
 * except KB additionally lists planned-but-unwritten pages, which docs
 * does not need since every docs page in the tree is already live.
 *
 * `slug` must equal the section's directory under src/content/docs/docs/
 * AND the matching sidebar group's `directory` in astro.config.mjs.
 */
export interface DocsSection {
  slug: string;
  label: string;
  icon: string;
  blurb: string;
}

export const DOCS_SECTIONS: DocsSection[] = [
  {
    slug: 'getting-started',
    label: 'getting started',
    icon: 'lucide:rocket',
    blurb: 'Install, first model, first chat. Bare metal, Proxmox, WSL.',
  },
  {
    slug: 'concepts',
    label: 'concepts',
    icon: 'lucide:layers',
    blurb: 'Slots, stacks, profiles, memory, agents, and the Strix Halo itself.',
  },
  {
    slug: 'guides',
    label: 'guides',
    icon: 'lucide:compass',
    blurb: 'Task by task: pull models, manage slots, wire MCP, roll back.',
  },
  {
    slug: 'operate',
    label: 'operate',
    icon: 'lucide:server',
    blurb: 'Services, auth, and error reporting for a box you actually run.',
  },
  {
    slug: 'reference',
    label: 'reference',
    icon: 'lucide:terminal',
    blurb: 'CLI, config schema, slot lifecycle, env vars, and the API.',
  },
];
