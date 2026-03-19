## ADDED Requirements

### 需求:Turborepo Monorepo 结构
项目必须使用 Turborepo 管理 monorepo，包含 `packages/server` 和 `packages/web` 两个包。

#### 场景:项目结构
- **当** 查看项目根目录
- **那么** 必须包含 `turbo.json`、根 `package.json`（workspaces 配置）、`packages/server/` 和 `packages/web/` 目录

#### 场景:构建命令
- **当** 在根目录执行 `npx turbo build`
- **那么** 必须按依赖顺序构建 server 和 web 两个包

#### 场景:开发命令
- **当** 在根目录执行 `npx turbo dev`
- **那么** 必须同时启动 server 和 web 的开发模式

### 需求:Server 包结构
`packages/server` 必须包含现有后端代码（迁移自根目录 src/），以及新增的数据库和 API 模块。

#### 场景:Server 包独立运行
- **当** 在 `packages/server` 目录执行启动命令
- **那么** Express 服务必须正常启动，包括 Webhook、终端、API 路由和 ttyd 代理

### 需求:Web 包结构
`packages/web` 必须是一个 React + Vite + shadcn 项目，构建产物供 server 包托管。

#### 场景:Web 包构建
- **当** 在 `packages/web` 目录执行 `npm run build`
- **那么** 必须在 `dist/` 目录生成 SPA 静态文件

#### 场景:Server 托管 Web 构建产物
- **当** server 启动且 web 包已构建
- **那么** server 必须将 `/admin/*` 请求指向 web 包的 `dist/` 目录

### 需求:Docker 构建适配
Dockerfile 必须适配 monorepo 结构，正确构建 server 和 web 两个包。

#### 场景:Docker 镜像构建
- **当** 执行 `docker build`
- **那么** 必须先构建 web 包生成静态文件，再构建 server 包，最终镜像包含 server 运行时和 web 静态文件

#### 场景:数据卷挂载
- **当** 使用 docker-compose 启动服务
- **那么** 必须挂载 `data/` 目录用于 SQLite 数据库持久化
