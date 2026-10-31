# AI 科技資訊前沿・博客

《AI 科技資訊前沿》的官方博客站。正式站：**https://vivian-ai-tech-blog.pages.dev**

- 框架：Astro（靜態輸出，部署到 Cloudflare Pages）
- 語文規格：香港繁體書面語（OpenCC 標準繁體 ＋ 香港用語替換表 ＋ 異體字校正；不用 opencc-js 的 hk 字典，因其會產出「説」「户」等問題字形）
- 站點內容：`src/posts/*.md`（每篇一個檔案）；圖片落地到 `public/images/<slug>/`

## ⚠️ 發佈次序（2026-10-31 定案，由 11-01 起執行）

**博客先發，微信公眾號後發。** 原因與做法：

| 次序 | 動作 | 目的 |
|---|---|---|
| 1 | 博客文章上線（`npm run publish`） | 博客有 `canonical` 指向自己，且發佈時間較早，搜索引擎會認它為首發版本 |
| 2 | 文章頁自動標示「本文首發於 AI 科技資訊前沿博客」 | 確立首發出處，降低被判重複內容的風險 |
| 3 | 同日把同一篇發去微信公眾號，文末附博客連結 | 公眾號引流到可被搜尋的公域站 |
| 4 | 博客文章頁底部自動附「微信公眾號同步版」連結 | 兩邊互導，閉環 |

> 注意：微信公眾號不支援 `canonical`，所以「博客先發 + 時間較早」是唯一有效的判重訊號。

## 轉換後必做的事（每次）

1. **含表格的文章**：轉換器會保留 Markdown 表格，但微信表格常被壓成多層 `section`，發佈前**必須人工核對一次行列與數字**（文末會自動加提示句）。
2. **含影片／語音／小程序卡片**：博客版無法呈現，轉換器會自動移除並在文末加「前往微信公眾號原文觀看」連結（有原文 URL 時自動帶連結）。
3. **簡體殘留檢查**：轉換器已做簡轉繁，但專名與引號仍需目視一次。

## 快速開始

```bash
npm install
npm run dev        # 本地預覽 http://localhost:4321
npm run build      # 產出 dist/
npm run preview    # 預覽構建結果
```


## 轉換一篇文章

```bash
# 方式一：直接抓公眾號連結（推薦）
npm run wx -- "https://mp.weixin.qq.com/s/xxxxxxxx"

# 方式二：瀏覽器另存網頁後轉換（遇到驗證頁時用這個）
npm run wx -- --file ~/Desktop/文章存檔.html

# 方式三：批次
npm run wx -- --batch urls.txt
```

常用參數：

| 參數 | 說明 |
|---|---|
| `--slug xxx` | 自訂檔名 |
| `--date 2026-10-31` | 指定發佈日期 |
| `--tags "AI,模型"` | 自訂標籤（預設按關鍵詞自動判斷） |
| `--no-images` | 不下載圖片 |
| `--no-convert` | 不做簡轉繁（原文已是繁體時可用） |
| `--dry` | 只預覽不寫檔 |

轉換器會自動完成：

1. 抽取標題、發佈時間、正文（`#js_content`）
2. 把公眾號特有的 `section + br` 假段落還原成真段落；粗體短句自動升級為小標題
3. 下載全部圖片到本地（繞過 `mmbiz.qpic.cn` 防盜鏈）並改寫連結
4. 剔除二維碼、讚賞、「預覽時標籤不可點」等雜訊，以及文末署名塊（由博客版式統一輸出）
5. 簡轉繁＋香港用語校正（芯片→晶片、機器人→機械人、視頻→影片、默認→預設、磁盤→磁碟、運營→營運等；「視頻號」例外保留）＋異體字校正（説→說、户→戶等）
6. 表格轉成標準 Markdown 表格（並加人工核對提示）
7. 移除微信內嵌影片／語音／小程序卡片，並在文末加「前往微信公眾號原文觀看」連結
8. 生成帶 frontmatter 的 Markdown（含自動摘要、標籤、原文連結）

## 每日流程（博客先發）

```bash
# 1) 轉換今日文章（先本地看一遍）
npm run wx -- "https://mp.weixin.qq.com/s/xxxx"

# 2) 過目 md：表格／數字／專名／簡體殘留

# 3) 一條命令上線（構建 → 部署 Cloudflare Pages → 推 GitHub）
npm run publish

# 或者一步到底（轉換＋上線）
npm run publish -- --url "https://mp.weixin.qq.com/s/xxxx"
```

博客上線後，再把同一篇發去微信公眾號（文末附博客連結）。

## 部署（已設定完成）

- 平台：Cloudflare Pages，項目名 `vivian-ai-tech-blog`
- 網址：https://vivian-ai-tech-blog.pages.dev
- 倉庫：https://github.com/vivian134fan/vivian-ai-tech-blog
- 日常發佈：`npm run publish`（部署走 `api.cloudflare.com`，不受 github.com 網頁被封影響；推 GitHub 走 SSH 443）
- 詳細說明與疑難排解：見 `DEPLOY.md`

## 目錄結構

```
ai-frontier-blog/
├── astro.config.mjs
├── package.json
├── public/
│   ├── favicon.svg
│   └── images/<slug>/      # 轉換時下載的文章圖片
├── src/
│   ├── layouts/Base.astro  # 全站版式（含署名與免責聲明）
│   ├── lib/posts.ts        # 讀取與解析文章
│   ├── pages/              # 首頁、文章頁、關於頁
│   ├── posts/*.md          # 博客文章（轉換器輸出）
│   └── styles/global.css
└── tools/
    ├── wx2blog.mjs         # 轉換器
    └── fixtures/sample.html # 測試用範例
```

## 注意事項

- 內容重複：建議博客先發、公眾號後發，或博客版本聲明「首發於本站」；兩邊互放連結導流
- 公眾號內嵌影片、小程序卡片無法搬遷，轉換器會自動移除並在文末提示「前往公眾號原文觀看」
- 如某天的文章含表格（圖片式表格除外），轉換後請人工檢查一次
