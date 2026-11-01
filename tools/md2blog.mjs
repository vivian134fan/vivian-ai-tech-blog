#!/usr/bin/env node
/**
 * 本地文稿 → 博客文章
 *
 * 用於「稿件在本地已生成」（例如《AI 科技資訊前沿》日更流程輸出的公眾號繁體稿），
 * 不需要經微信公眾號轉換時使用。
 *
 * 用法：
 *   node tools/md2blog.mjs <文稿.md> [--date 2026-11-01] [--slug xxx]
 *                                      [--source "https://mp.weixin.qq.com/s/xxx"]
 *                                      [--tags "產品,融資"] [--dry]
 *
 * 會自動：
 *   1. 取首個 H1 作標題
 *   2. 移除公眾號版式殘留（「- 完 -」、署名兩行）
 *   3. 由「導讀」生成摘要
 *   4. 檢查簡體殘留與香港用語，輸出警告
 *   5. 寫入 src/posts/<date>-<slug>.md
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OpenCC = require('opencc-js');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);

const argOf = (flag) => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};

const input = argv.find((a) => !a.startsWith('--') && a !== argOf('--date') && a !== argOf('--slug') && a !== argOf('--source') && a !== argOf('--tags'));
if (!input) {
  console.error('用法：node tools/md2blog.mjs <文稿.md> [--date 2026-11-01] [--source URL]');
  process.exit(1);
}

const dry = argv.includes('--dry');
const raw = await readFile(resolve(input), 'utf8');
const lines = raw.replace(/\r\n/g, '\n').split('\n');

/* ---------- 1) 標題 ---------- */
let title = '';
const bodyLines = [];
for (const line of lines) {
  const m = line.match(/^#\s+(.+)$/);
  if (!title && m) {
    title = m[1].trim();
    continue;
  }
  bodyLines.push(line);
}

/* ---------- 2) 移除公眾號版式殘留 ---------- */
const DROP = [/^-\s*完\s*-\s*$/, /^AI\s*科技資訊前沿\s*[·・]\s*Vivian\s*$/, /^Let'?s\s*embrace\s*AI\s*\.?\s*$/i];
const kept = bodyLines.filter((l) => !DROP.some((re) => re.test(l.trim())));

let body = kept
  .join('\n')
  .replace(/\u00a0/g, ' ')
  .replace(/[ \t]+$/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

/* ---------- 3) 摘要：優先用導讀 ---------- */
const readingMatch = body.match(/##\s*導讀\s*\n+([\s\S]*?)(?=\n##\s|\n###\s|$)/);
let plain = (readingMatch ? readingMatch[1] : body)
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[#>*_`]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// 導讀常以「《AI 科技資訊前沿》…報道：」開頭，摘要時去掉
plain = plain.replace(/^《AI\s*科技資訊前沿》[^：:]*[：:]\s*/, '');

const head = Array.from(plain).slice(0, 110).join('');
const stop = Math.max(
  head.lastIndexOf('。'),
  head.lastIndexOf('！'),
  head.lastIndexOf('？'),
  head.lastIndexOf('；'),
);
const description = (stop > 30 ? head.slice(0, stop) : head).replace(/[，、；：]$/, '') + (stop > 30 ? '。' : '');

/* ---------- 4) 語文檢查 ---------- */
const toTW = OpenCC.Converter({ from: 'cn', to: 'tw' });
const warns = [];
const norm = toTW(body);
for (let i = 0; i < body.length; i += 1) {
  if (body[i] !== norm[i]) {
    warns.push(`簡體殘留：「${body[i]}」→ 應為「${norm[i]}」`);
    break;
  }
}
for (const [bad, good] of [['芯片', '晶片'], ['機器人', '機械人'], ['默認', '預設'], ['運營', '營運']]) {
  if (body.includes(bad)) warns.push(`香港用語：「${bad}」建議改為「${good}」`);
}
if (/[""]/.test(body)) warns.push('標點：出現 “ ” 直引號，香港規格應用「」');

/* ---------- 5) 輸出 ---------- */
const date = argOf('--date') || new Date().toISOString().slice(0, 10);
const source = argOf('--source');
const tags = argOf('--tags')
  ? argOf('--tags').split(/[,，]/).map((t) => t.trim()).filter(Boolean)
  : [];

const slugBase = argOf('--slug') || title
  .replace(/[「」『』《》〈〉“”"'’‘（）()\[\]【】〔〕·・、，。！？：；…—\-\/|\\]/g, ' ')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 28) || 'post';

const slug = `${date}-${slugBase}`;
const outPath = resolve(ROOT, 'src/posts', `${slug}.md`);

const front = [
  '---',
  `title: ${JSON.stringify(title)}`,
  `date: ${date}`,
  `description: ${JSON.stringify(description)}`,
  `tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]`,
  ...(source ? [`source: ${JSON.stringify(source)}`] : []),
  '---',
  '',
  '',
].join('\n');

if (dry) {
  console.log(front + body.slice(0, 400) + '\n…');
} else {
  if (!existsSync(resolve(ROOT, 'src/posts'))) await mkdir(resolve(ROOT, 'src/posts'), { recursive: true });
  await writeFile(outPath, front + body + '\n', 'utf8');
  console.log(`✅ 已寫入 ${outPath.replace(`${ROOT}/`, '')}`);
  console.log(`   標題　${title}`);
  console.log(`   字數　約 ${body.replace(/\s/g, '').length}`);
  console.log(`   摘要　${description}`);
}

if (warns.length) {
  console.log('\n⚠️ 發佈前請處理：');
  warns.forEach((w) => console.log(`   · ${w}`));
} else {
  console.log('\n✅ 語文檢查通過（無簡體殘留、無用語問題）');
}
