# appshots 宝塔面板快速部署（Node + Nginx + PM2）

> 适用：Ubuntu/CentOS + 宝塔面板，目标是 10~20 分钟跑通一个可访问的生产实例。  
> 项目目录示例：`/www/wwwroot/appshots`

## 0. 部署结果

完成后你将得到：

- Web 站点：`https://你的域名`
- 后端 API：同域名下 `/api/*`
- 进程托管：PM2（宝塔 PM2 管理器）
- 数据落盘：SQLite + uploads（本地磁盘）

---

## 1. 宝塔环境准备

在宝塔「软件商店」安装：

- `Nginx`
- `Node.js 20+`
- `PM2 管理器`
- `Git`

服务器放行端口：

- `80`、`443`（公网）
- `3001` 可不放行（仅本机反代使用）

---

## 2. 拉取项目并安装依赖

```bash
mkdir -p /www/wwwroot
cd /www/wwwroot
git clone <你的仓库地址> appshots
cd appshots

pnpm install
```

> 如果服务器还没有 pnpm：`npm i -g pnpm`

---

## 3. 配置环境变量（重点）

```bash
cd /www/wwwroot/appshots
cp .env.example .env
```

编辑 `.env`，至少配置：

```env
OPENAI_API_KEY=你的Key
OPENAI_BASE_URL=https://codex-api.packycode.com/v1
OPENAI_MODEL=gpt-5.3

PORT=3001
DATABASE_URL=./data/appshots.db

JWT_SECRET=替换成强随机字符串
JWT_EXPIRES_IN=30d
ADMIN_KEY=替换成强随机字符串

# 邮箱验证码登录（生产环境必配）
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的发件邮箱
SMTP_PASS=你的SMTP授权码
MAIL_FROM_NAME=Appshots
MAIL_FROM_ADDRESS=你的发件邮箱
```

创建运行目录并授权（按你的运行用户调整，常见为 `www`）：

```bash
mkdir -p /www/wwwroot/appshots/data
mkdir -p /www/wwwroot/appshots/uploads/exports
chown -R www:www /www/wwwroot/appshots
```

---

## 4. 构建并启动服务

```bash
cd /www/wwwroot/appshots
pnpm build
```

在宝塔「PM2 管理器」新增项目：

- 启动文件：`server/dist/index.js`
- 运行目录：`/www/wwwroot/appshots`
- 解释器：`node`
- 进程名：`appshots`
- 环境变量：`NODE_ENV=production`

也可命令行启动：

```bash
cd /www/wwwroot/appshots
pm2 start server/dist/index.js --name appshots --cwd /www/wwwroot/appshots
pm2 save
pm2 startup
```

---

## 5. Nginx 反向代理（宝塔站点）

在宝塔新增站点（绑定你的域名），站点配置里将请求反代到 `127.0.0.1:3001`。

可参考如下 Nginx 配置片段：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 60m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

然后在宝塔里申请 SSL（Let’s Encrypt）并开启强制 HTTPS。

---

## 6. 验证部署

服务器本机自检：

```bash
curl http://127.0.0.1:3001/api/health
```

预期返回：

```json
{"status":"ok"}
```

浏览器访问：

- `https://你的域名/`
- 登录页可正常发送验证码
- 新建项目、上传截图、分析、导出链路正常

---

## 7. 更新发布（后续）

```bash
cd /www/wwwroot/appshots
git pull
pnpm install
pnpm build
pm2 restart appshots
```

---

## 8. 常见问题

### 8.1 登录后仍提示未登录

- 生产环境建议必须使用 `HTTPS`
- 检查域名是否走了 Nginx 反代，不要直接访问内网端口

### 8.2 验证码发送失败（550/邮箱不存在）

- 确认收件邮箱地址正确
- 检查 SMTP 服务商限制、授权码、发件频率
- 看 PM2 日志：`pm2 logs appshots`

### 8.3 `no such table: users`

- 检查你操作的是 `.env` 里 `DATABASE_URL` 指向的数据库文件
- 首次启动会自动初始化表，确保目录可写

### 8.4 上传/导出失败

- 检查磁盘权限：`data/`、`uploads/`、`uploads/exports/`
- 检查 Nginx 上传限制：`client_max_body_size`

---

## 9. 备份建议（最少）

至少备份以下目录：

- `data/`（SQLite 数据库）
- `uploads/`（原图与导出文件）

示例：

```bash
cd /www/wwwroot/appshots
tar -czf backup-$(date +%F).tar.gz data uploads
```

