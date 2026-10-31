#!/usr/bin/env node
/**
 * 一鍵發佈：轉換（可選）→ 構建 → 部署 Cloudflare Pages → 推 GitHub
 *
 * 用法：
 *   npm run publish                                  # 只發佈現有文章
 *   npm run publish -- --url "https://mp.weixin.qq.com/s/xxx"   # 先轉換新文章再發佈
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);

const run = (cmd, args, label) => {
  process.stdout.write(`\n▶ ${label}\n`);
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
};

// 1) 可選：貼連結即轉換
const urlIdx = argv.findIndex((a) => a === '--url');
if (urlIdx !== -1 && argv[urlIdx + 1]) {
  run('node', ['tools/wx2blog.mjs', argv[urlIdx + 1]], '轉換公眾號文章');
}

// 2) 構建（WorkBuddy 沙盒會攔 Astro 清空 dist 的 removeEmptyDirs，令退出碼為 1，
//    但產物其實已生成——所以這裡驗證 dist/index.html 是否新鮮，而非只看退出碼）
process.stdout.write('\n▶ 構建靜態站\n');
let buildOk = true;
try {
  execFileSync('npx', ['astro', 'build'], { cwd: ROOT, stdio: 'inherit' });
} catch {
  buildOk = false;
}

const distIndex = resolve(ROOT, 'dist/index.html');
const fresh = existsSync(distIndex) && Date.now() - statSync(distIndex).mtimeMs < 10 * 60 * 1000;
if (!buildOk && !fresh) {
  process.stdout.write('\n❌ 構建失敗，dist 沒有新產物，已中止部署\n');
  process.exit(1);
}
if (!buildOk) {
  process.stdout.write('\n⚠️ 構建回報非零退出碼，但 dist 已生成（沙盒清理噪音），繼續部署\n');
}

// 3) 部署到 Cloudflare Pages
run(
  'npx',
  ['wrangler', 'pages', 'deploy', 'dist', '--project-name=vivian-ai-tech-blog', '--branch=main', '--commit-dirty=true'],
  '部署 Cloudflare Pages',
);

// 4) 推 GitHub（失敗不阻斷，網絡波動時可稍後手動推）
try {
  run('git', ['add', '-A'], '暫存改動');
  run('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', `發佈：${new Date().toISOString().slice(0, 16).replace('T', ' ')}`], '提交');
  run('git', ['push', 'origin', 'main'], '推送 GitHub');
} catch {
  process.stdout.write('\n⚠️ GitHub 推送失敗（不影響已完成的部署），可稍後手動 git push\n');
}

process.stdout.write('\n✅ 完成：https://vivian-ai-tech-blog.pages.dev\n');
