# AGENTS.md

## 项目概况

紫微斗数排盘引擎（倪海夏《天纪》体系），基于 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu) 二次开发，新增 AI 解读后端。

## 部署

- **Cloudflare Pages（主）**: https://ziwei.dhammaai.com — 国内直连，含 AI
- **Vercel（备）**: https://ziwei-doushu-mauve.vercel.app — 需 VPN
- **本地**: http://localhost:3000

## 常用命令

```bash
npm run dev          # 开发服务器
npm run build        # 构建
npm run deploy:vercel  # 部署到 Vercel
npm run deploy:cf      # 部署到 Cloudflare Pages（构建+复制+部署一条龙）
```

## 环境变量

- `DEEPSEEK_API_KEY` — DeepSeek API 密钥
- `DEEPSEEK_MODEL` — 模型名，当前用 `deepseek-v4-pro`
- `NEXT_PUBLIC_SITE_URL` — 站点 URL

## 架构要点

- **排盘算法**：纯前端（`lib/ziwei/algorithm.ts`），不需要后端
- **AI 解读**：三个 API 路由（`/api/interpret`、`/api/heming`、`/api/generate`）
- **Vercel 运行时**：`lib/ai/deepseek.ts` + `app/api/*/route.ts`（Next.js Route Handler）
- **Cloudflare 运行时**：`cf-deploy/_worker.js`（Pages Functions Advanced Mode，自包含，不依赖 Node.js API）
- **DeepSeek V4 Pro**：thinking 模式，代码过滤 `reasoning_content` 只输出 `content`

## Cloudflare Pages 部署注意事项

- `@cloudflare/next-on-pages` 和 `@opennextjs/cloudflare` 与 Next.js 15.5 不兼容
- 用 `_worker.js`（Advanced Mode）+ 静态文件替代
- `_worker.js` 放在 `cf-deploy/` 根目录，wrangler 会自动编译
- Secrets 用 `npx wrangler pages secret put` 配置
- 自定义域名需在 Cloudflare Dashboard → Pages → Custom domains 注册
- DNS CNAME 指向 `ziwei-doushu.pages.dev`，开启 Cloudflare 代理（橙色云）

## 域名配置

- `ziwei.dhammaai.com` CNAME → `ziwei-doushu.pages.dev`（Cloudflare 代理开启）
- Cloudflare Zone ID: `1f980eb1d8f8fbf31be9f7b9a28ef9d6`
- Cloudflare Account ID: `4f9b93898cfa072a55a6fab581e648c9`
- Vercel Project: `dhammaais-projects/ziwei-doushu`
- Vercel Team: `team_7XvVuVt3OHMlVdSLCNSHEjJg`

## 已知问题

- 本地代理（127.0.0.1:6152）对 Cloudflare 代理域名的 SSL 握手不稳定，直连 Cloudflare IP 正常
- Vercel 域名在国内被墙，必须挂 VPN
- `deepseek-chat` 和 `deepseek-reasoner` 将于 2026/07/24 退役，已迁移到 `deepseek-v4-pro`
