// src/lib/shot.ts
//
// What <picture> needs to know about a screenshot, resolved against public/ at
// build time: which AVIF/WebP derivatives exist (scripts/build-images.mjs
// writes them), whether there is a @2x capture, and the PNG's intrinsic size.
// Shared by src/components/Shot.astro and src/components/HermesCard.astro.
//
// Two kinds of capture live in public/screenshots/:
//   - a live capture (scripts/capture-screenshots.mjs): <name>.png at 1x with
//     a <name>@2x.png beside it;
//   - a capture from the synced dashboard set (scripts/sync-screenshots.mjs,
//     listed in src/data/screenshots.json): one <name>.png taken at a device
//     scale factor above 1. It is shown at its pixel size divided by that
//     factor, it is its own high-density source, and a <name>@2x.png left
//     over from an older capture of the same name is not used.
import { closeSync, existsSync, openSync, readFileSync, readSync } from 'node:fs';
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
const defaultCaptureSetFile = () => path.join(process.cwd(), 'src/data/screenshots.json');

interface CaptureSet {
	deviceScaleFactor: number;
	/** Pixel size per file name (`slot-detail.png`), as the set's manifest states it. */
	sizes: Map<string, { width: number; height: number }>;
}

const NO_SET: CaptureSet = { deviceScaleFactor: 1, sizes: new Map() };
const captureSets = new Map<string, CaptureSet>();

/** The synced set's manifest, read once per file. A missing or unreadable file is an empty set. */
function captureSet(file: string): CaptureSet {
	let set = captureSets.get(file);
	if (!set) {
		set = NO_SET;
		try {
			const data = JSON.parse(readFileSync(file, 'utf8'));
			const scale = Number(data.deviceScaleFactor);
			if (scale > 1 && Array.isArray(data.images)) {
				set = {
					deviceScaleFactor: scale,
					sizes: new Map(data.images.map((i: { file: string; width: number; height: number }) => [i.file, { width: i.width, height: i.height }])),
				};
			}
		} catch {
			// No manifest: every screenshot follows the 1x + @2x convention.
		}
		captureSets.set(file, set);
	}
	return set;
}

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
 *
 * A capture from the synced dashboard set defaults to its pixel size divided by the set's device
 * scale factor (2880x1800 is shown as 1440x900) and never pairs with a `@2x` sibling. The PNG on
 * disk has to be the size the set's manifest states: a file of that name re-captured some other
 * way is treated as an ordinary screenshot. `captureSetFile` is the manifest, by default
 * src/data/screenshots.json.
 */
export function resolveShot(
	name: string,
	opts: { publicDir?: string; captureSetFile?: string; width?: number; height?: number; placeholder?: boolean } = {},
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

	const pixels = pngSize(png);
	const set = captureSet(opts.captureSetFile ?? defaultCaptureSetFile());
	const stated = set.sizes.get(`${name}.png`);
	const fromSet = Boolean(pixels && stated && stated.width === pixels.width && stated.height === pixels.height);

	const bases = !fromSet && existsSync(path.join(publicDir, `${base}@2x.png`)) ? [base, `${base}@2x`] : [base];
	const { sources, srcset } = pictureSources(bases, publicDir);
	const natural =
		pixels && fromSet
			? { width: Math.round(pixels.width / set.deviceScaleFactor), height: Math.round(pixels.height / set.deviceScaleFactor) }
			: pixels;
	const size = natural ? sizeFor(natural, opts.width, opts.height) : { width: opts.width, height: opts.height };
	return { src: `${base}.png`, srcset, sources, missing: false, ...size };
}
