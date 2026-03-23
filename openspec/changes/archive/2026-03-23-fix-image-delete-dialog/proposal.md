## 为什么

在项目详情页面（`/admin/projects/:id`）中，点击镜像配置的"删除"按钮后，确认弹窗（AlertDialog）无法正常弹出。这是因为 `AlertDialog` 嵌套在 `DropdownMenu` 内部，当 DropdownMenu 关闭时，其 Portal 内容被卸载，导致 AlertDialog 还未挂载就被销毁。用户无法删除镜像配置，影响基本的管理操作。

## 变更内容

- 将 `AlertDialog` 从 `DropdownMenuContent` 中提取出来，改为通过 state 控制开关
- 在 `ProjectDetail` 组件中添加 `deleteTarget` 状态，用于记录待删除的镜像
- 点击"删除"菜单项时，设置 `deleteTarget` 并关闭下拉菜单，随后独立渲染 AlertDialog
- 对齐 `Images.tsx` 页面中已有的正确实现模式

## 功能 (Capabilities)

### 新增功能

（无）

### 修改功能

- `admin-spa`: 修复项目详情页镜像配置删除确认弹窗无法弹出的问题

## 影响

- `packages/web/src/pages/ProjectDetail.tsx`：重构镜像删除的 AlertDialog 渲染方式
