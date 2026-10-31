# AI 科技資訊前沿・博客

微信公眾號文章的靜態博客鏡像站。每天在公眾號發表後，跑一條命令即可把文章轉成博客文章。

- 框架：Astro（靜態輸出，可免費部署到 Cloudflare Pages / GitHub Pages）
- 語文規格：香港繁體書面語（OpenCC 標準繁體 ＋ 香港用語替換表 ＋ 異體字校正；不用 opencc-js 的 hk 字典，因其會產出「説」「户」等問題字形）
- 站點內容：`src/posts/*.md`（每篇一個檔案）；圖片落地到 `public/images/<slug>/`

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
6. 生成帶 frontmatter 的 Markdown（含自動摘要、標籤、原文連結）

## 每日流程建議

1. 公眾號發表後，從電腦端後台複製文章連結
2. `npm run wx -- "連結"`
3. `npm run dev` 快速過目一眼
4. `npm run build` ＋ git push（接了 GitHub 後 Cloudflare Pages 會自動部署）

## 部署（Cloudflare Pages，免費）

1. 把整個 `ai-frontier-blog/` 目錄推上一個 GitHub 倉庫
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. 構建命令填 `npm run build`，輸出目錄填 `dist`
4. 部署完成後在 Pages 設定 → Custom domains 綁定自己的域名
5. 把 `astro.config.mjs` 裡的 `site` 改成實際網域

不想用 GitHub 的話，也可以直接 `npx wrangler pages deploy dist`。

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
