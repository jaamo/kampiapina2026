// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  site: 'https://kampiapina.com',
  // Sivusto on edelleen staattinen: vain /ruska-reitit ja /api merkitään
  // `prerender = false` -lipulla, jolloin ne ajetaan Netlifyn funktioina.
  output: 'static',
  adapter: netlify(),
});
