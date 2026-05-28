// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	site: 'https://hal0.dev',

	integrations: [
		// Lucide via the pre-bundled @iconify-json/lucide set. SVG sprites
		// are tree-shaken at build time, so unused icons don't ship.
		icon({ include: { lucide: ['*'] } }),
		starlight({
			title: 'hal0',
			description: 'Local AI for your home. Strix Halo native.',
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
			sidebar: [
				{
					label: 'Getting started',
					items: [{ autogenerate: { directory: 'docs/getting-started' } }],
				},
				{
					label: 'Hardware',
					items: [{ autogenerate: { directory: 'docs/hardware' } }],
				},
				{
					label: 'Slots',
					items: [{ autogenerate: { directory: 'docs/slots' } }],
				},
				{
					label: 'API',
					items: [{ autogenerate: { directory: 'docs/api' } }],
				},
				{
					label: 'Agents',
					items: [
						{ label: 'Overview', link: '/docs/agents/overview/' },
						{
							label: 'Hermes-Agent bootstrap',
							link: '/docs/agents/hermes-bootstrap/',
						},
						{ label: 'Agent identity', link: '/docs/agents/identity/' },
						{
							label: 'MCP client allow-list',
							link: '/docs/agents/mcp-client/',
						},
					],
				},
				{
					label: 'MCP',
					items: [
						{ label: 'Overview', link: '/docs/mcp/overview/' },
						{ label: 'hal0-admin', link: '/docs/mcp/hal0-admin/' },
						{ label: 'hal0-memory', link: '/docs/mcp/hal0-memory/' },
					],
				},
				{
					label: 'Memory',
					items: [
						{ label: 'Overview', link: '/docs/memory/overview/' },
						{ label: 'Graph extraction', link: '/docs/memory/graph/' },
						{
							label: 'Private namespacing',
							link: '/docs/memory/private-namespacing/',
						},
					],
				},
				{
					label: 'Dashboard',
					items: [
						{ label: 'v3 walkthrough', link: '/docs/dashboard/v3/' },
					],
				},
				{
					label: 'Operate',
					items: [{ autogenerate: { directory: 'docs/operate' } }],
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
