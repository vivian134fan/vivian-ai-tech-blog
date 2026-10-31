#!/usr/bin/env node
/**
 * wx2blog.mjs — 微信公眾號文章 → 博客 Markdown
 *
 * 用法：
 *   node tools/wx2blog.mjs "https://mp.weixin.qq.com/s/xxxx"
 *   node tools/wx2blog.mjs --file saved.html
 *   node tools/wx2blog.mjs --batch urls.txt
 *
 * 可選參數：
 *   --slug xxx        自訂檔名（預設由日期＋標題生成）
 *   --date 2026-10-31 指定發佈日期（預設讀文章時間）
 *   --tags "AI,模型"  自訂標籤（預設按關鍵詞自動判斷）
 *   --out src/posts   輸出目錄
 *   --no-images       不下載圖片，保留原圖連結
 *   --no-convert      不做簡轉繁（原文已是繁體時可用）
 *   --no-headings     不把粗體短句轉成小標題
 *   --dry             只印結果，不寫檔
 */

import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';

const require = createRequire(import.meta.url);
const OpenCC = require('opencc-js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003128) NetType/WIFI Language/zh_HK';

/* ------------------------------------------------------------------ */
/* 參數解析                                                             */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = {
    input: null,
    file: null,
    batch: null,
    slug: null,
    date: null,
    tags: null,
    out: 'src/posts',
    images: true,
    convert: true,
    headings: true,
    dry: false,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--file': opts.file = argv[++i]; break;
      case '--batch': opts.batch = argv[++i]; break;
      case '--slug': opts.slug = argv[++i]; break;
      case '--date': opts.date = argv[++i]; break;
      case '--tags': opts.tags = argv[++i]; break;
      case '--out': opts.out = argv[++i]; break;
      case '--no-images': opts.images = false; break;
      case '--no-convert': opts.convert = false; break;
      case '--no-headings': opts.headings = false; break;
      case '--dry': opts.dry = true; break;
      case '-h':
      case '--help': opts.help = true; break;
      default: if (!a.startsWith('--')) rest.push(a);
    }
  }
  if (!opts.file && rest.length) opts.input = rest[0];
  return opts;
}

/* ------------------------------------------------------------------ */
/* 抓取                                                                 */
/* ------------------------------------------------------------------ */

async function loadHtml(opts) {
  if (opts.file) {
    const abs = path.resolve(process.cwd(), opts.file);
    return { html: await readFile(abs, 'utf8'), baseDir: path.dirname(abs), url: null };
  }
  if (!opts.input) throw new Error('請提供公眾號文章網址，或用 --file 指定已保存的 HTML。');

  const res = await fetch(opts.input, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'zh-HK,zh;q=0.9,en;q=0.8',
      Referer: 'https://mp.weixin.qq.com/',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`抓取失敗（HTTP ${res.status}）。可改用瀏覽器另存網頁後以 --file 讀取。`);
  }
  const html = await res.text();
  if (!html.includes('js_content')) {
    throw new Error(
      '頁面中找不到正文容器，可能被要求驗證。請在瀏覽器打開文章 → 另存為網頁（完整）→ 用 --file 讀取。'
    );
  }
  return { html, baseDir: process.cwd(), url: opts.input };
}

/* ------------------------------------------------------------------ */
/* 解析                                                                 */
/* ------------------------------------------------------------------ */

const JUNK_SELECTORS = [
  'script', 'style', 'noscript',
  '#js_pc_qr_code', '.qr_code_pc_outer', '.qr_code_pc',
  '.rich_media_area_extra', '.rich_media_tool', '.reward_area', '.reward_qrcode_area',
  '.js_ad_link', '.js_profile_qrcode', 'mp-common-profile', 'mpcpc',
  '.discuss_container', '.js_cmt_area', '.js_tags_preview_toast',
  '.js_uneditable', '.weui-msg', '.js_article_bottom_bar',
  '.share_notice', '.js_sponsor_ad_area', '#content_bottom_area',
  '.rich_media_content .js_img_loading',
];

const JUNK_LINE = [
  /^预览时标签不可点$/,
  /^預覽時標籤不可點$/,
  /^微信扫一扫/,
  /^微信掃一掃/,
  /^继续滑动看下一个/,
  /^繼續滑動看下一個/,
  /^轻触阅读原文/,
  /^輕觸閱讀原文/,
  /^向上滑动看下一个/,
  /^知道了$/,
  /^允许$/,
  /^长按识别二维码关注/,
  /^长按识别二维码/,
  /^分享收藏点赞在看$/,
  /^分享收藏讚在看$/,
];

// 結尾署名塊與免責聲明（博客版式統一輸出，正文內不再重複）
const TAIL_JUNK = [
  /^-完-$/,
  /^AI科技資訊前沿[·・]Vivian$/,
  /^AI科技資訊前沿$/,
  /^Let'?sembraceAI\.?$/i,
  /^以上資訊僅供參考/,
  /^以上信息僅供參考/,
  /^不構成任何投資建議/,
  /^資訊來源[:：]?$/,
  /^信息來源[:：]?$/,
  /^-$/,
];

/** 去掉 Markdown 標記與空白，方便做比對（保留連字號） */
const bare = (line) =>
  line.replace(/\\(.)/g, '$1').replace(/[*_#>`~]/g, '').replace(/\s+/g, '').trim();

function extract(html) {
  const $ = cheerio.load(html, { decodeEntities: false });

  const title =
    $('#activity-name').text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').text().trim() ||
    '未命名文章';

  const author =
    $('#js_name').text().trim() ||
    $('meta[name="author"]').attr('content')?.trim() ||
    '';

  // 發佈時間：優先 meta，其次 #publish_time，再次頁面內 var ct
  let date = '';
  const ogTime = $('meta[property="article:published_time"]').attr('content');
  if (ogTime) date = ogTime.slice(0, 10);
  if (!date) {
    const pt = $('#publish_time').text().trim();
    const m = pt.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) date = `${m[1]}-${m[2]}-${m[3]}`;
  }
  if (!date) {
    const ct = html.match(/var\s+ct\s*=\s*"?(\d{10})"?/);
    if (ct) {
      const d = new Date(Number(ct[1]) * 1000);
      date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  if (!date) date = new Date().toISOString().slice(0, 10);

  let $content = $('#js_content');
  if ($content.length === 0) $content = $('.rich_media_content');
  if ($content.length === 0) throw new Error('找不到正文容器 #js_content。');

  JUNK_SELECTORS.forEach((sel) => $content.find(sel).remove());

  return { title, author, date, $, $content };
}

/* ------------------------------------------------------------------ */
/* 正規化：把 <section> + <br> 的假段落變成真段落、粗體短句變小標           */
/* ------------------------------------------------------------------ */

const BLOCK = 'p,div,section,h1,h2,h3,h4,h5,h6,ul,ol,li,table,blockquote,img,figure,pre,hr';

function promoteHeadings($, $content) {
  $content.find('section, p, div').each((_, el) => {
    const $el = $(el);
    if ($el.find(BLOCK).length > 0) return;
    const text = $el.text().replace(/\s+/g, '');
    if (text.length === 0 || text.length > 24) return;
    if (/[。！？，、；：]$/.test(text)) return;

    const nodes = $el.children().toArray();
    if (nodes.length !== 1) return;
    const only = $(nodes[0]);
    const prop = (only.attr('style') || '').replace(/\s/g, '');
    const bold =
      only.is('strong, b') ||
      /font-weight:(bold|bolder|700|800|900)/.test(prop) ||
      /font-weight:(bold|bolder|700|800|900)/.test($el.attr('style') || '');

    if (bold) $el.replaceWith(`<h2>${only.html()}</h2>`);
  });
}

function splitBrParagraphs($, $content) {
  const candidates = $content.find('section, div, p').toArray().reverse();
  for (const el of candidates) {
    const $el = $(el);
    if ($el.closest('h1,h2,h3,h4,h5,h6,table,li,blockquote,p').length > 0 && !$el.is('p')) continue;
    if ($el.is('li,blockquote,td,th')) continue;
    if ($el.find(BLOCK).length > 0) continue;
    if ($el.find('br').length === 0) continue;

    const parts = ($el.html() || '')
      .split(/<br\s*\/?>/i)
      .map((p) => p.trim())
      .filter((p) => p.replace(/<[^>]+>/g, '').trim().length > 0);

    if (parts.length === 0) continue;
    $el.replaceWith(parts.map((p) => `<p>${p}</p>`).join('\n'));
  }
}

function markMedia($, $content) {
  const kinds = { video: 0, audio: 0, card: 0 };

  $content.find('mpvideo, iframe, video').each(() => { kinds.video += 1; });
  $content.find('mpvoice, audio, qqmusic, mp-common-mpaudio').each(() => { kinds.audio += 1; });
  $content.find('mp-miniprogram, mpproduct, mp-common-profile, mpcard, mp-common-mpcard').each(() => {
    kinds.card += 1;
  });

  $content
    .find(
      'mpvideo, iframe, video, mpvoice, audio, qqmusic, mp-common-mpaudio, ' +
        'mp-miniprogram, mpproduct, mp-common-profile, mpcard, mp-common-mpcard',
    )
    .remove();

  return kinds;
}

/** 產出「原文另含影片／小程序」的說明，有原文連結時直接給可點連結 */
function mediaNote(kinds, url) {
  const parts = [];
  if (kinds.video) parts.push('影片');
  if (kinds.audio) parts.push('語音');
  if (kinds.card) parts.push('小程序卡片');
  if (!parts.length) return '';

  const list = parts.join('、');
  const link = url
    ? `，可[前往微信公眾號原文觀看](${url})`
    : '，可前往微信公眾號原文觀看';
  return `\n\n> 說明：本文原文另含微信內嵌${list}，博客版無法呈現${link}。\n`;
}

/* ------------------------------------------------------------------ */
/* 圖片                                                                 */
/* ------------------------------------------------------------------ */

function extFromType(ct = '') {
  if (ct.includes('svg')) return '.svg';
  if (ct.includes('png')) return '.png';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  return '';
}

function extFromUrl(u = '') {
  const fmt = u.match(/wx_fmt=([a-z]+)/i);
  if (fmt) return `.${fmt[1] === 'jpeg' ? 'jpg' : fmt[1]}`;
  const ext = path.extname(u.split('?')[0]).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)
    ? ext.replace('.jpeg', '.jpg')
    : '';
}

async function localizeImages($, $content, { slug, baseDir, referer }) {
  const dir = path.join(ROOT, 'public', 'images', slug);
  const seen = new Map();
  let count = 0;

  const imgs = $content.find('img').toArray();
  for (const el of imgs) {
    const $el = $(el);
    let src =
      $el.attr('data-src') || $el.attr('data-original') || $el.attr('src') || '';
    src = src.trim();

    if (!src || src.startsWith('data:')) {
      $el.remove();
      continue;
    }

    if (seen.has(src)) {
      $el.attr('src', seen.get(src));
      $el.removeAttr('data-src');
      continue;
    }

    const idx = String(++count).padStart(2, '0');

    try {
      let buf;
      let ext = '';

      if (/^https?:/i.test(src)) {
        const res = await fetch(src, {
          headers: { 'User-Agent': UA, Referer: referer || 'https://mp.weixin.qq.com/' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buf = Buffer.from(await res.arrayBuffer());
        ext = extFromType(res.headers.get('content-type') || '') || extFromUrl(src) || '.jpg';
      } else {
        const local = path.resolve(baseDir, decodeURIComponent(src));
        buf = await readFile(local);
        ext = path.extname(local).toLowerCase() || '.png';
      }

      await mkdir(dir, { recursive: true });
      const name = `img-${idx}${ext}`;
      await writeFile(path.join(dir, name), buf);

      const publicPath = `/images/${slug}/${name}`;
      seen.set(src, publicPath);
      $el.attr('src', publicPath);
      $el.removeAttr('data-src').removeAttr('data-original');
    } catch (err) {
      console.warn(`  · 圖片 ${idx} 下載失敗（${err.message}），保留原連結`);
      $el.attr('src', src);
    }
  }

  return count;
}

/* ------------------------------------------------------------------ */
/* 轉 Markdown                                                          */
/* ------------------------------------------------------------------ */

function toMarkdown($, $content) {
  const td = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  });

  td.use(tables);

  td.addRule('stripStyles', {
    filter: (node) =>
      node.nodeName === 'SPAN' || node.nodeName === 'FONT' || node.nodeName === 'O',
    replacement: (content) => content,
  });

  td.addRule('emptyLinks', {
    filter: (node) => node.nodeName === 'A' && !(node.textContent || '').trim(),
    replacement: () => '',
  });

  const md = td.turndown($content.html() || '');
  return md;
}

function cleanMarkdown(md, title) {
  let out = md
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 逐行剔除公眾號殘留雜訊（保留空行，空行是段落分隔的命脈）
  const kept = [];
  for (const line of out.split('\n')) {
    if (line.trim() === '') {
      if (kept.length && kept[kept.length - 1] !== '') kept.push('');
      continue;
    }
    const b = bare(line);
    if (b && JUNK_LINE.some((re) => re.test(b))) continue;
    kept.push(line);
  }
  out = kept.join('\n');

  // 去掉開頭重複的標題行
  out = out.replace(/^#\s+.*(?:\n|$)/, (m) => (m.includes(title.slice(0, 8)) ? '' : m));

  // 去掉結尾的公眾號署名塊與免責聲明（由博客版式統一輸出）
  const arr = out.split('\n');
  for (let guard = 0; guard < 12; guard++) {
    const last = arr[arr.length - 1];
    if (last === undefined) break;
    const b = bare(last);
    if (b === '' || TAIL_JUNK.some((re) => re.test(b))) {
      arr.pop();
      continue;
    }
    break;
  }

  return arr
    .join('\n')
    .replace(/\\([\[\]*_])/g, '$1')
    .replace(/^(\s*)[-*+]\s{2,}/gm, '$1- ')
    .replace(/([^\n])\n(#{2,4} )/g, '$1\n\n$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ------------------------------------------------------------------ */
/* 香港用語                                                             */
/* ------------------------------------------------------------------ */

const HK_TERMS = [
  [/芯片/g, '晶片'],
  [/機器人/g, '機械人'],
  [/視頻(?!號)/g, '影片'],
  [/質量(?!守恆|不變)/g, '質素'],
  [/默認/g, '預設'],
  [/磁盤/g, '磁碟'],
  [/打印(?!機)/g, '列印'],
  [/運營/g, '營運'],
  [/訪問(?!量)/g, '存取'],
];

/** 異體字校正：OpenCC 港版字典會把「說」轉成日文異體「説」、「戶」轉成簡體「户」，一律拉回標準字形 */
const ORTHO = [
  [/説/g, '說'],
  [/户/g, '戶'],
  [/爲/g, '為'],
  [/卽/g, '即'],
  [/敎/g, '教'],
  [/靑/g, '青'],
  [/衆/g, '眾'],
];

function applyHkTerms(text) {
  return HK_TERMS.reduce((acc, [re, to]) => acc.replace(re, to), text);
}

function fixOrtho(text) {
  return ORTHO.reduce((acc, [re, to]) => acc.replace(re, to), text);
}

/* ------------------------------------------------------------------ */
/* 後設資料                                                             */
/* ------------------------------------------------------------------ */

function autoTags(text) {
  const rules = [
    ['模型', /模型|GPT|Gemini|Claude|Llama|Mistral|Qwen|DeepSeek|參數/i],
    ['晶片', /晶片|芯片|NVIDIA|英偉達|輝達|GPU|台積電|算力/i],
    ['資本', /股價|融資|估值|市值|上市|IPO|財報|營收|跌|瀉|漲/i],
    ['產品', /發布|推出|上線|更新|App|應用|工具/i],
    ['政策', /監管|法案|政策|政府|歐盟|合規|安全/i],
    ['機械人', /機械人|机器人|具身|Robot/i],
  ];
  return rules.filter(([, re]) => re.test(text)).map(([t]) => t).slice(0, 3);
}

function makeSlug(title, date) {
  const clean = title
    .replace(/[「」『』《》〈〉“”"'’‘（）()\[\]【】〔〕·・、，。！？：；…—\-\/\|\\]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const short = Array.from(clean).slice(0, 28).join('').replace(/-+$/g, '');
  return `${date}-${short || 'post'}`;
}

function makeDescription(md, fallback) {
  const body = md
    .split('\n')
    // 排除標題、引言提示（> 說明／> 提示）、表格分隔行
    .filter((l) => {
      const t = l.trim();
      return (
        !/^#{1,6}\s/.test(t) &&
        !t.startsWith('>') &&
        !t.startsWith('|') &&
        !/^\|?[\s:|-]+\|?$/.test(t)
      );
    })
    .join('\n');
  const plain = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`\-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/([\u4e00-\u9fff。，！？、；：」』）%])\s+([\u4e00-\u9fff「『（])/g, '$1$2')
    .trim();
  if (!plain) return fallback;
  // 優先切在句末標點，避免把詞切斷
  const head = Array.from(plain).slice(0, 96).join('');
  const stop = Math.max(
    head.lastIndexOf('。'),
    head.lastIndexOf('！'),
    head.lastIndexOf('？')
  );
  if (stop >= 36) return head.slice(0, stop + 1);
  const cut = Array.from(plain).slice(0, 88).join('');
  return cut.replace(/[，、；：]$/, '') + (plain.length > 88 ? '…' : '');
}

const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/* ------------------------------------------------------------------ */
/* 主流程                                                               */
/* ------------------------------------------------------------------ */

async function convert(opts) {
  const { html, baseDir, url } = await loadHtml(opts);
  const { title: rawTitle, date, $, $content } = extract(html);

  const toTW = OpenCC.Converter({ from: 'cn', to: 'tw' });
  // 注意：不用 to:'hk'，opencc-js 的港版字典會把「說」轉成日文異體「説」、「戶」轉成簡體「户」
  const conv = (s) => fixOrtho(opts.convert ? applyHkTerms(toTW(s)) : s);
  const title = conv(rawTitle);

  if (opts.headings) promoteHeadings($, $content);
  splitBrParagraphs($, $content);
  const hadMedia = markMedia($, $content);

  const publishDate = opts.date || date;
  const baseSlug = opts.slug || makeSlug(title, publishDate);

  let imageCount = 0;
  if (opts.images) {
    imageCount = await localizeImages($, $content, {
      slug: baseSlug,
      baseDir,
      referer: url,
    });
  }

  let md = cleanMarkdown(toMarkdown($, $content), title);

  // 文末說明：無法搬遷的媒體、需要人工核對的表格
  const notes = [];
  if (hadMedia) {
    const note = mediaNote(hadMedia, url).trim();
    if (note) notes.push(note);
  }
  if ($content.find('table').length > 0) {
    notes.push('> 提示：本文原文含表格，博客版已盡量保留，發佈前請人工核對一次行列與數字。');
  }
  if (notes.length) md += `\n\n${notes.join('\n\n')}\n`;

  if (opts.convert) {
    md = conv(md);
  }

  const tags = opts.tags
    ? opts.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    : autoTags(title + '\n' + md);

  const desc = makeDescription(md, title);
  const coverMatch = md.match(/!\[[^\]]*\]\((\/images\/[^)]+)\)/);

  const front = [
    '---',
    `title: ${q(title)}`,
    `date: ${publishDate}`,
    `description: ${q(desc)}`,
    `tags: [${tags.map(q).join(', ')}]`,
    coverMatch ? `cover: ${q(coverMatch[1])}` : null,
    url ? `source: ${q(url)}` : null,
    '---',
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');

  const file = `${baseSlug}.md`;
  const outPath = path.join(ROOT, opts.out, file);
  const content = `${front}${md}\n`;

  if (!opts.dry) {
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, content, 'utf8');
  }

  const chars = md.replace(/\s/g, '').length;
  console.log(`\n✔ ${title}`);
  console.log(`  檔案　${path.relative(ROOT, outPath)}`);
  console.log(`  日期　${publishDate}　字數　約 ${chars}　圖片　${imageCount} 張`);
  console.log(`  標籤　${tags.join('、') || '（無）'}`);
  if (opts.dry) console.log('\n--- dry run 預覽 ---\n' + content);
  return outPath;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(await readFile(fileURLToPath(import.meta.url), 'utf8').then((s) =>
      s.split('*/')[0].replace(/^\/\*\*?/, '').replace(/^\s*\* ?/gm, '')
    ));
    return;
  }

  if (opts.batch) {
    const list = (await readFile(path.resolve(process.cwd(), opts.batch), 'utf8'))
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    console.log(`批次處理 ${list.length} 條連結…`);
    for (const line of list) {
      try {
        const [u, ...extra] = line.split(/\s+/);
        await convert({ ...opts, batch: null, input: u, file: null, slug: extra[0] || null });
      } catch (err) {
        console.error(`✘ ${line}\n  ${err.message}`);
      }
    }
    return;
  }

  await convert(opts);
}

main().catch((err) => {
  console.error(`\n✘ ${err.message}\n`);
  process.exit(1);
});
