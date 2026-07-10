import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(""),
    pubDate: z.coerce.date(),
    category: z.string().default(""),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    heroImage: z.string().default(""),
    originalUrl: z.string().url().optional(),
    wpId: z.number().optional(),
  }),
});

export const collections = { blog };
