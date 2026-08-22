/**
 * Single source of truth for the five docs sections' presentation copy —
 * consumed by src/pages/docs/index.astro (the /docs hub) and the four
 * section listing pages (src/pages/docs/{concepts,guides,operate,
 * reference}/index.astro).
 *
 * Deliberately copy ONLY. Page counts, page titles and hrefs are derived
 * at build time from src/data/docs-forum-pages.ts (see
 * deriveForumSectionRows in src/lib/section-pages.mjs), so adding a docs
 * page never requires an edit here — the same rule the KB landing
 * follows with KB_CATEGORIES, except KB additionally lists
 * planned-but-unwritten pages, which docs does not need since every doc
 * this data covers is already a live forum.hal0.dev topic.
 *
 * `slug` must equal the section slug used throughout
 * docs-forum-pages.ts's `section` field.
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
