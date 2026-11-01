#!/usr/bin/env node
/**
 * check-brand.mjs — 博客品牌紅線閘門
 *
 * 背景（Vivian 2026-11-01 指示，2026-11-02 起生效）：
 *   品牌口號「Let's embrace AI」同中文版「讓我們擁抱 AI」全線廢除——
 *   站點頁尾、文章署名、任何版式一律零出現。
 *
 * 為甚麼要有呢支閘門：口號散落喺 layout／post 頁／轉換器／fixture 幾處，
 *   靠人手記一定漏；寫錯一次就會再上線一次（而且搜索引擎會收錄）。
 *
 * 用法：
 *   node tools/check-brand.mjs      # 或 npm run check
 *   exit 0 = 乾淨，可以部署；exit 1 = 命中，唔准部署
 *
 * ⚠️ 例外：轉換器 tools/wx2blog.mjs 內有一條「剷走舊口號」嘅正則過濾規則，
 *   佢係**刪除**用途（舊公眾號文章仍然含嗰句），唔算違規。判斷方式：
 *   該行係以 `/^` 開頭嘅正則字面量 → 跳過。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);

/** 口號（容忍任意空白，因為口號寫法漂浮：`Let's embrace AI`／`Let's embrace AI .`／`Lets embrace AI`） */
const BANNED = /let['’‘`´]?s\s*embrace\s*ai|讓我們擁抱\s*ai/gi;

const TEXT_EXT = new Set(['.astro', '.md', '.mdx', '.mjs', '.js', '.ts', '.tsx',
  '.jsx', '.json', '.css', '.html', '.yml', '.yaml', '.txt']);
const SKIP_DIR = new Set(['node_modules', 'dist', '.git', '.astro', '.wrangler']);

const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p);
      continue;
    }
    if (!TEXT_EXT.has(extname(p).toLowerCase())) continue;
    if (p === SELF) continue;
    const lines = readFileSync(p, 'utf-8').split('\n');
    lines.forEach((line, i) => {
      // 剷走用嘅正則過濾規則唔算違規
      if (line.trim().startsWith('/^')) return;
      BANNED.lastIndex = 0;
      if (BANNED.test(line)) {
        hits.push({ file: relative(ROOT, p), line: i + 1, text: line.trim().slice(0, 80) });
      }
    });
  }
}

walk(ROOT);

if (hits.length) {
  process.stdout.write('\n❌ 品牌紅線：發現已廢除口號\n');
  for (const h of hits) process.stdout.write(`   ${h.file}:${h.line}  「${h.text}」\n`);
  process.stdout.write('\n   2026-11-02 起全線廢除。頁尾／署名只留「AI 科技資訊前沿 · Vivian」。\n');
  process.stdout.write('   修正後重跑：npm run check\n\n');
  process.exit(1);
}

process.stdout.write('✅ 品牌紅線：零口號（頁尾／署名／版式全部乾淨）\n');
