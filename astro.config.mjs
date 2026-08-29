// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightBlog from 'starlight-blog';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

const nav = JSON.parse(readFileSync(new URL('./src/data/nav.json', import.meta.url), 'utf8'));
const socialHref = (id) => nav.social.find((s) => s.id === id).href;

// GENERATED — 44 entries mapping old hal0.dev/docs/<section>/<slug>/
// paths (trailing slash — Starlight's own canonical form, and the key
// shape hal0's redirect_map.py actually emits) to their forum.hal0.dev
// topic URLs. Produced by hal0's scripts/docs_discourse_sync
// (redirect_map.py's redirect-map.json output, copied here verbatim) —
// do not hand-edit; a re-run of that sync is the only thing that should
// touch this file.
//
// Astro's redirect-route compiler strips a trailing slash off EVERY
// redirect key before building its route regex (parseRoute's
// `removeTrailingForwardSlash`), and the Vercel adapter doesn't add
// trailing-slash leniency back in unless astro.config's own
// `trailingSlash` is set away from its default — which this project
// deliberately doesn't do site-wide (see
// scripts/patch-vercel-docs-redirects.mjs's banner for why). So on its
// own, spreading this object into `redirects` below would 301 the
// no-slash form of each path but 404 the (canonical, bookmarked)
// trailing-slash form. `postbuild` runs that script to patch both forms
// back in at the compiled-Vercel-route level, scoped to just these 44
// forum.hal0.dev redirects.
const kbRedirects = Object.fromEntries(
	Object.entries(
		JSON.parse(
			readFileSync(new URL('./src/data/kb-redirects.json', import.meta.url), 'utf8'),
		),
	).filter(([key]) => key.startsWith('/kb/')),
);
const docsRedirects = JSON.parse(
	readFileSync(new URL('./src/data/docs-redirects.json', import.meta.url), 'utf8'),
);

export default defineConfig({
	site: 'https://hal0.dev',

	// /docs is now a real hub page (src/pages/docs/index.astro) — a map of
	// every section plus the knowledge base — rather than a redirect that
	// dropped readers into the middle of Starlight's sidebar. Only
	// /releases still redirects.
	//
	// /changelog and /releases were merged into one page (the KB-shaped
	// unified release history, src/pages/changelog.astro) that lives at
	// /changelog — /releases redirects there so old links/bookmarks keep
	// working.
	redirects: {
		'/releases': '/changelog',
		// The KB landing was folded into the /docs hub (its six category
		// cards live there now), so /kb has no page of its own — but the
		// ARTICLES under /kb/<category>/<page>/ are untouched and still
		// Starlight routes. Only the bare landing URL redirects.
		//
		// Astro compiles this to an EXACT-match route (`^/kb$`, no trailing
		// slash — same string either way this key is written) once the
		// Vercel adapter is in play (added below for the DiscourseConnect
		// SSO API routes). Before the adapter this didn't matter: Astro
		// emitted a real dist/kb/index.html file and static hosting serves
		// that for both `/kb` and `/kb/`. Now every internal link to this
		// route must match the compiled form exactly (no trailing slash) or
		// it 404s instead of redirecting — see src/pages/docs/index.astro's
		// "knowledge base" link.
		//
		// `/kb/` (trailing slash) used to 404 for exactly this reason. Listing
		// both forms here does NOT help -- Astro normalizes the trailing slash
		// off a redirect's own key before compiling, so both collapse to the
		// same `^/kb$` route. The slash tolerance is added after the build, by
		// scripts/patch-vercel-docs-redirects.mjs, which already does this for
		// the forum redirects below; see its banner for why the site-wide
		// `trailingSlash` setting is the wrong lever.
		//
		// The target is the hub's knowledge-base section rather than the top
		// of the hub: that section IS the KB landing (the standalone page was
		// retired in #103).
		// The KB itself is on the forum now, so the bare landing goes to the
		// category rather than the hub's summary of it.
		'/kb': 'https://forum.hal0.dev/c/kb/12',
		// hal0's 44 product docs moved off hal0.dev to forum.hal0.dev
		// (Discourse topics, Docs category) — every /docs/<section>/<slug>
		// path (both trailing-slash forms) 301s straight to its topic. The
		// docs hub (/docs/) and the four section listing pages
		// (/docs/<section>/) are NOT in this map — they stay real pages, now
		// rebuilt to link out to the forum instead of rendering Starlight
		// content. See docsRedirects' own banner comment above.
		// The /docs hub and its four section listing pages are retired: the
		// forum's Docs category renders the same tree with more in it (six
		// sections including Troubleshooting, four topics per card, the
		// doc-categories sidebar), and keeping a second copy on hal0.dev meant
		// keeping two generated data files in step with it. They were already
		// out of step -- the hub knew five sections, the forum had six.
		'/docs': 'https://forum.hal0.dev/c/docs/11',
		'/docs/getting-started': 'https://forum.hal0.dev/c/docs/docs-getting-started/19',
		'/docs/concepts': 'https://forum.hal0.dev/c/docs/docs-concepts/20',
		'/docs/guides': 'https://forum.hal0.dev/c/docs/docs-guides/21',
		'/docs/operate': 'https://forum.hal0.dev/c/docs/docs-operate/22',
		'/docs/reference': 'https://forum.hal0.dev/c/docs/docs-reference/23',
		...docsRedirects,
		// The six KB articles moved to forum.hal0.dev as wiki topics, the same
		// way the 44 product docs did. Same 301 shape, same postbuild
		// slash-tolerance pass (the patch keys off the forum.hal0.dev Location,
		// so these are covered without touching it).
		...kbRedirects,
	},

	integrations: [
		// Lucide via the pre-bundled @iconify-json/lucide set. SVG sprites
		// are tree-shaken at build time, so unused icons don't ship.
		icon({ include: { lucide: ['*'] } }),
		starlight({
			title: 'hal0',
			description: 'Local AI for your home. Strix Halo native.',
			// Blog nests under the docs Starlight instance (/blog) so it inherits
			// the dark-first brand chrome. The marketing apex is untouched.
			plugins: [
				starlightBlog({
					title: 'Blog',
					// Blog lives in the shared header nav (StarlightSiteTitle override),
					// so suppress starlight-blog's own header link to avoid duplication.
					navigation: 'none',
					authors: {
						hal0: {
							name: 'The hal0 team',
							url: 'https://github.com/hal0ai/hal0',
						},
					},
				}),
			],
			logo: {
				src: './src/assets/wordmark.svg',
				replacesTitle: true,
			},
			favicon: '/favicon.svg',
			customCss: [
				'./src/styles/global.css',
				'./src/styles/site-blog-kb.css',
				'./src/styles/site-docs.css',
				'./src/styles/site-starlight.css',
			],
			// Code blocks read as the comp's `.well` terminal idiom (hal0-site.css
			// `.well`: bg-sunken, 1px border, mono 12.5px/1.7) — themed through
			// Expressive Code's own hooks instead of fighting its emitted CSS.
			// Values are CSS custom properties so both themes resolve from
			// tokens.css automatically; Starlight's default dual syntax themes
			// (and their dark/light switching) stay in place.
			expressiveCode: {
				styleOverrides: {
					borderColor: 'var(--hal0-border)',
					borderRadius: 'var(--hal0-rad, 6px)',
					borderWidth: '1px',
					codeBackground: 'var(--hal0-bg-sunken)',
					codeFontFamily: 'var(--hal0-font-mono)',
					codeFontSize: '12.5px',
					codeLineHeight: '1.7',
					uiFontFamily: 'var(--hal0-font-mono)',
					// NOTE: a handful of frame settings (terminal + active-tab
					// backgrounds, titlebar, dots, copy-button foreground) CANNOT
					// be set here — Starlight's two built-in syntax themes carry
					// their own per-theme styleOverrides for those keys, and EC
					// gives theme-level overrides precedence over this global
					// block. Those live as `--ec-frm-*` CSS variables in
					// site-starlight.css instead (EC's documented variable layer).
					frames: {
						frameBoxShadowCssValue: 'none',
						editorTabBarBackground: 'var(--hal0-bg-elevated)',
						editorTabBarBorderBottomColor: 'var(--hal0-border)',
						editorActiveTabForeground: 'var(--hal0-fg)',
						editorActiveTabIndicatorTopColor: 'var(--hal0-accent)',
						editorActiveTabIndicatorBottomColor: 'transparent',
						inlineButtonBorder: 'var(--hal0-border)',
					},
				},
			},
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: socialHref('github'),
				},
				{
					icon: 'discord',
					label: 'Discord',
					href: socialHref('discord'),
				},
			],
			// Dark-first; the toggle still lives in the top bar.
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
			},
			// Pages outside /docs use their own marketing layout, so the
			// sidebar only applies inside /docs/*.
			// The five Diátaxis docs groups that used to autogenerate here
			// (Start here/Concepts/Guides/Operate/Reference) are gone —
			// src/content/docs/docs/** no longer exists now that hal0's 44
			// product docs live as forum.hal0.dev topics (see the
			// `docsRedirects` spread above). `autogenerate: { directory }`
			// against a directory that doesn't exist is a build error, so
			// pruning these groups is required, not optional, once that
			// content is removed. The four /docs/<section>/ routes are still
			// real pages (src/pages/docs/*/index.astro, rebuilt to link out to
			// the forum) — they just don't drive this sidebar anymore.
			// No sidebar entries left: the KB articles that filled this moved to
			// forum.hal0.dev as wiki topics (src/data/kb-redirects.json), and the
			// product docs went before them. Starlight still renders /blog via
			// starlight-blog, which brings its own navigation.
			sidebar: [],
			components: {
				// Inline the wordmark SVG so the "hal" glyphs inherit
				// the docs nav text colour (white in dark, dark in light).
				// Starlight's default loads the SVG as <img>, which traps
				// currentColor and leaves the "hal" invisible on dark.
				SiteTitle: './src/components/StarlightSiteTitle.astro',
				PageFrame: './src/components/StarlightPageFrame.astro',
				// Prepends the site nav to the mobile drawer (docs/blog only —
				// KB is byte-frozen); see the component's header comment.
				Sidebar: './src/components/StarlightSidebar.astro',
				// Default title + the "applies to vX.Y" stamp when frontmatter
				// declares `appliesTo`; byte-identical passthrough otherwise.
				PageTitle: './src/components/StarlightPageTitle.astro',
				// Comp's 2-state ThemeToggle instead of the 3-state select —
				// identical button to the marketing SiteHeader's.
				ThemeSelect: './src/components/StarlightThemeSelect.astro',
			},
			// Sensible OG / social defaults.
			head: [
				{
					tag: 'meta',
					attrs: { property: 'og:image', content: '/og-default.png' },
				},
				{
					tag: 'meta',
					attrs: { name: 'twitter:card', content: 'summary_large_image' },
				},
				{
					tag: 'meta',
					attrs: { name: 'theme-color', content: '#0a0a0a' },
				},
				// Screenshot lightbox — binds /screenshots/ images on docs + blog
				// pages (shared with the marketing layout; styles in global.css).
				{
					tag: 'script',
					attrs: { src: '/js/lightbox.js', defer: true },
				},
				// Blog index RSS button — see public/js/blog-rss-button.js for why
				// this is a progressive-enhancement script rather than a template
				// override (starlight-blog's blog index route has no override seam).
				{
					tag: 'script',
					attrs: { src: '/js/blog-rss-button.js', defer: true },
				},
			],
		}),
		sitemap(),
	],

	// `output` stays the default ('static') — the site is still a fully
	// prerendered marketing/docs build. The adapter only exists so a
	// handful of routes (src/pages/api/**) can opt out of prerendering with
	// `export const prerender = false` and run as on-demand Vercel
	// functions (DiscourseConnect SSO + the forum notifications proxy).
	// Everything else keeps building to static HTML same as before.
	adapter: vercel(),

	vite: {
		plugins: [tailwindcss()],
		server: {
			allowedHosts: ['hal0-web.thinmint.dev', 'localhost', '.thinmint.dev'],
		},
	},
});
