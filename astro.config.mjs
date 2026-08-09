// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightBlog from 'starlight-blog';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

const nav = JSON.parse(readFileSync(new URL('./src/data/nav.json', import.meta.url), 'utf8'));
const socialHref = (id) => nav.social.find((s) => s.id === id).href;

export default defineConfig({
	site: 'https://hal0.dev',

	// The docs root has no index page (Starlight autogenerates groups under
	// /docs/<group>). Send /docs and /docs/ to the first tutorial so the
	// long-standing nav link to /docs/ resolves instead of 404ing.
	redirects: {
		'/docs': '/docs/getting-started/',
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
			customCss: ['./src/styles/global.css', './src/styles/site-blog-kb.css'],
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
			// Diátaxis 4-group IA. Each group autogenerates from its directory,
			// so adding a page = dropping a .mdx into the dir + sidebar.order.
			// reference/api/ nests automatically as a collapsible subgroup.
			sidebar: [
				{
					label: 'Start here',
					items: [{ autogenerate: { directory: 'docs/getting-started' } }],
				},
				{
					label: 'Concepts',
					items: [{ autogenerate: { directory: 'docs/concepts' } }],
				},
				{
					label: 'Guides',
					items: [{ autogenerate: { directory: 'docs/guides' } }],
				},
				{
					label: 'Operate',
					items: [{ autogenerate: { directory: 'docs/operate' } }],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'docs/reference' } }],
				},
				{
					// Knowledge base: undated, reviewed, community-editable — same
					// Starlight sidebar/TOC shell as docs, distinguished only by the
					// KbStamp badge each kb/**/*.mdx page renders inline (surface tag
					// + "reviewed <date>", not "applies to v0.5.x"). One explicit
					// sub-group per category (rather than one `autogenerate: { directory:
					// 'kb' }`) so the sidebar label can use the comp's copy verbatim
					// ("runtime & backends") instead of Starlight's dash-to-space
					// titleisation of the directory slug ("Runtime And Backends").
					label: 'Knowledge base',
					items: [
						{ label: 'Getting started', items: [{ autogenerate: { directory: 'kb/getting-started' } }] },
						{ label: 'Hardware notes', items: [{ autogenerate: { directory: 'kb/hardware-notes' } }] },
						{ label: 'Runtime & backends', items: [{ autogenerate: { directory: 'kb/runtime-and-backends' } }] },
						{ label: 'Models & quants', items: [{ autogenerate: { directory: 'kb/models-and-quants' } }] },
						{ label: 'Operating hal0', items: [{ autogenerate: { directory: 'kb/operating-hal0' } }] },
						{ label: 'Tool reviews', items: [{ autogenerate: { directory: 'kb/tool-reviews' } }] },
					],
				},
			],
			components: {
				// Inline the wordmark SVG so the "hal" glyphs inherit
				// the docs nav text colour (white in dark, dark in light).
				// Starlight's default loads the SVG as <img>, which traps
				// currentColor and leaves the "hal" invisible on dark.
				SiteTitle: './src/components/StarlightSiteTitle.astro',
				PageFrame: './src/components/StarlightPageFrame.astro',
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

	vite: {
		plugins: [tailwindcss()],
		server: {
			allowedHosts: ['hal0-web.thinmint.dev', 'localhost', '.thinmint.dev'],
		},
	},
});
