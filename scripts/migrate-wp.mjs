// One-time migration: WordPress (kampiapina.com) → local Astro Markdown.
//
// - Pages through the WP REST API for every post
// - Downloads full-resolution images referenced in each post (featured + inline)
//   into public/blog-media/<slug>/, rewriting URLs to local paths
// - Converts post HTML to Markdown (turndown)
// - Writes src/content/blog/<slug>.md with YAML frontmatter
//
// Re-runnable: existing images are skipped, markdown is overwritten.
//
//   node scripts/migrate-wp.mjs

import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { constants as FS } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const API = "https://kampiapina.com/wp-json/wp/v2";
const CONTENT_DIR = path.join(ROOT, "src/content/blog");
const MEDIA_DIR = path.join(ROOT, "public/blog-media");
const IMG_RE = /https?:\/\/[^\s"')]+?\.(?:jpe?g|png|gif|webp)/gi;
const IMG_CONCURRENCY = 6;

const td = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});
td.use(gfm);
// Keep it clean: drop empty/utility nodes WP leaves behind.
td.remove(["script", "style"]);

const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", euro: "€", deg: "°",
};
function decodeEntities(s = "") {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name] ?? NAMED[name.toLowerCase()] ?? m);
}
const stripTags = (s = "") => s.replace(/<[^>]*>/g, "");
const clean = (s = "") => decodeEntities(stripTags(s)).replace(/\s+/g, " ").trim();
const yaml = (v) => JSON.stringify(v ?? ""); // JSON strings are valid YAML scalars

async function exists(p) {
  try { await access(p, FS.F_OK); return true; } catch { return false; }
}

async function fetchJson(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { data: await r.json(), headers: r.headers };
    } catch (e) {
      if (i === tries) throw e;
      await new Promise((res) => setTimeout(res, 800 * i));
    }
  }
}

async function fetchAllPosts() {
  const first = await fetchJson(`${API}/posts?per_page=100&page=1&_embed=wp:featuredmedia,wp:term`);
  const totalPages = +first.headers.get("x-wp-totalpages") || 1;
  let posts = [...first.data];
  for (let page = 2; page <= totalPages; page++) {
    const { data } = await fetchJson(`${API}/posts?per_page=100&page=${page}&_embed=wp:featuredmedia,wp:term`);
    posts = posts.concat(data);
    process.stdout.write(`\r  fetched page ${page}/${totalPages} (${posts.length} posts)   `);
  }
  process.stdout.write("\n");
  return posts;
}

async function downloadImage(url, destDir, failures) {
  const normalized = url.replace(/^http:/, "https:");
  const base = decodeURIComponent(path.basename(new URL(normalized).pathname)) || "image";
  const dest = path.join(destDir, base);
  const webPath = `/blog-media/${path.basename(destDir)}/${base}`;
  if (await exists(dest)) return webPath;
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(normalized);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length) throw new Error("empty");
      await writeFile(dest, buf);
      return webPath;
    } catch (e) {
      if (i === 3) { failures.push({ url: normalized, error: String(e) }); return null; }
      await new Promise((res) => setTimeout(res, 600 * i));
    }
  }
}

async function pool(items, size, worker) {
  const results = [];
  let idx = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await worker(items[cur], cur);
    }
  });
  await Promise.all(runners);
  return results;
}

async function migratePost(post, failures) {
  const slug = post.slug;
  const destDir = path.join(MEDIA_DIR, slug);
  await mkdir(destDir, { recursive: true });

  let html = post.content?.rendered ?? "";

  // Collect every uploaded image URL (src, href, srcset all matched generically).
  const urls = [...new Set((html.match(IMG_RE) || []).filter((u) => /kampiapina\.com/i.test(u)))];

  // Featured image (may be absent on older posts).
  const featuredRemote = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  if (featuredRemote) urls.push(featuredRemote);

  // Download all, build remote→local map.
  const map = new Map();
  await pool([...new Set(urls)], IMG_CONCURRENCY, async (u) => {
    const local = await downloadImage(u, destDir, failures);
    if (local) {
      map.set(u, local);
      map.set(u.replace(/^http:/, "https:"), local);
      map.set(u.replace(/^https:/, "http:"), local);
    }
  });

  // Rewrite URLs in the HTML before converting to Markdown.
  for (const [remote, local] of map) html = html.split(remote).join(local);

  const markdown = td.turndown(html).replace(/\n{3,}/g, "\n\n").trim();

  const terms = post._embedded?.["wp:term"] || [];
  const categories = (terms[0] || []).map((t) => clean(t.name)).filter(Boolean);
  const tags = (terms[1] || []).map((t) => clean(t.name)).filter(Boolean);

  const heroLocal = featuredRemote ? map.get(featuredRemote) : null;
  const firstInline = [...map.values()][0] ?? null;

  const title = clean(post.title?.rendered) || "(nimetön)";
  const description = clean(post.excerpt?.rendered)
    .replace(/\s*\[?…]?\s*$/, "")
    .slice(0, 280)
    .replace(/\s+\S*$/, "")           // trim partial trailing word
    .trim();

  const frontmatter = [
    "---",
    `title: ${yaml(title)}`,
    `description: ${yaml(description)}`,
    `pubDate: ${yaml(post.date)}`,
    `category: ${yaml(categories[0] ?? "")}`,
    `categories: ${JSON.stringify(categories)}`,
    `tags: ${JSON.stringify(tags)}`,
    `heroImage: ${yaml(heroLocal ?? firstInline ?? "")}`,
    `originalUrl: ${yaml(post.link)}`,
    `wpId: ${post.id}`,
    "---",
    "",
  ].join("\n");

  await writeFile(path.join(CONTENT_DIR, `${slug}.md`), frontmatter + markdown + "\n");
  return { slug, images: map.size / 3 | 0 };
}

async function main() {
  await mkdir(CONTENT_DIR, { recursive: true });
  await mkdir(MEDIA_DIR, { recursive: true });

  console.log("Fetching post list…");
  let posts = await fetchAllPosts();
  if (process.env.LIMIT) posts = posts.slice(0, +process.env.LIMIT);
  console.log(`Migrating ${posts.length} posts…`);

  const failures = [];
  let done = 0;
  for (const post of posts) {
    try {
      const r = await migratePost(post, failures);
      done++;
      process.stdout.write(`\r  [${done}/${posts.length}] ${r.slug}`.padEnd(90).slice(0, 90));
    } catch (e) {
      failures.push({ slug: post.slug, error: String(e) });
      console.error(`\n  ! ${post.slug}: ${e}`);
    }
  }
  process.stdout.write("\n");

  await writeFile(
    path.join(ROOT, "scripts/migration-report.json"),
    JSON.stringify({ posts: posts.length, migrated: done, imageFailures: failures }, null, 2)
  );
  console.log(`Done. ${done}/${posts.length} posts. ${failures.length} download failures (see scripts/migration-report.json).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
