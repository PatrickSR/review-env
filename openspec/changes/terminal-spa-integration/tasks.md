## 1. 后端：GitLab MR API

- [x] 1.1 在 `gitlab-api.ts` 中新增 `listOpenMrs` 方法，调用 GitLab REST API 获取 open 状态的 MR 列表（iid、title、source_branch、author.username、web_url）
- [x] 1.2 在 `api.ts` 中新增 `GET /api/projects/:id/mrs` 端点，调用 `listOpenMrs` 并与 containers 表 join，返回带 `has_container` 标记的 MR 列表
- [x] 1.3 在 `api.ts` 中新增 `GET /api/projects/:id/mrs/:mrIid/validate` 端点，调用 `getMrInfo` 验证 MR 状态，返回 valid/invalid 结果

## 2. 后端：SPA 路由迁移

- [x] 2.1 修改 `server.ts`，移除 `/admin` 路径挂载，将 SPA 静态文件服务和 fallback 改为根路径（确保放在所有 API 路由之后）
- [x] 2.2 修改 `terminal.ts`，移除 `GET /mr/:projectId/:mrIid` 的 HTML 页面返回（保留 status/start/stop/images 等 API 端点）

## 3. 前端：路由与布局重构

- [x] 3.1 修改 `vite.config.ts` 中的 `base` 配置，从 `/admin/` 改为 `/`
- [x] 3.2 修改 `App.tsx` 路由，移除 `/admin` 前缀（`/` → Dashboard，`/projects` → ProjectList 等），新增 `/mr/:projectId/:mrIid` 路由指向 Terminal 页面组件

## 4. 前端：侧栏导航升级

- [x] 4.1 重写 `app-sidebar.tsx`，上半部分渲染项目列表（折叠/展开），下半部分保留全局导航（首页、项目、镜像、容器），中间用分隔线分开
- [x] 4.2 实现项目展开逻辑：展开时调用 `GET /api/projects/:id/mrs` 获取 MR 列表，与 containers 数据 join 标记活跃状态，结果缓存；收起再展开用缓存
- [x] 4.3 实现 hover 项目名时显示刷新按钮，点击刷新清除缓存并重新请求 GitLab API
- [x] 4.4 实现 MR 项点击导航到 `/mr/:gitlabProjectId/:mrIid`，当前路由对应的项目和 MR 高亮显示

## 5. 前端：终端页面组件

- [x] 5.1 创建 `Terminal.tsx` 页面组件，实现 MR 验证流程（调用 validate API，无效时显示错误提示）
- [x] 5.2 实现镜像选择界面（无容器时显示镜像卡片列表，点击启动容器）
- [x] 5.3 实现容器状态轮询和 ttyd iframe 嵌入（轮询 status API，ready 后渲染 iframe）
- [x] 5.4 实现右侧可收起信息面板组件（默认收起，hover/点击展开，含端口映射、项目信息、MR 信息、操作按钮）

## 6. 清理

- [x] 6.1 废弃 `packages/server/public/terminal.html`（可保留文件但不再使用）
- [x] 6.2 验证所有现有管理页面在新路由下正常工作（Dashboard、ProjectList、ProjectDetail、Images、ImageBuild、Containers）
