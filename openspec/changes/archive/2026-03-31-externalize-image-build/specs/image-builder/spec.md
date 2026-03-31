## REMOVED Requirements

### 需求:Dockerfile 模板系统
**Reason**: 模板系统被用户自定义 Dockerfile 构建取代，不再维护 AI 工具 × 运行环境的组合矩阵
**Migration**: 用户在 `/images/build` 页面直接编写 Dockerfile，基于 `review-base` 镜像扩展

### 需求:镜像构建 API
**Reason**: 原 API 接收 tool + runtime 参数并内部生成 Dockerfile，改为直接接收用户提供的 Dockerfile 内容
**Migration**: `POST /api/docker/build` 参数从 `{ tool, runtime, name, tag }` 改为 `{ dockerfile, name, tag }`，参见 `dockerfile-build` 规范

### 需求:镜像构建页面
**Reason**: 模板选择 UI（AI 工具卡片 + 运行环境卡片）被 Dockerfile 编辑器取代
**Migration**: `/images/build` 页面改为 Dockerfile textarea + 镜像名称/Tag 输入，参见 `dockerfile-build` 规范
