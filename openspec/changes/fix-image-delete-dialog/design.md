## 上下文

项目详情页（`ProjectDetail.tsx`）中，镜像配置的删除功能使用了 `AlertDialog` 嵌套在 `DropdownMenuContent` 内部的模式。这在 `@base-ui/react` 中会导致冲突：DropdownMenu 关闭时卸载 Portal 内容，AlertDialog 还未挂载就被销毁。

同项目的 `Images.tsx` 页面已经使用了正确的"状态提升"模式（`deleteTarget` state），可以作为参考。

## 目标 / 非目标

**目标：**
- 修复项目详情页镜像配置删除确认弹窗无法弹出的问题
- 对齐 `Images.tsx` 中已有的正确实现模式

**非目标：**
- 不修改后端 API
- 不修改 AlertDialog 或 DropdownMenu 组件本身
- 不重构其他页面

## 决策

**状态提升模式**：将 AlertDialog 从 DropdownMenuContent 中提取出来，通过 `deleteTarget` state 控制。

理由：
- `Images.tsx` 已经使用此模式且工作正常
- 彻底避免 DropdownMenu Portal 卸载导致的生命周期冲突
- 替代方案（阻止 DropdownMenu 关闭）在 `@base-ui/react` 中不可靠

具体做法：
1. 在 `ProjectDetail` 组件中添加 `deleteTarget` state（类型为 `ProjectImage | null`）
2. DropdownMenuItem "删除" 的 onClick 设置 `deleteTarget` 为当前行数据
3. AlertDialog 独立渲染在表格外部，`open` 绑定 `deleteTarget !== null`
4. 确认删除后调用 `deleteImage(deleteTarget.id)` 并清空 `deleteTarget`

## 风险 / 权衡

无显著风险。这是一个局部 UI 重构，只涉及一个文件中的渲染逻辑调整。
