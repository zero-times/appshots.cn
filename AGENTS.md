# AGENTS.md · appshots 项目协作手册（Project-wide）

> 本文档是 **整个 appshots 项目** 的代理/开发执行规范。  
> 目标：在保证安全与可回滚的前提下，稳定交付功能。


## 文档导航

- 工程执行版（技术规则）：`AGENTS.md`
- 团队协作版（流程治理）：`AGENTS.team.md`

---
## 1) 执行模式约定（Mode Policy）

### `extra high` 适用场景（必须）
- 修改本文件（`AGENTS.md`）
- 鉴权、权限、项目归属、导出权限/限流等安全相关改动
- 数据模型、接口契约、跨端（client + server + shared）联动改动
- 影响生产行为的核心流程（创建/分析/导出/删除）

### `medium` 适用场景（默认）
- 常规 UI 样式优化、文案调整、非核心交互改进
- 不改接口契约的前端局部逻辑优化
- 对核心流程无行为改变的重构

### 交付标准
- `extra high`：必须包含影响面说明 + 风险点 + 验证路径
- `medium`：至少通过类型检查，并完成对应范围的手工验证

---

## 2) 项目概览

appshots 是一个用于生成 App Store 截图素材的全栈 Monorepo：
- 前端：React + Vite + Tailwind
- 后端：Express + Drizzle ORM + SQLite + Sharp
- 共享类型：`packages/shared`
- AI 能力：基于 OpenAI 兼容接口，完成截图分析与文案生成

核心业务链路：
1. 创建项目
2. 上传 3-5 张截图
3. 填写应用信息（含支持语言）
4. AI 分析并按所选语言生成文案/推荐模板
5. 预览编辑（文案 + 模板）
6. 导出（带/不带水印，支持任务进度）

---

## 3) Monorepo 结构

```text
appshots/
  client/                # React 前端
  server/                # Express API + 图像/导出服务
  packages/shared/       # 类型与常量（模板、尺寸、请求类型）
  uploads/               # 上传图片与导出 ZIP
  AGENTS.md              # 本文档
```

关键目录：
- `client/src/pages/`：页面级流程（Landing/Creator/Preview/History/Login）
- `client/src/components/`：编辑器、导出面板、模板选择等
- `server/src/routes/`：`auth`/`projects`/`analyze`/`export`
- `server/src/services/`：`claude`、`imageComposer`、`exportService`、`exportJobStore`
- `packages/shared/src/`：跨端类型与业务常量

---

## 4) 本地开发与运行

## 前置要求
- Node.js >= 20
- pnpm >= 9

## 常用命令（项目根目录执行）
- 安装依赖：`pnpm install`
- 同时启动前后端：`pnpm dev`
- 仅前端：`pnpm dev:client`
- 仅后端：`pnpm dev:server`
- 全量构建：`pnpm build`
- 全量类型检查：`pnpm typecheck`
- 技能导出（本地目录）：`pnpm skill:export -- --help`

## 环境变量（根目录 `.env`）
参考 `.env.example`：
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`（默认 `https://codex-api.packycode.com/v1`）
- `OPENAI_MODEL`（默认 `gpt-5.3`）
- `PORT`（默认 `3001`）
- `DATABASE_URL`（默认 `./data/appshots.db`）
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ADMIN_KEY`（管理后台接口密钥，Header: `x-admin-key`）

---

## 5) 架构与关键机制

## 5.1 身份与归属模型
- 匿名用户：通过 `sf_sid`（session cookie）识别
- 登录用户：通过 `sf_token`（JWT cookie）识别，`req.userId` 可用
- 项目归属字段：
  - `ownerSessionId`
  - `ownerUserId`（登录后可关联）
- 登录验证成功时，会把当前 session 下匿名项目迁移到当前用户（`ownerUserId` 赋值）

## 5.2 项目状态
`draft -> analyzing -> ready`
- 分析失败会回退到 `draft`

## 5.3 导出机制
- 异步任务接口：`POST /api/projects/:id/export/jobs`
- 进度查询：`GET /api/export/jobs/:jobId`
- SSE 推送：`GET /api/export/jobs/:jobId/stream`
- 任务存储：内存 Map，TTL 30 分钟（`exportJobStore`）
- ZIP 文件落盘：`uploads/exports/`
- 渲染布局：支持多布局自动编排（上文案下主图、上主图下文案、跨屏走向联动、故事线切片跨屏），按模板与截图序号轮换
- 预览与导出共用同一渲染器；当复杂布局渲染失败时自动回退到基础布局，避免出现空白预览
- AI 分析结果会返回推荐模板组合（含构图模式），由服务端给出 3 组可切换组合建议
- 导出尺寸支持 App Store 与 Google Play 常见尺寸（含 iPhone/iPad/Android 手机与平板）

---

## 6) 当前生效的业务规则（务必遵守）

### 6.1 项目中心展示规则
- `GET /api/projects` **仅返回登录用户自己的项目**（按 `ownerUserId`）
- 项目能力改为登录前置：未登录访问项目接口返回 401
- 前端 `/history` 未登录时展示登录引导，而不是显示项目

### 6.2 功能使用登录要求
- 创建/查看/更新/删除项目、上传截图、AI 分析、预览渲染、导出任务均要求登录
- 前端未登录时应展示登录引导，不应继续核心流程

### 6.3 删除项目
- 支持删除项目（`DELETE /api/projects/:id`）
- 前端必须二次确认（确认框）再执行删除

### 6.4 会员与免费权限边界
- 免费用户：
  - 每天仅允许 1 次 AI 分析
  - AI 分析语言固定为 `zh + en`
  - 导出固定为中英双语 + 带水印
  - 不可使用预览编辑（文案/模板更新）
- 会员用户：
  - AI 分析不限次数，支持多语言
  - 可使用预览编辑能力
  - 支持无水印导出与多语言导出
- 会员开通方式：前端固定提示「微信手动开通」

### 6.5 高级导出频率限制
- 仅会员高级导出（无水印）受该规则约束
- 高级导出 5 分钟内只能触发一次
- 限流键：`projectId + userId`（或匿名 session）
- 触发频率过高返回 429
- **注意**：限流当前为内存级，服务重启后会重置

### 6.6 管理后台可见性
- 管理后台入口仅对 `role=admin` 用户显示
- 非管理员访问 `/admin` 仅展示无权限提示
- 管理后台支持：用户角色管理、会员开通/撤销、项目与用户删除

---

## 7) API 速查（核心）

### Auth
- `POST /api/auth/send-code` 发送验证码（每邮箱 1 分钟限 1 次）
- `POST /api/auth/verify-code` 验证登录/注册 + 迁移匿名项目
- `GET /api/auth/me` 当前登录态
- `GET /api/auth/usage` 获取当日 AI 分析使用量
- `POST /api/auth/logout` 退出

### Projects
- `GET /api/projects` 项目列表（登录必需）
- `POST /api/projects` 创建项目（登录必需）
- `GET /api/projects/:id` 项目详情（登录 + scope 校验）
- `PATCH /api/projects/:id` 更新项目（会员可编辑文案/模板）
- `DELETE /api/projects/:id` 删除项目（登录必需）
- `POST /api/projects/:id/upload` 上传截图（登录必需；3-5 张，<=10MB/张；服务端自动裁掉顶部状态栏与底部黑条）
- `POST /api/projects/:id/analyze` AI 分析与文案生成（登录必需；免费用户每天 1 次且仅中英双语）

### Export
- `GET /api/projects/:id/preview/:index` 渲染单张预览图（登录必需）
- `POST /api/projects/:id/export/jobs` 创建导出任务（推荐；登录必需）
- `GET /api/export/jobs/:jobId` 查询任务
- `GET /api/export/jobs/:jobId/stream` SSE 进度
- `POST /api/projects/:id/export` 旧版导出接口（兼容；登录必需）
- `GET /api/export/:filename` 下载 ZIP

### Admin（管理员可用，支持 `ADMIN_KEY` 兜底）
- `GET /api/admin/users` 查看用户与其项目
- `GET /api/admin/members` 查看当前生效会员
- `PATCH /api/admin/users/:userId/role` 设置用户角色（`user` / `admin`）
- `POST /api/admin/users/:userId/membership` 开通/撤销会员
- `DELETE /api/admin/projects/:projectId` 删除指定项目
- `DELETE /api/admin/users/:userId` 删除用户并级联删除其项目

---

## 8) 前端约束与改动指南

## 状态管理
- `authStore`：登录态、验证码流程
- `projectStore`：创建流程中项目状态（上传/分析/编辑）

## 页面职责
- `Creator`：创建项目 + 上传 + 分析
- `Preview`：文案编辑、模板切换、导出任务
- `History`：登录后项目中心 + 删除入口
- `Login`：邮箱验证码登录

## UI 风格
- 复用通用 class：`.sf-card` / `.sf-btn-primary` / `.sf-btn-ghost` / `.sf-input`
- 避免引入与现有视觉冲突的新设计语言

---

## 9) 后端约束与改动指南

- 所有项目读写接口必须做 scope 校验（`projectId + owner`）
- 涉及权限的前端限制必须有后端兜底（不能只做 UI disable）
- 新增字段时：
  1) 更新 `server/src/db/schema.ts`
  2) 更新 `server/src/db/init.ts` 的初始化/兼容逻辑
  3) 更新 `packages/shared` 类型
  4) 更新前端消费逻辑
- 错误信息保持可读，避免吞错

---

## 10) Shared 类型协作规范

改 API 契约时，先改 `packages/shared`：
- `types/api.ts`：请求/响应契约
- `types/project.ts`：项目结构
- `types/export.ts`：导出结构
- `constants/templates.ts` / `constants/devices.ts`：模板与尺寸

前后端均应引用 shared 类型，避免双份定义漂移。

---

## 11) 变更执行流程（推荐）

1. 明确影响面：client / server / shared / 数据结构
2. 先改 shared 契约（若有）
3. 改 server 逻辑与安全兜底
4. 改 client 交互与展示
5. 运行 `pnpm typecheck`
6. 手工验证关键链路（见下）
7. 记录风险与后续优化项

---

## 12) 发布前检查清单（必须）

### 自动检查
- [ ] `pnpm typecheck` 通过
- [ ] 无明显 TS 类型断言滥用（`as any` / `as never`）新增

### 手工冒烟
- [ ] 未登录访问创建/项目详情/导出时会被引导登录
- [ ] 登录后可在项目中心看到本人项目
- [ ] 项目中心删除前有确认框，删除后列表刷新
- [ ] 免费用户每日仅 1 次分析，第二次触发返回 429
- [ ] 免费用户分析后默认进入导出交付，不可编辑模板/文案
- [ ] 免费用户固定中英双语导出（带水印）
- [ ] 会员可编辑模板/文案并支持多语言分析与导出
- [ ] 高级导出 5 分钟内重复触发返回 429
- [ ] 非管理员看不到管理后台入口且无法访问管理数据
- [ ] 管理员可设置角色、开通/撤销会员、删除用户/项目

---

## 13) 已知限制与技术债

- 高级导出限流为进程内内存实现，重启后会清空
- 导出任务状态也在内存中，服务重启后任务不可追溯
- `uploads/` 与 `uploads/exports/` 暂无自动清理策略
- 缺少自动化测试，当前依赖类型检查 + 手工回归

---

## 14) 常见问题排查

- `401 请先登录`：检查登录态与 cookie 是否携带
- `403 编辑模板和文案仅限会员使用`：确认当前账号会员状态
- `403 无水印导出仅限会员使用`：确认会员状态或改用免费导出
- `429 高级导出调用过于频繁`：等待 5 分钟后重试
- `429 免费用户每天只能使用 1 次 AI 分析`：次日重试或开通会员
- `Project not found`：检查 session/user 是否与项目归属一致
- `OPENAI_API_KEY is not configured`：检查根目录 `.env`
- 分析失败返回 `draft`：查看服务端日志与 LLM 响应解析

---

## 15) 文档维护要求

出现以下改动时必须同步更新本文件：
- 权限模型、归属规则、限流策略
- API 路由或字段契约变化
- 核心流程（创建/分析/导出/删除）行为变化
- 项目运行/构建命令变化

建议在改动 PR/提交说明中注明：`[AGENTS updated]`。
