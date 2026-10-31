# 上線與部署

## 現況

博客已發佈到臨時托管，可直接分享：

**https://ai-frontier-blog-65093.app.workbuddy.host/?sharecode=6JP2BP55H4**

### 這個連結的限制（要知）

| 項目 | 情況 |
|---|---|
| 站內跳轉 | 已用腳本把 `sharecode` 帶到每個連結與圖片，可正常點擊 |
| 搜索引擎收錄 | ❌ 托管方標了 `noindex`，Google／百度不會收錄 |
| 獨立域名 | ❌ 只能是 `*.app.workbuddy.host` |
| 適合用途 | ✅ 發給朋友、客戶、微信裡分享著看 |

**結論**：呢個連結當「臨時分享頁」用。要真正做博客（被搜到、有自己域名），就要行下面第二條路。

---

## 正式上線：GitHub + Cloudflare Pages（免費）

### 你需要做的三件事

1. **GitHub 帳號**（github.com 免費註冊，若已有就跳過）
2. **Cloudflare 帳號**（cloudflare.com 免費註冊，用同一 email 即可）
3. **決定域名**：可以先用免費的 `xxx.pages.dev`，之後隨時綁自己的域名

做完上面三件，其餘我可以接手：建倉庫、推代碼、設定構建、綁域名。

### 完整步驟（給你自己做時參照）

```bash
# 1. 在 GitHub 建一個空倉庫，名為 ai-frontier-blog（不要勾選 README）
# 2. 本地推上去
cd ~/WorkBuddy/2026-10-31-12-30-11/ai-frontier-blog
git remote add origin https://github.com/<你的用戶名>/ai-frontier-blog.git
git branch -M main
git push -u origin main
```

3. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
4. 授權 GitHub，選 `ai-frontier-blog` 倉庫
5. 構建設定：
   - Framework preset：`Astro`
   - Build command：`npm run build`
   - Build output directory：`dist`
6. **Save and Deploy**，一兩分鐘後拿到 `https://ai-frontier-blog.pages.dev`
7. 綁自己的域名：Pages 專案 → **Custom domains** → 輸入域名 → 按指示改 DNS
8. 最後把 `astro.config.mjs` 裡的 `site` 改成實際域名，再 commit 一次

> 不想用 GitHub 也可以直接上傳：
> `npx wrangler pages deploy dist --project-name ai-frontier-blog`
> （第一次會開瀏覽器要你登入 Cloudflare）

---

## 每日更新流程

```bash
cd ~/WorkBuddy/2026-10-31-12-30-11/ai-frontier-blog

# 1. 公眾號發表後，貼連結轉換
npm run wx -- "https://mp.weixin.qq.com/s/xxxx"

# 2. 本地看一眼（可選）
npm run dev        # http://localhost:4321

# 3. 構建
npm run build

# 4A. 用 Cloudflare Pages（接咗 GitHub 的話）
git add -A && git commit -m "新增文章：<標題>" && git push
#     推上去後 Cloudflare 會自動構建部署

# 4B. 或直接上傳 dist
npx wrangler pages deploy dist --project-name ai-frontier-blog
```

## 疑難排解

| 症狀 | 處理 |
|---|---|
| 抓連結時報「找不到正文容器」 | 微信要求驗證。在瀏覽器打開文章 → 檔案 → 另存為網頁（完整）→ `npm run wx -- --file 存檔.html` |
| 某篇文章標題冇被識別成小標題 | 原文該句不是粗體。轉換後手動在 md 裡加 `## ` |
| 圖片裂開 | 檢查 `public/images/<slug>/` 是否有檔；若原文圖片來自其他域名被擋，手動下載放入同目錄並改連結 |
| 數字前後多咗空格 | 微信原文的排版痕跡，可全域搜尋「 分」「 %」手動修 |
