// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // 部署後改成你的網域，例如 'https://blog.example.com'
  site: 'https://ai-frontier.example.com',
  markdown: {
    shikiConfig: { theme: 'github-light' },
  },
  build: {
    format: 'directory',
  },
});
