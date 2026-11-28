// src/data/how-pages.ts
//
// The three "how it works" pages: /slots/, /memory/ and /agents/. They sit
// between the landing page (plain, promotional) and the docs on the forum
// (complete, technical). The landing page links to each one, each links to the
// other two, and each ends by handing over to the docs.
//
// This file holds what more than one place needs: the page shell
// (src/components/how/HowPage.astro), the landing page and the tests.

export type HowKey = 'slots' | 'memory' | 'agents';

export interface HowPageInfo {
  key: HowKey;
  /** The page's path, with its trailing slash. */
  href: string;
  /** Icon on the "keep going" card. */
  icon: string;
  /** The h1, and the page's name in its breadcrumb. */
  heading: string;
  /** One line under the heading on the "keep going" card. */
  teaser: string;
}

export const HOW_PAGES: Record<HowKey, HowPageInfo> = {
  slots: {
    key: 'slots',
    href: '/slots/',
    icon: 'lucide:layers',
    heading: 'How slots work',
    teaser: 'A named seat for every model, and what happens when you change who sits in it.',
  },
  memory: {
    key: 'memory',
    href: '/memory/',
    icon: 'lucide:brain',
    heading: 'How memory works',
    teaser: 'How a conversation becomes a fact, where it is kept, and who can use it.',
  },
  agents: {
    key: 'agents',
    href: '/agents/',
    icon: 'lucide:bot',
    heading: 'How to run agents',
    teaser: 'Meet Hermes, give it work, approve what it asks, and hand it tasks from your laptop.',
  },
};

export const HOW_KEYS = Object.keys(HOW_PAGES) as HowKey[];

/** Three short promises under every page's opening paragraph. */
export const HOW_META = ['Plain words first', 'Pictures of the dashboard', 'Commands at the end'];

/**
 * The dashboard pictures come from the capture set in src/data/screenshots.json,
 * which is taken on sample data. Said once on every page, as on the landing page.
 */
export const HOW_CAPTURE_NOTE = 'The dashboard pictures on this page show sample data.';
