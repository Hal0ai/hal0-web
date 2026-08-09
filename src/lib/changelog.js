/**
 * changelog.js — parse hal0's CHANGELOG.md into structured data.
 *
 * Source: src/data/changelog.md (synced from the product repo by
 * scripts/sync-changelog.mjs at build time). Consumed by /changelog (the
 * unified page — /changelog and /releases used to be separate pages both
 * calling this; they're merged now, with /releases redirecting into
 * /changelog). Markdown bodies are rendered to HTML with `marked` so the
 * branded page can keep the prose, links, and lists from the source.
 *
 * The CHANGELOG grammar (Keep-a-Changelog-ish):
 *   ## [vX.Y.Z[-pre]] — DATE      ← one version block, newest first
 *   <intro paragraph(s)>
 *   ### Section                   ← Added / Changed / Removed / Breaking / …
 *   - item
 * Link-reference definitions ([v0.2.0]: https://…) sit at the very bottom.
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

// ─────────────────────────────────────────────────────────────────────────
// CONTRIBUTION POINT — version positioning policy.
//
// This single predicate decides whether a release is shown as a stable
// headline or a pre-release on /releases and /changelog. It encodes the
// positioning decision: hal0's only stable line so far is v0.2.0; every
// v0.3.x–v0.5.x tag carries a `-alpha`/`-beta`/`-rc` suffix and must be
// labelled pre-release (never presented as GA).
//
// Decide how strict to be. Options to weigh:
//   • Treat ANY semver pre-release suffix (-alpha/-beta/-rc/-…) as
//     pre-release (recommended — matches semver and is future-proof).
//   • Hard-code a known-stable allow-list of tags.
//   • Add a "channel" concept (stable | next | nightly) if you later want
//     three tiers on the page.
//
// Implement the body. `version` is the bare tag without brackets,
// e.g. "v0.5.1-alpha.1" or "v0.2.0". Return true for pre-release.
// ─────────────────────────────────────────────────────────────────────────
export function isPrerelease(version) {
  // Hyphenated word-form tags: v0.8.1-beta.2, v0.8.0-beta.3, v0.5.1-alpha.1, …
  if (/-(alpha|beta|rc|pre|dev)\b/i.test(version)) return true;
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
 * @property {string|null} date
 * @property {boolean} prerelease
 * @property {boolean} stable
 * @property {boolean} [gaPreview]
 * @property {string} intro
 * @property {ChangelogSection[]} sections
 */

/**
 * Parse the raw changelog markdown into structured version blocks.
 * @param {string} raw
 * @returns {{versions: ChangelogVersion[], latest: ChangelogVersion|null, latestStable: ChangelogVersion|null, latestPrerelease: ChangelogVersion|null}}
 */
export function parseChangelog(raw) {
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
      const m = header.match(/^##\s*\[([^\]]+)\]\s*(?:[—–-]\s*(.+))?$/);
      const version = m?.[1]?.trim() ?? header.replace(/^##\s*/, '').trim();
      const date = m?.[2]?.trim() ?? null;

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

  const latestStable = versions.find((v) => v.stable && !v.gaPreview) ?? null;
  const latestPrerelease = versions.find((v) => v.prerelease) ?? null;

  return { versions, latest: versions[0] ?? null, latestStable, latestPrerelease };
}

/** GitHub release tag URL for a given version. */
export function releaseTagUrl(version) {
  // Git tags are v-prefixed (v1.0.0-rc.3); newer CHANGELOG headers drop the
  // prefix ([1.0.0-rc.3]), so normalise here.
  const tag = /^v/i.test(version) ? version : `v${version}`;
  return `https://github.com/hal0ai/hal0/releases/tag/${tag}`;
}
