## 上下文

当前系统有两个独立的前端入口：
1. `/admin/*` — React SPA 管理后台（项目管理、镜像管理、容器监控）
2. `/mr/:projectId/:mrIid` — 独立 HTML 页面（终端访问）

两者完全割裂，终端页面无导航、无上下文信息。本设计将两者合并为统一的 SPA。

## 目标 / 非目标

**目标：**
- 将终端页面整合进 React SPA，共享布局和组件
- 移除 `/admin` 前缀，SPA 直接挂载在根路径
- 侧栏升级为项目+MR 树形导航 + 全局管理导航
- 终端页新增可收起的右侧信息面板
- 新增后端 API 支持 MR 列表获取和状态验证

**非目标：**
- 不引入权限/认证系统
- 不改变 ttyd 直连机制
- 不改变容器生命周期逻辑

## 决策

### 决策 1：SPA 路由策略 — 移除 /admin 前缀

**选择**：移除 `/admin` 前缀，所有页面直接挂载在根路径。

**替代方案**：
- A) 保留 `/admin`，终端页也放在 `/admin/mr/...` 下 — 需要修改 GitLab 评论中的链接
- B) 双路径：`/admin/*` 和 `/mr/*` 都 serve SPA — 增加复杂度

**理由**：根路径更简洁，`/mr/:projectId/:mrIid` 保持不变，GitLab 评论链接无需修改。

**影响 (packages/server)**：
- `server.ts` 中 SPA 静态文件从 `/admin` 改为根路径
- SPA fallback 必须放在所有 API/Webhook 路由之后
- 需要排除 `/api/*`、`/webhook/*`、`/public/*` 等路径

### 决策 2：侧栏导航结构 — 项目+MR 树 + 全局导航

**选择**：侧栏分为两个区域，上方为项目树（可展开显示 MR 列表），下方为全局管理导航。

**数据加载策略**：
- 页面加载时：`GET /api/projects` + `GET /api/containers` — 本地数据，零 GitLab 调用
- 展开项目时：`GET /api/projects/:id/mrs` — 首次展开触发 GitLab API，结果缓存
- 刷新按钮（hover 项目名时出现）：清除缓存，重新请求 GitLab API
- 收起再展开：使用缓存，不重新请求

**MR 列表合并逻辑**：
- GitLab API 返回 open 状态的 MR 列表
- 前端与 containers 数据 join，有容器的 MR 标记为活跃（🟢）
- 列表按状态排序：活跃 MR 在前，无容器 MR 在后

### 决策 3：终端页面架构 — React 组件 + iframe

**选择**：终端页面作为 React 组件，ttyd 仍通过 iframe 嵌入。

**替代方案**：
- 直接集成 xterm.js + WebSocket — 需要大量改造 ttyd 通信协议，收益不大

**理由**：iframe 方案已验证可靠，改动最小。React 组件负责状态管理和 UI 包裹。

**终端页面状态机**：
```
  URL 进入 /mr/:projectId/:mrIid
       │
       ▼
  验证 MR 状态（GitLab API）
       │
       ├── MR 不存在/已关闭 → 显示错误提示
       │
       ▼
  查询容器状态（/mr/:pid/:mrid/status）
       │
       ├── 有容器 → 轮询直到 ready → 显示终端 iframe
       │
       └── 无容器 → 显示镜像选择 → 用户选择 → 启动 → 轮询 → 终端
```

### 决策 4：右侧信息面板 — 默认收起，hover/点击展开

**选择**：右侧面板默认收起为一个窄条（约 40px），hover 或点击时展开（约 280px）。

**内容**：
- 端口映射表（容器端口 → 宿主机端口，可点击跳转）
- 项目信息（名称、GitLab 链接）
- MR 信息（编号、标题、分支、作者）
- 操作按钮（停止容器、切换镜像）

**实现**：使用 CSS transition 实现展开/收起动画，面板状态存储在组件 state 中。

### 决策 5：新增后端 API

**影响 (packages/server)**：

#### `GET /api/projects/:id/mrs`
获取项目的 open MR 列表，后端调用 GitLab API。

请求：无参数
响应：
```json
[
  {
    "iid": 23,
    "title": "feat: add login",
    "source_branch": "feat/login",
    "author": "username",
    "web_url": "https://gitlab.com/...",
    "has_container": true
  }
]
```

后端逻辑：
1. 调用 GitLab `GET /api/v4/projects/:id/merge_requests?state=opened`
2. 查询 containers 表，标记哪些 MR 有活跃容器
3. 返回合并结果

#### `GET /api/projects/:id/mrs/:mrIid/validate`
验证 MR 是否存在且为 open 状态。终端页面加载时调用。

请求：无参数
响应：
```json
{ "valid": true, "title": "feat: add login", "source_branch": "feat/login" }
// 或
{ "valid": false, "reason": "MR 已关闭或不存在" }
```

## 风险 / 权衡

- **GitLab API 速率限制** → 缓解：前端缓存 MR 列表，仅展开/刷新时请求；后端可考虑短期缓存（未来优化）
- **SPA fallback 路由冲突** → 缓解：fallback 放在所有 API 路由之后，使用明确的排除规则
- **iframe 跨域问题** → 无风险：ttyd 在同一 hostname 不同端口，不涉及跨域
- **`/admin` 路径移除是破坏性变更** → 缓解：如有外部书签/链接指向 `/admin/*`，可临时加 redirect（非本次范围）
