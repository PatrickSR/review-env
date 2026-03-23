## 为什么

当前终端页面（`/mr/:projectId/:mrIid`）是一个独立的纯 HTML 页面，与 React SPA 管理后台完全割裂。用户在终端页面无法看到项目导航、端口映射、MR 信息等上下文，体验碎片化。需要将终端页面整合进 React SPA，统一导航体验，并提供丰富的上下文信息面板。

## 变更内容

- 移除 `/admin` 路径前缀，SPA 直接挂载在根路径
- 将终端页面从独立 HTML 迁移为 React 组件，纳入 SPA 路由
- 升级侧栏导航：上半部分按项目分组展示 MR 列表（懒加载 GitLab API），下半部分保留全局管理导航
- 新增终端页右侧可收起信息面板（端口映射、项目信息、MR 信息）
- 新增后端 API：获取项目的 open MR 列表、验证 MR 状态
- **BREAKING**：`/admin/*` 路径不再可用，所有页面迁移到根路径

## 非目标

- 不涉及权限/认证系统（所有用户看到相同内容）
- 不改变 ttyd 直连机制（仍通过 iframe 连接宿主机端口）
- 不改变容器生命周期管理逻辑
- 不改变 Webhook 处理逻辑

## 功能 (Capabilities)

### 新增功能
- `terminal-page`: 终端页面 React 组件，包含镜像选择、容器状态轮询、ttyd iframe 嵌入、右侧可收起信息面板
- `sidebar-navigation`: 升级版侧栏导航，项目+MR 树形结构 + 全局管理导航
- `gitlab-mr-api`: 后端 GitLab MR 列表 API 及 MR 状态验证

### 修改功能
- `admin-spa`: 移除 `/admin` 前缀，SPA 挂载到根路径，路由结构调整
- `review-service`: 终端路由不再返回 HTML，改为 SPA fallback；新增 MR 列表和验证端点

## 影响

- `packages/server/src/server.ts` — SPA 静态文件服务路径变更，移除 `/admin` 挂载
- `packages/server/src/routes/terminal.ts` — 移除 HTML 页面返回，保留 API 端点
- `packages/server/src/routes/api.ts` — 新增 MR 列表端点
- `packages/server/src/services/gitlab-api.ts` — 新增 listOpenMrs 方法
- `packages/server/public/terminal.html` — 废弃
- `packages/web/src/App.tsx` — 路由重构，新增终端页路由
- `packages/web/src/Layout.tsx` — 适配新侧栏
- `packages/web/src/components/app-sidebar.tsx` — 重写为项目+MR 树形导航
- `docker-compose.yml` / Nginx 配置 — 如有 `/admin` 相关代理规则需更新
