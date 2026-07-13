# 紫微斗数 · 倪海夏正宗排盘引擎

> 基于**倪海夏《天纪》**教学体系的紫微斗数排盘系统，包含完整排盘算法、四化系统、格局知识库、古籍原文数据，以及 AI 深度命盘解读。

基于开源项目 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu) 二次开发，新增了 AI 解读后端（DeepSeek V4 Pro）。

---

## 线上部署

| 平台 | 域名 | 排盘 | AI 解读 | 国内访问 |
|------|------|:----:|:------:|:------:|
| **Cloudflare Pages** | [ziwei.dhammaai.com](https://ziwei.dhammaai.com) | ✅ | ✅ | ✅ 直连 |
| **Vercel** | [ziwei-doushu-mauve.vercel.app](https://ziwei-doushu-mauve.vercel.app) | ✅ | ✅ | 需 VPN |
| **本地** | http://localhost:3000 | ✅ | ✅ | — |

- **国内用户** → `https://ziwei.dhammaai.com`（Cloudflare Pages + Pages Functions，国内直连）
- **VPN 环境** → `https://ziwei-doushu-mauve.vercel.app`（Vercel，完整功能备份）

---

## AI 解读功能

### 三个 API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/interpret` | POST | AI 命盘解读（流式 SSE） |
| `/api/heming` | POST | AI 合盘分析（流式 SSE） |
| `/api/generate` | POST | 服务端起盘（前端已内嵌排盘，此路由为兼容保留） |

### 模型

- **DeepSeek V4 Pro**（`deepseek-v4-pro`）— 1.6T 参数 MoE，49B 激活
- 内置 thinking 模式：先内部推理命盘结构，再输出解读
- 代码过滤 `reasoning_content`，前端只收到最终解读文本
- 流式输出格式：`data: {"delta":{"text":"..."}}\n\n`

### 成本

- 每次命盘解读约 ¥0.002-0.004（DeepSeek V4 Pro 定价）

### 文件结构

```
lib/ai/
├── deepseek.ts          # DeepSeek LLM 调用模块（Vercel/Node.js 运行时）
└── chart-serializer.ts  # 命盘数据序列化为 LLM 可读文本

app/api/
├── interpret/route.ts   # 命盘解读 API（Next.js Route Handler）
├── heming/route.ts      # 合盘分析 API
└── generate/route.ts    # 服务端起盘 API

cf-deploy/
├── _worker.js           # Cloudflare Pages Worker（处理 /api/* 路由）
└── (静态文件)            # Next.js 静态导出
```

---

## 快速开始

```bash
# 克隆
git clone https://github.com/Renhuai123/ziwei-doushu.git
cd ziwei-doushu

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入 DeepSeek API Key

# 启动开发服务器
npm run dev
```

### 环境变量

```bash
# .env.local
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_MODEL=deepseek-v4-pro
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

获取 DeepSeek API Key：https://platform.deepseek.com/

---

## 部署

### 方式一：Vercel（推荐，最简单）

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel --prod

# 配置环境变量
vercel env add DEEPSEEK_API_KEY production
vercel env add DEEPSEEK_MODEL production
```

### 方式二：Cloudflare Pages（国内直连）

```bash
# 1. 构建静态文件
npm run build

# 2. 准备部署目录（静态文件 + _worker.js）
mkdir -p cf-deploy
cp -r .vercel/output/static/* cf-deploy/
# _worker.js 已在 cf-deploy/ 中，处理 /api/* 路由

# 3. 部署
npx wrangler pages deploy cf-deploy --project-name ziwei-doushu --branch main

# 4. 配置 Secrets
npx wrangler pages secret put DEEPSEEK_API_KEY --project-name ziwei-doushu
npx wrangler pages secret put DEEPSEEK_MODEL --project-name ziwei-doushu

# 5. 绑定自定义域名
# 在 Cloudflare Dashboard → Pages → ziwei-doushu → Custom domains 添加域名
# DNS 添加 CNAME: ziwei → ziwei-doushu.pages.dev（开启代理）
```

> **注意**：Cloudflare Pages 用 `_worker.js`（Advanced Mode）实现 API 路由。
> `@cloudflare/next-on-pages` 和 `@opennextjs/cloudflare` 与 Next.js 15.5 不兼容，
> 所以不用那些工具，直接用 `_worker.js` + 静态文件。

---

## 开源内容

### 排盘算法（`lib/ziwei/`）

| 文件 | 说明 |
|------|------|
| `algorithm.ts` | 完整排盘流程：安命宫、定五行局、安十四主星、安辅星、排大限流年 |
| `constants.ts` | 天干地支、十四主星、辅星常量 |
| `sihua.ts` | 四化飞星系统（禄权科忌），含各天干四化对照表 |
| `patterns.ts` | **1100+ 行格局知识库**：紫府同宫、日月并明、七杀朝斗等经典格局判定规则 |
| `heming-knowledge.ts` | 合盘方法论：倪师体系下双盘比对逻辑 |
| `types.ts` | TypeScript 类型定义 |
| `cities.ts` | 中国城市经纬度，用于真太阳时校正 |
| `famous.ts` | 历史名人命盘示例数据 |

### 古籍原文（`lib/classics/`）

- **骨髓赋**（`gusuifu.ts`）— 紫微斗数核心歌诀
- **紫微斗数全集**（`quanji.ts`）— 清代古本
- **紫微斗数全书**（`quanshu.ts`）— 陈希夷传本

### 前端界面（`app/` + `components/`）

完整的 Next.js 15 前端，包含：

- 排盘工作台（命盘方格、宫位详情、星曜面板）
- 合盘分析页
- 古籍阅读器（全文搜索）
- 命理百科（14 主星 + 12 宫位知识页）
- 亮色/暗色主题切换
- 移动端适配

---

## 技术栈

- **框架**：Next.js 15.5（App Router）
- **语言**：TypeScript
- **样式**：Tailwind CSS + CSS Variables 设计系统
- **排盘**：基于 [iztro](https://github.com/SylarLong/iztro) + lunar-javascript
- **动画**：Framer Motion
- **AI**：DeepSeek V4 Pro（OpenAI 兼容协议，流式 SSE）
- **部署**：Cloudflare Pages（主）+ Vercel（备）

---

## 项目理念

紫微斗数是中国传统命理学的瑰宝，倪海夏老师在《天纪》中系统梳理了正宗的紫微斗数体系。我们希望通过技术手段让更多人接触和学习这门学问。

开源排盘算法和知识库，是因为我们相信：**算法是公开的传统智慧，不应该被锁在围墙里**。真正的价值在于解读的深度、用户体验的打磨、以及持续运营的积累。

---

## 协议

本仓库分三部分授权，都是宽松协议，**商用没有任何限制**：

| 内容 | 协议 | 简单说 |
|------|------|--------|
| **代码**（`lib/`、`app/`、`components/`） | [MIT License](./LICENSE) | 拿去随便用，保留 LICENSE 文件即可 |
| **古籍原文**（骨髓赋、紫微斗数全集 / 全书等） | Public Domain | 古书都是公有领域，不存在版权 |

---

## 致谢

- 原项目：[Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu) — 排盘算法、格局知识库、古籍数据
- 倪海夏老师 — 《天纪》紫微斗数体系传承
