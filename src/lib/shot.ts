// src/lib/shot.ts
//
// What <picture> needs to know about a screenshot, resolved against public/ at
// build time: which AVIF/WebP derivatives exist (scripts/build-images.mjs
// writes them), whether there is a @2x capture, and the PNG's intrinsic size.
// Shared by src/components/Shot.astro and src/components/HermesCard.astro.
import { closeSync, existsSync, openSync, readSync } from 'node:fs';
import path from 'node:path';

export interface PictureSource {
	type: string;
	srcset: string;
}

export interface ResolvedShot {
	/** PNG fallback, the <img> src (public/js/lightbox.js binds on /screenshots/ in it). */
	src: string;
	/** `png 1x, png@2x 2x` when a @2x capture exists; undefined otherwise. */
	srcset?: string;
	/** <source> elements in order: AVIF, then WebP. A format with missing derivatives is absent. */
	sources: PictureSource[];
	width?: number;
	height?: number;
	/** True only in placeholder mode, when public/screenshots/<name>.png does not exist yet. */
	missing: boolean;
}

const FORMATS = [
	{ ext: 'avif', type: 'image/avif' },
	{ ext: 'webp', type: 'image/webp' },
] as const;

/** Screenshot names are file stems: `slot-card`, never a path, a `@2x` variant or anything needing escaping. */
const NAME = /^[a-z0-9][a-z0-9-]*$/;

/** The size of a console capture, used for a placeholder that was given no size. */
const CAPTURE_SIZE = { width: 1440, height: 900 };

const defaultPublicDir = () => path.join(process.cwd(), 'public');

const descriptors = (urls: string[]) => (urls.length === 1 ? urls[0] : urls.map((u, i) => `${u} ${i + 1}x`).join(', '));

/**
 * `<source>` entries and the PNG `srcset` for one image shown at several pixel densities.
 *
 * @param bases URL paths without extension, 1x first (`['/agents/hermes-744', '/agents/hermes']`).
 *   One base gives bare URLs; several give `1x, 2x, …` descriptors.
 * @param publicDir the directory those URL paths are served from
 *
 * A format is offered only when the derivative exists for every base, so a browser
 * that prefers AVIF is never sent to a 404 (`astro dev` before prebuild) and a retina
 * screen is never paired with a 1x-only set.
 */
export function pictureSources(
	bases: string[],
	publicDir: string = defaultPublicDir(),
): { sources: PictureSource[]; srcset?: string } {
	const all = (ext: string) => bases.every((b) => existsSync(path.join(publicDir, `${b}.${ext}`)));
	const sources = FORMATS.filter(({ ext }) => all(ext)).map(({ ext, type }) => ({
		type,
		srcset: descriptors(bases.map((b) => `${b}.${ext}`)),
	}));
	const srcset = bases.length > 1 && all('png') ? descriptors(bases.map((b) => `${b}.png`)) : undefined;
	return { sources, srcset };
}

/** Intrinsic size from a PNG's IHDR chunk (bytes 16-23); null when the file is not a readable PNG. */
export function pngSize(file: string): { width: number; height: number } | null {
	let fd: number | undefined;
	try {
		fd = openSync(file, 'r');
		const head = Buffer.alloc(24);
		if (readSync(fd, head, 0, 24, 0) < 24) return null;
		if (head.readUInt32BE(0) !== 0x89504e47 || head.toString('latin1', 12, 16) !== 'IHDR') return null;
		return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
	} catch {
		return null;
	} finally {
		if (fd !== undefined) closeSync(fd);
	}
}

/** width/height from what was asked for, scaled from `natural` when only one was given. */
function sizeFor(natural: { width: number; height: number }, width?: number, height?: number) {
	if (width && !height) return { width, height: Math.round((width * natural.height) / natural.width) };
	if (height && !width) return { width: Math.round((height * natural.width) / natural.height), height };
	if (!width && !height) return natural;
	return { width, height };
}

/**
 * Resolve `public/screenshots/<name>.png` into everything <Shot> renders.
 *
 * Throws when the name is malformed or the PNG is missing, so a typo fails the build instead of
 * shipping a broken image. With `placeholder: true` a missing PNG (a capture not taken yet) resolves
 * to `{ missing: true }` with no sources, sized by width/height or, failing that, the 1440x900
 * capture viewport; a malformed name still throws.
 *
 * width/height default to the PNG's own size; giving one scales the other to match.
 */
export function resolveShot(
	name: string,
	opts: { publicDir?: string; width?: number; height?: number; placeholder?: boolean } = {},
): ResolvedShot {
	if (!NAME.test(name)) {
		throw new Error(
			`Shot: invalid name ${JSON.stringify(name)}; use the file stem in public/screenshots/ (lowercase letters, digits, hyphens; the @2x capture is found on its own)`,
		);
	}
	const publicDir = opts.publicDir ?? defaultPublicDir();
	const base = `/screenshots/${name}`;
	const png = path.join(publicDir, `${base}.png`);

	if (!existsSync(png)) {
		if (!opts.placeholder) throw new Error(`Shot: ${base}.png not found in public/`);
		return { src: `${base}.png`, sources: [], missing: true, ...sizeFor(CAPTURE_SIZE, opts.width, opts.height) };
	}

	const bases = existsSync(path.join(publicDir, `${base}@2x.png`)) ? [base, `${base}@2x`] : [base];
	const { sources, srcset } = pictureSources(bases, publicDir);
	const natural = pngSize(png);
	const size = natural ? sizeFor(natural, opts.width, opts.height) : { width: opts.width, height: opts.height };
	return { src: `${base}.png`, srcset, sources, missing: false, ...size };
}
