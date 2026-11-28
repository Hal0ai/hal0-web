/**
 * /profiles/index.json: the catalog hal0's dashboard reads to list the
 * profiles a box can import (Profiles page, GET /api/profile-addons on the
 * box). One row per `/profiles/<slug>.hal0profile.json`, built from the same
 * snapshot, so a row's checksum is always its envelope's.
 */
import type { APIRoute } from 'astro';
import profilesSnapshot from '../../data/profiles.json';
import { addonIndex } from '../../lib/profile-envelope.mjs';
import { publishableProfiles } from '../../lib/profile-page.mjs';

export const GET: APIRoute = () =>
  new Response(`${JSON.stringify(addonIndex(publishableProfiles(profilesSnapshot.profiles, () => {})), null, 2)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
