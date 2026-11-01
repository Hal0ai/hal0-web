// src/lib/profile-page.mjs
//
// Pure helpers behind /profiles/<slug>/ (src/pages/profiles/[slug].astro):
// <title> and meta description trimming, the generated description for a
// record with no summary, and the page's JSON-LD nodes. No dependencies, so
// node --test can load it directly.
//
// Every field of a profile record except the slug is optional as far as this
// module is concerned (the page must still build if a record lacks summary,
// author, history, ...), so nothing here assumes a field exists and nothing
// ever interpolates one that doesn't.

import { SITE_URL } from './seo.ts';

export const SITE = SITE_URL;
export const TITLE_SUFFIX = ' · llama.cpp profile | hal0';
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;
export const PROFILES_REPO = 'https://github.com/Hal0ai/hal0-profiles';
export const PROFILES_REPO_BLOB = `${PROFILES_REPO}/blob/main/profiles`;

// Slugs that would collide with a static page under /profiles/. Static routes
// win over [slug].astro, so a record with one of these slugs gets no page of
// its own (and the gallery does not link it).
export const RESERVED_SLUGS = ['submit', 'submitted'];

/** A trimmed non-empty string, or '' for anything else. */
function text(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/**
 * Trim `value` to at most `max` characters. Over-long text is cut on a word
 * boundary and marked with a trailing ellipsis (the ellipsis counts toward
 * `max`). A single token with no usable word boundary is cut hard.
 *
 * @param {string} value
 * @param {number} max
 * @returns {string}
 */
export function clip(value, max) {
  const s = text(value);
  if (s.length <= max) return s;
  const head = s.slice(0, max - 1);
  // If the cut landed exactly between two words the head is already whole.
  const whole = /\s/.test(s[max - 1]) ? head : head.replace(/\s+\S*$/, '');
  const base = whole.length >= max / 2 ? whole : head;
  return `${base.replace(/[\s,;:.\-]+$/, '')}…`;
}

/** True when a profile slug would shadow a static /profiles/<slug>/ page. */
export function isReservedSlug(slug) {
  return RESERVED_SLUGS.includes(slug);
}

/**
 * The records that get a page. Reserved slugs are dropped with a warning; a
 * bad record in the registry must not fail the site build.
 *
 * @template T
 * @param {T[]} records - profiles.json `profiles`
 * @param {(message: string) => void} [warn]
 * @returns {T[]}
 */
export function publishableProfiles(records, warn = console.warn) {
  return records.filter((record) => {
    const slug = record?.profile?.slug;
    if (!isReservedSlug(slug)) return true;
    warn(`[profiles] no page for "${slug}": /profiles/${slug}/ is a static page. Rename the profile in hal0-profiles.`);
    return false;
  });
}

/** The name a record is shown under: its title, else its slug. */
function nameOf(record) {
  return text(record?.profile?.title) || text(record?.profile?.slug) || 'profile';
}

/**
 * `<title>`: "<profile title> · llama.cpp profile | hal0", at most 60
 * characters. The suffix is the part worth keeping in a SERP, so it is the
 * profile title that gets trimmed.
 *
 * @param {object} record - one entry of profiles.json
 * @returns {string}
 */
export function profileTitle(record) {
  return `${clip(nameOf(record), TITLE_MAX - TITLE_SUFFIX.length)}${TITLE_SUFFIX}`;
}

/** One sentence built from whatever the record does have. */
function generatedSentence(record) {
  const intent = text(record?.profile?.intent);
  const model = text(record?.model?.id);
  const lane = text(record?.runner?.lane);
  let s = `${nameOf(record)} is a community llama.cpp profile`;
  if (intent) s += ` for ${intent}`;
  if (model) s += ` on ${model}`;
  if (lane) s += ` (${lane} lane)`;
  return `${s}. Exact flags and config, ready to copy.`;
}

/**
 * Meta description: the profile's own summary trimmed to 155 characters, or a
 * generated sentence when the record has no summary.
 *
 * @param {object} record
 * @returns {string}
 */
export function profileDescription(record) {
  const summary = text(record?.profile?.summary);
  return clip(summary || generatedSentence(record), DESCRIPTION_MAX);
}

/**
 * The history entry with the highest version (history is listed newest first
 * in the registry, but the page does not lean on that).
 *
 * @param {object} record
 * @returns {{ v: number, date?: string, note?: string } | null}
 */
export function latestHistory(record) {
  const history = Array.isArray(record?.history) ? record.history : [];
  return history.reduce((best, h) => (best === null || h.v > best.v ? h : best), null);
}

/** Where the profile's TOML lives in the community registry. */
export function profileTomlUrl(slug) {
  return `${PROFILES_REPO_BLOB}/${slug}.toml`;
}

/**
 * The breadcrumb trail for a profile page, shared by the visible nav and the
 * BreadcrumbList node so the two cannot drift apart.
 *
 * @param {object} record
 * @param {string} url - the page's canonical URL
 * @returns {{ name: string, item: string }[]}
 */
export function profileCrumbs(record, url) {
  return [
    { name: 'Home', item: `${SITE}/` },
    { name: 'Profiles', item: `${SITE}/profiles/` },
    { name: nameOf(record), item: url },
  ];
}

/**
 * The author node: hal0 itself for first-party runs, otherwise the GitHub
 * handle as a Person. Null when the record names nobody.
 */
function authorNode(record) {
  if (record?.profile?.first_party) {
    return { '@type': 'Organization', name: 'hal0', url: SITE };
  }
  const author = text(record?.profile?.author);
  return author ? { '@type': 'Person', name: author, url: `https://github.com/${author}` } : null;
}

/**
 * JSON-LD nodes for the page, in @graph order: the breadcrumb trail, then the
 * profile itself as source code (the thing a visitor copies is a config file).
 * Keys with no value are left out rather than written as null.
 *
 * @param {object} record
 * @param {string} url - the page's canonical URL
 * @returns {Record<string, unknown>[]}
 */
export function profileJsonLd(record, url) {
  const author = authorNode(record);
  const runtime = text(record?.runner?.kind);
  const latest = latestHistory(record);

  const code = {
    '@type': 'SoftwareSourceCode',
    name: nameOf(record),
    description: profileDescription(record),
    url,
    programmingLanguage: 'TOML',
    codeRepository: PROFILES_REPO,
  };
  if (runtime) code.runtimePlatform = runtime;
  if (author) code.author = author;
  if (latest) {
    code.version = String(latest.v);
    if (text(latest.date)) code.dateModified = text(latest.date);
  }

  return [
    {
      '@type': 'BreadcrumbList',
      itemListElement: profileCrumbs(record, url).map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        ...crumb,
      })),
    },
    code,
  ];
}
