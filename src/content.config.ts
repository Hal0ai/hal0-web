import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { blogSchema } from 'starlight-blog/schema';

export const collections = {
	// Extend the docs schema with starlight-blog's frontmatter (date, authors,
	// tags, excerpt, cover) so blog posts under src/content/docs/blog/ validate,
	// plus two optional KB-only fields: `reviewed` (the evergreen "last
	// reviewed" stamp shown in place of a post date) and `kbCategory` (the
	// display label for the six knowledge-base category cards on /kb/, e.g.
	// "hardware notes" — kept distinct from the directory slug so the card
	// copy can use spaces/ampersands the filesystem can't). Both are optional
	// everywhere so plain docs/blog pages are unaffected.
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: (context) =>
				blogSchema(context).extend({
					reviewed: z.string().optional(),
					kbCategory: z.string().optional(),
					// Docs-only version stamp (comp: "applies to v0.5.x") rendered
					// by the PageTitle override when present. Optional everywhere;
					// pages adopt it organically — never backfilled wholesale.
					appliesTo: z.string().optional(),
				}),
		}),
	}),
};
