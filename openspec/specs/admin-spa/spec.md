## 目的

定义 SPA 管理界面的组件规范、页面结构和功能，包括项目管理、镜像配置和容器监控。

## Requirements

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

### 需求:首页统计面板
管理界面首页必须展示全局统计信息，使用 dashboard-01 的 SectionCards 模式。

#### 场景:全局统计
- **当** 用户访问管理界面首页
- **那么** 页面必须使用 shadcn Card 组件展示统计卡片：活跃容器数、已配置项目数、最大容器限制
- **并且** 卡片样式与 dashboard-01 的 SectionCards 保持一致（含 Badge 趋势标签）

### 需求:项目管理页面
管理界面必须提供项目的增删改查功能，使用 DataTable 模式展示列表。

#### 场景:项目列表页
- **当** 用户访问 `/admin/projects`
- **那么** 页面必须使用 DataTable 组件展示所有已配置项目，列包含：项目名称、GitLab 项目路径、Project ID、操作

#### 场景:添加项目
- **当** 用户点击添加项目按钮
- **那么** 页面必须弹出 Drawer 表单，使用 shadcn Input + Label + Select + Button 组件
- **并且** 提交后调用 `POST /api/projects` 创建项目，成功后刷新列表

#### 场景:编辑项目
- **当** 用户点击某个项目进入详情
- **那么** 页面必须展示项目配置表单（Card 包裹），使用 shadcn 表单组件

#### 场景:删除项目
- **当** 用户点击删除
- **那么** 页面必须弹出 AlertDialog 确认，确认后调用 `DELETE /api/projects/:id`

### 需求:镜像配置页面
管理界面必须提供项目镜像的配置功能，作为项目详情的一部分。

#### 场景:查看项目镜像
- **当** 用户进入项目详情页
- **那么** 页面必须使用 DataTable 组件展示该项目已配置的所有镜像列表

#### 场景:添加镜像
- **当** 用户点击"添加镜像"
- **那么** 页面必须弹出 Drawer 表单（name、display_name、image、env_vars），使用 shadcn 表单组件

#### 场景:启用/禁用镜像
- **当** 用户切换镜像的启用状态
- **那么** 页面必须使用 Badge 或 Switch 组件展示状态，调用 API 更新 enabled 字段

#### 场景:删除镜像
- **当** 用户点击 DropdownMenu 中的"删除"菜单项
- **那么** 页面必须弹出独立的 AlertDialog 确认弹窗（不嵌套在 DropdownMenuContent 内部）
- **并且** AlertDialog 必须通过组件 state 控制开关，禁止嵌套在 DropdownMenu 的 Portal 内
- **并且** 确认后调用 `DELETE /api/projects/:id/images/:imageId` 删除镜像并刷新列表

### 需求:容器监控页面
管理界面必须提供运行中容器的查看和管理功能。

#### 场景:容器列表
- **当** 用户访问 `/admin/containers`
- **那么** 页面必须使用 DataTable 组件展示所有运行中的容器（包括正式容器和测试容器），列包含：类型标识、项目名称、MR 编号/用途、使用的镜像、运行时长、操作
- **并且** 正式容器的类型标识为"Review"，测试容器的类型标识为"测试"
- **并且** 测试容器的项目名称列显示为"-"，MR 编号列显示为"镜像测试"

#### 场景:手动停止容器
- **当** 用户点击某个容器的停止按钮
- **那么** 页面必须弹出 AlertDialog 确认，确认后根据容器类型调用对应的删除接口（正式容器调用 `DELETE /api/containers/:id`，测试容器调用 `DELETE /api/docker/test/:containerId`）
