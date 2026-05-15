// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	site: 'https://hal0.dev',

	integrations: [
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
					label: 'Operate',
					items: [{ autogenerate: { directory: 'docs/operate' } }],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'docs/reference' } }],
				},
			],
			components: {
				// Custom marketing pages render through their own layout;
				// no Starlight overrides needed yet.
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
	},
});
