/**
 * Build-time Discourse fetch wrapper for the homepage's "latest forum
 * topics" strip.
 *
 * The forum (forum.hal0.dev) is not live yet. Per the homepage design
 * (docs/design/2026-08-09-community-comps/README.md, screen 6), the strip
 * is code-present but renders nothing until it is: no skeleton, no error
 * card, the page just closes up. That degrade happens here, at the single
 * call site, so the page component only ever has to check "is this null".
 *
 * Once forum.hal0.dev is live, set DISCOURSE_URL (e.g.
 * https://forum.hal0.dev) at build time and this starts returning real
 * topics — no other code changes required.
 */

export interface ForumTopic {
  id: number;
  title: string;
  href: string;
  category: string;
  replies: number;
  author: string;
  authorAvatar: string | null;
  activityAt: string;
}

interface DiscoursePoster {
  user_id: number;
  description?: string;
}

interface DiscourseUser {
  id: number;
  username: string;
  avatar_template: string;
}

interface DiscourseTopic {
  id: number;
  title: string;
  slug: string;
  posts_count: number;
  reply_count: number;
  category_id: number;
  last_posted_at: string;
  created_at: string;
  posters: DiscoursePoster[];
}

interface DiscourseLatestResponse {
  users: DiscourseUser[];
  topic_list: { topics: DiscourseTopic[] };
}

interface DiscourseCategory {
  id: number;
  slug: string;
}

interface DiscourseCategoriesResponse {
  category_list: { categories: DiscourseCategory[] };
}

const FETCH_TIMEOUT_MS = 4000;
const TOPIC_COUNT = 5;
const REGULAR_POSTER_ROLE = 'Original Poster';

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function avatarUrl(base: string, template: string): string {
  // Discourse avatar_template carries a "{size}" placeholder, e.g.
  // "/user_avatar/forum.hal0.dev/kyuz0/{size}/12345_2.png".
  return `${base}${template.replace('{size}', '48')}`;
}

/**
 * Fetch the latest topics from a Discourse instance's standard
 * `/latest.json` + `/categories.json` endpoints. Returns null — never
 * throws — when DISCOURSE_URL is unset or the forum is unreachable at
 * build time, so the caller can omit the section entirely.
 */
export async function fetchLatestTopics(discourseUrl: string | undefined = process.env.DISCOURSE_URL): Promise<ForumTopic[] | null> {
  if (!discourseUrl) return null;

  const base = discourseUrl.replace(/\/+$/, '');
  const [latest, categories] = await Promise.all([
    fetchJson<DiscourseLatestResponse>(`${base}/latest.json`),
    fetchJson<DiscourseCategoriesResponse>(`${base}/categories.json`),
  ]);
  if (!latest || !latest.topic_list?.topics?.length) return null;

  const categoryBySlug = new Map((categories?.category_list.categories ?? []).map((c) => [c.id, c.slug]));
  const userById = new Map(latest.users.map((u) => [u.id, u]));

  return latest.topic_list.topics.slice(0, TOPIC_COUNT).map((topic) => {
    const posterEntry =
      topic.posters.find((p) => p.description === REGULAR_POSTER_ROLE) ?? topic.posters[0];
    const poster = posterEntry ? userById.get(posterEntry.user_id) : undefined;

    return {
      id: topic.id,
      title: topic.title,
      href: `${base}/t/${topic.slug}/${topic.id}`,
      category: categoryBySlug.get(topic.category_id) ?? 'general',
      replies: topic.reply_count,
      author: poster?.username ?? 'unknown',
      authorAvatar: poster ? avatarUrl(base, poster.avatar_template) : null,
      activityAt: topic.last_posted_at,
    };
  });
}
