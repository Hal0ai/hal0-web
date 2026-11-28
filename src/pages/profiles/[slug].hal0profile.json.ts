/**
 * /profiles/<slug>.hal0profile.json: the envelope hal0's dashboard imports
 * (Profiles → Import). One file per importable profile, built from the same
 * snapshot as the gallery.
 *
 * A built-in profile gets no file: its name is taken on every box, so an
 * import of it could only collide.
 */
import type { APIRoute } from 'astro';
import profilesSnapshot from '../../data/profiles.json';
import { isSeed, profileEnvelope } from '../../lib/profile-envelope.mjs';
import { publishableProfiles } from '../../lib/profile-page.mjs';

export function getStaticPaths() {
  return publishableProfiles(profilesSnapshot.profiles, () => {})
    .filter((record) => !isSeed(record))
    .map((record) => ({ params: { slug: record.profile.slug }, props: { record } }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(`${JSON.stringify(profileEnvelope(props.record), null, 2)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
