/**
 * changelog.js — parse hal0's CHANGELOG.md into structured data.
 *
 * Source: src/data/changelog.md (synced from the product repo by
 * scripts/sync-changelog.mjs at build time). Consumed by /releases (the
 * unified page — /changelog and /releases used to be separate pages both
 * calling this; they're merged now, with /changelog redirecting into
 * /releases). Markdown bodies are rendered to HTML with `marked` so the
 * branded page can keep the prose, links, and lists from the source.
 *
 * The CHANGELOG grammar (Keep-a-Changelog-ish):
 *   ## [vX.Y.Z[-pre]] — DATE      ← one version block, newest first
 *   <intro paragraph(s)>
 *   ### Section                   ← Added / Changed / Removed / Breaking / …
 *   - item
 * Link-reference definitions ([v1.0.0]: https://…) sit at the very bottom.
 *
 * A heading is not proof of a release: the CHANGELOG can document content
 * ahead of the next git tag. The sync step also records every GitHub release
 * tag (src/data/release-tags.json); pass that list as `{ tags }` and each
 * entry is marked `untagged` when no matching tag exists, and `latestTagged`
 * is the newest stable entry that really shipped.
 */
import { marked } from 'marked';

marked.setOptions({ mangle: false, headerIds: false });

/** Strip trailing `[label]: url` link-reference definitions. */
function stripLinkRefs(md) {
  return md
    .split('\n')
    .filter((line) => !/^\[[^\]]+\]:\s+\S+/.test(line))
    .join('\n');
}

/**
 * Classify a `### Section` heading into a kind used for badge styling.
 * Keep the source heading text verbatim for display; this only colours it.
 */
function sectionKind(title) {
  const t = title.toLowerCase();
  if (t.includes('breaking') || t.includes('upgrade')) return 'breaking';
  if (t.includes('removed')) return 'removed';
  if (t.includes('fixed')) return 'fixed';
  if (t.includes('added') || t.includes('feature') || t.includes('new'))
    return 'added';
  if (t.includes('changed') || t.includes('improved')) return 'changed';
  return 'note';
}

// Version positioning policy: any semver pre-release suffix
// (-alpha/-beta/-rc/-dev/-nightly…) or PEP 440 compact segment marks a
// pre-release; everything else is stable. `version` is the bare version
// without brackets, e.g. "1.4.0-rc.1" or "v1.3.0".
export function isPrerelease(version) {
  // Hyphenated word-form tags: v0.8.1-beta.2, v0.8.0-beta.3, v0.5.1-alpha.1, …
  if (/-(alpha|beta|rc|pre|dev|nightly)\b/i.test(version)) return true;
  // PEP 440 compact pre-release segments with no separator before the next
  // release: v0.8.4b1, v0.8.3b1, v0.8.2b4 (a=alpha, b=beta, rc=release
  // candidate). Anchored at the end so a plain release number like "v0.2.0"
  // never matches.
  if (/\d(?:a|b|rc)\d*$/i.test(version)) return true;
  return false;
}

/**
 * @typedef {Object} ChangelogSection
 * @property {string} title
 * @property {'breaking'|'added'|'changed'|'removed'|'fixed'|'note'} kind
 * @property {string} html
 */

/**
 * @typedef {Object} ChangelogVersion
 * @property {string} version
 * @property {string} slug
 * @property {string|null} date       ISO date only (annotation split off)
 * @property {string|null} dateNote   parenthesised header annotation, if any
 * @property {boolean} prerelease
 * @property {boolean} stable
 * @property {boolean} [gaPreview]
 * @property {boolean} untagged  true when `tags` was given and has no tag for this version
 * @property {string} intro
 * @property {ChangelogSection[]} sections
 */

/**
 * Parse the raw changelog markdown into structured version blocks.
 * @param {string} raw
 * @param {{tags?: string[]}} [opts] GitHub release tag names (release-tags.json `tags`)
 * @returns {{versions: ChangelogVersion[], latest: ChangelogVersion|null, latestStable: ChangelogVersion|null, latestPrerelease: ChangelogVersion|null, latestTagged: ChangelogVersion|null}}
 */
export function parseChangelog(raw, { tags } = {}) {
  const body = stripLinkRefs(raw);
  // Everything from the first version header onward; drop the file preamble.
  const firstIdx = body.indexOf('\n## [');
  const versionsMd = firstIdx === -1 ? '' : body.slice(firstIdx);

  // Split on the version headers, keeping the header line with its block.
  const blocks = versionsMd
    .split(/\n(?=## \[)/)
    .map((b) => b.trim())
    .filter(Boolean);

  const versions = blocks
    // Drop the "## [Unreleased]" scaffolding header some CHANGELOG.md commits
    // carry above the newest tag. It isn't a shipped version — if it were
    // kept, it'd sort first (newest position) and, having no -alpha/-beta/-rc
    // suffix, would default to `stable`, hijacking both `latest` and
    // `latestStable` away from the real newest release.
    .filter((block) => !/^##\s*\[unreleased\]\s*$/im.test(block.split('\n')[0] ?? ''))
    .map((block) => {
      const lines = block.split('\n');
      const header = lines.shift() ?? '';
      // ## [v0.5.1-alpha.1] — 2026-06-15
      // Some headers annotate the date: "## [1.0.0-rc.1] — 2026-08-01
      // (R5 · the rework release)". Split the ISO date from the note so
      // the sidebar's date column never wraps into free text; the note
      // rides separately as `dateNote`.
      const m = header.match(/^##\s*\[([^\]]+)\]\s*(?:[—–-]\s*(.+))?$/);
      const version = m?.[1]?.trim() ?? header.replace(/^##\s*/, '').trim();
      const dateRaw = m?.[2]?.trim() ?? null;
      const dm = dateRaw?.match(/^(\d{4}-\d{2}-\d{2})\s*(?:\((.+)\))?\s*$/);
      const date = dm ? dm[1] : dateRaw;
      const dateNote = dm?.[2]?.trim() ?? null;

      const rest = lines.join('\n');
      const introMd = rest.split(/\n### /)[0].trim();
      const sectionChunks = rest.split(/\n### /).slice(1);

      const sections = sectionChunks.map((chunk) => {
        const nl = chunk.indexOf('\n');
        const title = (nl === -1 ? chunk : chunk.slice(0, nl)).trim();
        const sbody = nl === -1 ? '' : chunk.slice(nl + 1).trim();
        return { title, kind: sectionKind(title), html: marked.parse(sbody) };
      });

      const pre = isPrerelease(version);
      return {
        version,
        slug: version.replace(/[^a-z0-9.-]/gi, '-').toLowerCase(),
        date,
        dateNote,
        prerelease: pre,
        stable: !pre,
        intro: introMd ? marked.parse(introMd) : '',
        sections,
      };
    });

  // A GA content section can precede its tag: the CHANGELOG documents the
  // full 1.0.0 content while the shipped tags are still 1.0.0-rc.N (the rc
  // sections above it reference it as "the preview snapshot"). Such a block
  // has a stable version string but a *newer* (earlier-listed) pre-release
  // of the same base version — flag it so it's never presented as shipped.
  const baseOf = (v) => v.replace(/^v/i, '').split('-')[0];
  versions.forEach((v, i) => {
    v.gaPreview =
      v.stable &&
      versions.slice(0, i).some((n) => n.prerelease && baseOf(n.version) === baseOf(v.version));
  });

  const tagSet = Array.isArray(tags) ? new Set(tags) : null;
  versions.forEach((v) => {
    const bare = v.version.replace(/^v/i, '');
    v.untagged = tagSet ? !(tagSet.has(`v${bare}`) || tagSet.has(bare)) : false;
  });

  const latestStable = versions.find((v) => v.stable && !v.gaPreview) ?? null;
  const latestPrerelease = versions.find((v) => v.prerelease) ?? null;

  // Newest stable entry that actually shipped. Without a tag list, fall back
  // to latestStable.
  const latestTagged = tagSet
    ? (versions.find((v) => !v.untagged && v.stable && !v.gaPreview) ?? null)
    : latestStable;

  return { versions, latest: versions[0] ?? null, latestStable, latestPrerelease, latestTagged };
}

/** GitHub release tag URL for a given version. */
export function releaseTagUrl(version) {
  // Git tags are v-prefixed (v1.0.0-rc.3); newer CHANGELOG headers drop the
  // prefix ([1.0.0-rc.3]), so normalise here.
  const tag = /^v/i.test(version) ? version : `v${version}`;
  return `https://github.com/hal0ai/hal0/releases/tag/${tag}`;
}

/**
 * Inner HTML of every top-level `<li>` in a rendered section, in order.
 * Sections are already HTML (marked), so this walks the `<li>` / `</li>`
 * tags with a depth counter: a nested list's items stay inside their parent
 * and are dropped from the excerpt (a preview wants the headline bullet, not
 * its sub-points). A lone `<p>` wrapper from a loose list is unwrapped so the
 * result drops straight into an `<li>` or a card without extra block margins.
 * @param {string} html
 * @returns {string[]}
 */
function topLevelItems(html) {
  const items = [];
  const tag = /<(\/?)li(?:\s[^>]*)?>/gi;
  let depth = 0;
  let start = 0;
  let m;
  while ((m = tag.exec(html))) {
    if (m[1] === '') {
      if (depth === 0) start = m.index + m[0].length;
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0) {
        let inner = html.slice(start, m.index);
        // Drop nested lists from the excerpt.
        inner = inner.replace(/<(ul|ol)[\s\S]*<\/\1>/i, '').trim();
        const para = inner.match(/^<p>([\s\S]*)<\/p>$/);
        if (para && !para[1].includes('<p>')) inner = para[1].trim();
        if (inner) items.push(inner);
      }
    }
  }
  return items;
}

/**
 * Short list of what a release is about, as `<li>` inner-HTML strings.
 * Prefers the entry's `### Highlights` bullets; entries without one fall back
 * to the first bullets of its Added, then Changed, then Fixed sections, so
 * older releases still get a summary. Entries with no bullets at all (an
 * intro paragraph and nothing else) return `[]`.
 * @param {ChangelogVersion} version
 * @param {number} [max]
 * @returns {string[]}
 */
export function releaseHighlights(version, max = 3) {
  const byTitle = (name) =>
    (version.sections ?? []).filter((s) => s.title.trim().toLowerCase() === name);

  const highlights = byTitle('highlights').flatMap((s) => topLevelItems(s.html));
  if (highlights.length) return highlights;

  const picked = [];
  for (const name of ['added', 'changed', 'fixed']) {
    for (const s of byTitle(name)) {
      for (const item of topLevelItems(s.html)) {
        picked.push(item);
        if (picked.length >= max) return picked;
      }
    }
  }
  return picked;
}

/**
 * Split the version list into the entries the releases page renders in full
 * and the ones it only links. `recent` is the first `recent` tagged entries,
 * plus any untagged entry that sits among them: content the changelog
 * documents ahead of its git tag (typically the top entry) must stay visible
 * with its "unreleased" badge, and does not count against the quota. Once
 * `recent` tagged entries are in, everything after goes to `archive`, so
 * long-dead untagged history (a heading that never got a GitHub release) is
 * archived with the rest rather than resurfacing.
 * @param {ChangelogVersion[]} versions newest first
 * @param {number} [recent]
 * @returns {{recent: ChangelogVersion[], archive: ChangelogVersion[]}}
 */
export function splitReleases(versions, recent = 8) {
  const head = [];
  const archive = [];
  let tagged = 0;
  for (const v of versions) {
    if (tagged >= recent) archive.push(v);
    else {
      head.push(v);
      if (!v.untagged) tagged += 1;
    }
  }
  return { recent: head, archive };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * Plain text of a rendered HTML fragment: tags dropped, the entities `marked`
 * emits decoded, whitespace collapsed. For one-line summaries, where the
 * result is escaped again by the template.
 * @param {string} html
 * @returns {string}
 */
export function plainText(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, dec, hex, name) => {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return ENTITIES[name.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

// Display order for an entry's sections: what a reader needs first. Titles not
// listed keep their changelog order after these.
const SECTION_ORDER = ['highlights', 'breaking', 'added', 'changed', 'removed', 'fixed', 'security'];

// Sections an operator must read in full before upgrading: the maintainers'
// own summary, what breaks, what to migrate (hal0's changelog heads that one
// both "Migrations" and "Operator migrations"), and security fixes. An excerpt
// never cuts these; a truncated Breaking list is worse than a long page.
const NEVER_CUT = new Set(['highlights', 'breaking', 'migrations', 'operator migrations', 'security']);

/**
 * Bulleted sections of an entry, ready to render as a bounded excerpt.
 * Highlights, Breaking, Migrations (also titled "Operator migrations") and
 * Security are never cut. Every other section (Added, Changed, Removed, Fixed
 * and the rest) keeps its first `max` bullets and reports how many it dropped,
 * so a release with a hundred fixes stays short and points at the full notes.
 * Sections with no bullets (prose, tables) are left out, so a Highlights
 * section that is only prose does not count as Highlights.
 * @param {ChangelogVersion} version
 * @param {{max?: number, skipHighlights?: boolean}} [opts]
 * @returns {{title: string, kind: ChangelogSection['kind'], items: string[], more: number}[]}
 */
export function releaseSections(version, { max = 6, skipHighlights = false } = {}) {
  const rank = (title) => {
    const i = SECTION_ORDER.indexOf(title.trim().toLowerCase());
    return i === -1 ? SECTION_ORDER.length : i;
  };
  return (version.sections ?? [])
    .map((s, index) => ({ s, index, all: topLevelItems(s.html) }))
    .filter(({ s, all }) => all.length && !(skipHighlights && rank(s.title) === 0))
    .sort((a, b) => rank(a.s.title) - rank(b.s.title) || a.index - b.index)
    .map(({ s, all }) => {
      const shown = NEVER_CUT.has(s.title.trim().toLowerCase()) ? all : all.slice(0, max);
      return { title: s.title, kind: s.kind, items: shown, more: all.length - shown.length };
    });
}
