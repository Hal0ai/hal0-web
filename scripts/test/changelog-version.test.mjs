import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChangelog } from '../../src/lib/changelog.js';

const RAW = `# Changelog

## [Unreleased]

## [1.4.0] — 2026-10-08

Intro.

### Highlights

- big thing

## [1.3.1-rc.1] — 2026-09-20

### Fixed

- thing

## [1.3.0] — 2026-09-16

### Added

- thing
`;

test('untagged heading first in file is not latestTagged', () => {
  const r = parseChangelog(RAW, { tags: ['v1.3.1-rc.1', 'v1.3.0'] });
  assert.equal(r.latest.version, '1.4.0');
  assert.equal(r.latest.untagged, true);
  assert.equal(r.latestTagged.version, '1.3.0');
});

test('tagged heading is latestTagged', () => {
  const r = parseChangelog(RAW, { tags: ['v1.4.0', 'v1.3.0'] });
  assert.equal(r.latestTagged.version, '1.4.0');
  assert.equal(r.latestTagged.untagged, false);
  assert.equal(r.versions.find((v) => v.version === '1.3.1-rc.1').untagged, true);
});

test('bare (unprefixed) tag names also match', () => {
  const r = parseChangelog(RAW, { tags: ['1.4.0'] });
  assert.equal(r.latestTagged.version, '1.4.0');
});

test('tags omitted falls back to latestStable and nothing is untagged', () => {
  const r = parseChangelog(RAW);
  assert.equal(r.latestTagged, r.latestStable);
  assert.equal(r.latestTagged.version, '1.4.0');
  assert.ok(r.versions.every((v) => v.untagged === false));
});

test('prerelease handling unchanged', () => {
  const r = parseChangelog(RAW, { tags: ['v1.3.1-rc.1', 'v1.3.0'] });
  assert.equal(r.latestPrerelease.version, '1.3.1-rc.1');
  assert.equal(r.latestPrerelease.prerelease, true);
  assert.equal(r.latestStable.version, '1.4.0');
});
