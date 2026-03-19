## REMOVED Requirements

### 需求:评论命令解析
**Reason**: 容器生命周期改为完全由 Web 页面驱动，不再需要通过 GitLab 评论命令控制。
**Migration**: 用户通过浏览器访问 `/mr/:projectId/:mrIid` 页面启动和管理容器。

### 需求:MR 创建时自动提示
**Reason**: 提示内容需要更新为新的 URL 格式，且不再包含评论命令列表。此需求在 review-service 的修改规范中以新形式重新定义。
**Migration**: MR 创建时仍会发布评论，但只包含终端 URL 链接，不再列出 /review-* 命令。
