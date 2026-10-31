# 上線與部署

## ✅ 現況（2026-10-31）：正式上線已完成

博客正式站（Cloudflare Pages，免費，可被搜索引擎收錄）：

**https://vivian-ai-tech-blog.pages.dev**

| 項目 | 狀態 |
|---|---|
| 託管 | Cloudflare Pages（免費方案，帶寬無限，HTTPS 自動） |
| 代碼倉庫 | https://github.com/vivian134fan/vivian-ai-tech-blog（public，main） |
| 域名 | `vivian-ai-tech-blog.pages.dev`（日後可隨時綁自己域名） |
| 登入憑證 | wrangler OAuth 已登入（`vivian23009@me.com`） |

## 每日發佈流程（一條命令）

```bash
cd ~/WorkBuddy/2026-10-31-12-30-11/ai-frontier-blog

# 只發佈現有文章：
npm run publish

# 貼公眾號連結：轉換 → 構建 → 部署 → 推 GitHub，一條龍：
npm run publish -- --url "https://mp.weixin.qq.com/s/xxxx"
```

分步命令（想一步一步來時用）：

```bash
npm run wx -- "https://mp.weixin.qq.com/s/xxxx"   # 只轉換，先檢查 md
npm run dev                                        # 本地預覽 http://localhost:4321
npm run build                                      # 只構建
npm run deploy                                     # 構建＋部署（不推 GitHub）
```

## 已知問題（都不影響使用）

- **WorkBuddy 沙盒內 `astro build` 退出碼為 1**：是沙盒攔截 Astro 清空 dist 目錄的噪音，產物其實已生成；`publish.mjs` 已做容錯（驗證 dist 新鮮度後繼續）。在自己 Terminal 跑不會有此問題。
- **github.com 網頁間歇被牆**：推代碼走 SSH 443 通道（`~/.ssh/config` 已配置 github.com → ssh.github.com:443），不受影響。
- **Cloudflare dashboard 喺內地網絡偶爾載不出**：註冊／登入時用 iPhone 熱點最穩；命令行部署走 `api.cloudflare.com`，一直暢通。

## 日後想綁自己域名（可選）

1. 買域名（約 US$10–15／年）
2. Cloudflare dashboard → Pages → `vivian-ai-tech-blog` → Custom domains → Add
3. 按指示喺域名商加一條 CNAME 記錄指去 `vivian-ai-tech-blog.pages.dev`
4. 更新本地 `astro.config.mjs` 的 `site` 再 `npm run publish`

## 歷史：臨時分享頁（已停用）

較早前用過 WorkBuddy 托管的 `https://ai-frontier-blog-65093.app.workbuddy.host/?sharecode=6JP2BP55H4`（noindex、固定域名、子路徑要 sharecode），已被正式站取代，僅留作記錄。
