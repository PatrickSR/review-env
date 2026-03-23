## MODIFIED Requirements

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
