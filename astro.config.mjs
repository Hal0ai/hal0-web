// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightBlog from 'starlight-blog';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

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
			customCss: ['./src/styles/global.css'],
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/hal0ai/hal0',
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
					label: 'Reference',
					items: [{ autogenerate: { directory: 'docs/reference' } }],
				},
			],
			components: {
				// Inline the wordmark SVG so the "hal" glyphs inherit
				// the docs nav text colour (white in dark, dark in light).
				// Starlight's default loads the SVG as <img>, which traps
				// currentColor and leaves the "hal" invisible on dark.
				SiteTitle: './src/components/StarlightSiteTitle.astro',
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
