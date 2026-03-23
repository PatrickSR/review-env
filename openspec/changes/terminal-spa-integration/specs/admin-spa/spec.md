## MODIFIED Requirements

### 需求:SPA 管理界面框架
系统必须提供基于 React + shadcn/ui 的 SPA 管理界面，直接挂载在根路径。Express 必须托管 SPA 的静态文件并支持客户端路由 fallback。SPA 同时承载管理页面和终端页面。

#### 场景:访问管理界面
- **当** 用户访问 `/` 或任何前端路由
- **那么** 系统必须返回 SPA 的 index.html，由前端路由处理页面渲染
- **并且** `/api/*`、`/webhook/*`、`/public/*` 路径必须由后端 API 处理，不被 SPA fallback 拦截

#### 场景:SPA 静态资源
- **当** 浏览器请求 `/assets/*`
- **那么** 系统必须返回对应的 JS/CSS/图片等静态文件

#### 场景:终端页面路由
- **当** 用户访问 `/mr/:projectId/:mrIid`
- **那么** SPA 必须渲染终端页面组件，共享 Layout 和侧栏导航

### 需求:shadcn/ui 组件规范
管理界面必须严格使用 shadcn/ui 组件库，基于 dashboard-01 block 模板构建，禁止手写替代组件。

#### 场景:组件使用约束
- **当** 开发管理界面的任何 UI 元素时
- **那么** 必须优先使用 shadcn/ui 提供的组件（Button、Input、Label、Card、Table、Badge、AlertDialog、Drawer、DropdownMenu、Select、Tabs、Separator、Checkbox 等）
- **并且** 禁止使用原生 HTML 元素 + Tailwind class 手写替代已有的 shadcn 组件
- **并且** 禁止使用 `window.confirm()` / `window.alert()`，必须使用 AlertDialog

#### 场景:布局框架
- **当** 用户访问任何页面
- **那么** 页面必须使用 dashboard-01 的 Sidebar 布局（SidebarProvider + AppSidebar + SidebarInset + SiteHeader）
- **并且** 侧边栏上半部分为项目+MR 树形导航，下半部分为全局管理导航
- **并且** 导航使用 React Router 进行客户端路由
