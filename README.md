# Review Environment Service

MR 临时开发环境服务。Reviewer 通过 URL 即可进入已就绪的终端，查看 UI、交互追问、即时修改代码。

## 快速开始

```bash
# 安装依赖
bun install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际值

# 构建 review 镜像
docker build -t gzj-review-env:latest -f docker/Dockerfile docker/

# 启动服务
bun run start
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `GITLAB_URL` | GitLab 地址 | 必填 |
| `GITLAB_PAT` | GitLab Access Token | 必填 |
| `GITLAB_PROJECT_ID` | 项目 ID | 必填 |
| `WEBHOOK_SECRET` | Webhook 验证密钥 | 必填 |
| `GIT_USER_NAME` | 容器内 git 用户名 | review-bot |
| `GIT_USER_EMAIL` | 容器内 git 邮箱 | review-bot@company.com |
| `PORT` | 服务监听端口 | 3000 |
| `MAX_CONTAINERS` | 最大并发容器数 | 20 |
| `CONTAINER_TIMEOUT_HOURS` | 容器超时时间（小时） | 4 |
| `APP_PORT` | 容器内 dev server 端口 | 7702 |
| `PREVIEW_PORT_BASE` | Preview 端口池起始端口 | 9000 |
| `REVIEW_IMAGE` | Review 容器镜像名 | gzj-review-env:latest |

## GitLab Webhook 配置

1. 进入项目 Settings → Webhooks
2. URL: `http://<服务地址>:3000/webhook`
3. Secret Token: 与 `WEBHOOK_SECRET` 一致
4. Trigger: 勾选 Merge request events 和 Comments

## 使用方法

- 访问 `http://<服务地址>:3000/mr/<MR_IID>` 进入终端
- 访问 `http://<服务地址>:3000/mr/<MR_IID>/preview/` 预览应用
- MR 评论中使用命令：
  - `/review-start` — 启动环境
  - `/review-stop` — 停止环境
  - `/review-status` — 查看状态
