// Visual audit — screenshots every page-type surface in both themes so a
// human (or a PR body) can eyeball the "one site" invariant. Replaces the
// retired KB byte-parity check as the cross-surface regression net.
//
// Usage:  npm run build && npx serve dist -l 4400 &   (any static server)
//         node scripts/audit-screens.mjs [baseUrl] [outDir]
// Defaults: http://localhost:4400  ./screens-audit
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://localhost:4400';
const out = process.argv[3] ?? 'screens-audit';
await mkdir(out, { recursive: true });

const SURFACES = [
	['landing', '/'],
	['kb-landing', '/kb/'],
	['kb-article', '/kb/getting-started/your-first-slot/'],
	// '/docs/getting-started/' and '/docs/concepts/slots/' now 301 straight
	// to forum.hal0.dev (docs content moved off hal0.dev) — only the hub
	// and the section listing pages are still in-house surfaces to audit.
	['docs-landing', '/docs/'],
	['docs-section', '/docs/concepts/'],
	['blog-index', '/blog/'],
	['blog-post', '/blog/whats-new-in-the-v0-8-line/'],
	['changelog', '/changelog/'],
	['benchmarks', '/benchmarks/'],
	['profiles', '/profiles/'],
];

const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
	const ctx = await browser.newContext({
		viewport: { width: 1440, height: 1000 },
		colorScheme: theme,
	});
	for (const [name, path] of SURFACES) {
		const page = await ctx.newPage();
		await page.addInitScript((t) => localStorage.setItem('starlight-theme', t), theme);
		await page.goto(base + path, { waitUntil: 'networkidle' });
		await page.waitForTimeout(300);
		await page.screenshot({ path: `${out}/${name}-${theme}.png` });
		await page.close();
		console.log(`✓ ${name} (${theme})`);
	}
	await ctx.close();
}
await browser.close();
console.log(`\n${SURFACES.length * 2} screenshots in ${out}/`);
