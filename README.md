# appshots

appshots 是一个用于批量生成 App Store / Google Play 商店截图的全栈项目。

- Web 工作流：创建项目 → 上传截图 → AI 分析文案 → 预览编辑 → 导出 ZIP
- 技能化工作流（AI IDE 友好）：直接输入图片 + 文案 JSON，导出成品到指定目录

## 功能亮点

- 支持多语言导出：默认 `zh/en/pt/ja/ko`，并支持添加任意语言代码
- 支持 App Store 与 Google Play 常见尺寸（iPhone / iPad / Android 手机与平板）
- 导出水印默认 `appshots`，可按任务覆盖
- 导出任务支持进度轮询与 SSE
- 管理后台（`/admin`）：查看用户与项目，支持删除项目和用户

## 技术栈

- Frontend: React + Vite + Tailwind
- Backend: Express + Drizzle ORM + SQLite + Sharp
- Shared types: `packages/shared`

## 快速开始（本地开发）

### 1) 环境要求

- Node.js >= 20
- pnpm >= 9

### 2) 安装依赖

```bash
pnpm install
```

### 3) 配置环境变量

```bash
cp .env.example .env
```

至少需要配置：

- `OPENAI_API_KEY`
- `JWT_SECRET`
- `ADMIN_KEY`（启用后台管理接口）

### 4) 启动

```bash
pnpm dev
```

默认访问：

- 前端（Vite）：`http://localhost:5173`
- 后端 API：`http://localhost:3001`

## Docker 部署（本地/远程服务器）

```bash
docker-compose up --build -d
```

如果 Docker Hub 拉取 `node:20-bookworm-slim` 不稳定（EOF），可以切换镜像源：

```bash
NODE_IMAGE=public.ecr.aws/docker/library/node:20-bookworm-slim docker-compose up --build -d
```

部署后默认服务端口：`3001`。

## 技能化导出（推荐给 Codex / Claude Code / Cursor 等 AI IDE）

该模式不依赖网页流程，适合“模型先做图像理解和文案推荐，appshots 只负责渲染导出”。

### 命令

```bash
pnpm skill:export -- \
  --images-dir ./input-screenshots \
  --copy ./examples/skill-copy.example.json \
  --template clean \
  --sizes "6.7,android-phone" \
  --languages "zh,en,pt,ja,ko" \
  --out-dir ./exports \
  --app-name DemoApp \
  --include-watermark true \
  --watermark-text appshots
```

### 必填参数

- `--out-dir`
- `--images` 或 `--images-dir`（二选一）

### 支持尺寸

- iOS: `6.7`, `6.1`, `5.5`, `11.0`, `12.9`
- Google Play: `android-phone`, `android-7`, `android-10`

更多说明见：`docs/skill-cli.md`

## 远程访问 + 技能封装建议

如果你准备开源并让其他开发者远程使用，建议两层方案：

1. **部署 appshots 服务（HTTP API）**
   - 用于网页端流程、团队共享、任务化导出。
2. **提供技能层（CLI wrapper / IDE Skill）**
   - 在开发者本机调用 `pnpm skill:export`，结果直接输出到本地目录。

这种模式下，AI IDE 负责“识图 + 文案建议”，appshots 负责“稳定渲染 + 多尺寸导出”，职责最清晰。

## 管理后台

- 页面：`/admin`
- Header 鉴权：`x-admin-key: <ADMIN_KEY>`
- API：
  - `GET /api/admin/users`
  - `DELETE /api/admin/projects/:projectId`
  - `DELETE /api/admin/users/:userId`

## 字体与商用说明

前端默认使用 Google Noto 字体族（如 Noto Sans / Noto Sans SC / Noto Sans JP / Noto Sans KR / Noto Serif SC），对应 SIL Open Font License，支持免费商用。

## 常用命令

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm skill:export -- --help
pnpm test:skill-cli
```

## 已知限制

- 导出任务状态与高级导出限流目前均为内存级实现，服务重启后会重置
- `uploads/`、`uploads/exports/` 暂无自动清理策略
- 自动化测试覆盖仍在补齐（当前提供 skill CLI smoke test）
