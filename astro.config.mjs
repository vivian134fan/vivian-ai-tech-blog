// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // 部署後改成你的網域，例如 'https://blog.example.com'
  site: 'https://vivian-ai-tech-blog.pages.dev',
  markdown: {
    shikiConfig: { theme: 'github-light' },
  },
  build: {
    format: 'directory',
  },
});
