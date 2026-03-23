## 1. 修复镜像删除确认弹窗

- [x] 1.1 在 ProjectDetail 组件中添加 `deleteTarget` state（`ProjectImage | null`），将 AlertDialog 从 DropdownMenuContent 中提取出来，改为独立渲染在镜像配置 Card 外部，通过 `deleteTarget` 控制 open 状态
- [x] 1.2 修改 imageColumns 中"删除"菜单项，移除嵌套的 AlertDialog，改为 onClick 设置 `deleteTarget`
- [x] 1.3 验证删除流程：点击操作 → 点击删除 → AlertDialog 弹出 → 确认删除 → 镜像从列表中移除
