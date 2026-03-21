## 1. 后端 - Docker 镜像列表 API

- [x] 1.1 实现 `GET /api/docker/images` 接口，调用 `docker.listImages()` 返回宿主机镜像列表，过滤 dangling 镜像，附加 `managed` 字段（检查 `managed-by=review-service` Label）
- [x] 1.2 实现 `DELETE /api/docker/images/:id` 接口，校验镜像 Label 为 review 镜像后删除，外部镜像返回 403，被容器使用中返回 409

## 2. 后端 - Dockerfile 模板与构建 API

- [x] 2.1 实现 Dockerfile 模板系统，支持 Claude Code × Node 和 Claude Code × Python 两个组合，生成的 Dockerfile 包含 `LABEL managed-by=review-service`，entrypoint.sh 作为通用文件嵌入
- [x] 2.2 实现 `POST /api/docker/build` 接口，接收 tool、runtime、name、tag 参数，生成 Dockerfile 并调用 `docker.buildImage()`，通过 SSE 逐行推送构建日志

## 3. 后端 - 临时测试容器 API

- [x] 3.1 实现 `POST /api/docker/test` 接口，使用指定镜像创建临时容器（不传项目相关环境变量），容器加入 review-net 网络，内存追踪不记录到 containers 表
- [x] 3.2 实现 `DELETE /api/docker/test/:containerId` 接口，停止并删除测试容器
- [x] 3.3 实现测试容器 30 分钟自动超时清理逻辑

## 4. 前端 - 镜像管理页面

- [x] 4.1 创建 `/admin/images` 页面，使用 DataTable 展示镜像列表（名称、Tag、大小、创建时间、managed 标识、操作菜单）
- [x] 4.2 实现 review 镜像的删除功能（AlertDialog 确认）
- [x] 4.3 实现"测试运行"功能，启动测试容器后在页面内嵌 iframe 展示 ttyd 终端，提供"停止并关闭"按钮
- [x] 4.4 在侧边栏导航中添加"镜像管理"入口，路由指向 `/admin/images`

## 5. 前端 - 镜像构建页面

- [x] 5.1 创建镜像构建页面（从镜像管理页面的"构建新镜像"按钮进入），展示 AI 工具选择卡片（Claude Code）和运行环境选择卡片（Node / Python）
- [x] 5.2 实现镜像名称和 Tag 输入，根据选择自动生成默认名称
- [x] 5.3 实现构建日志面板，通过 SSE 接收并实时滚动展示 Docker 构建输出，构建完成后显示成功/失败提示

## 6. 前端 - 添加镜像表单改造

- [x] 6.1 将项目详情页 AddImageDrawer 中的 image 输入框改为下拉选择组件，数据源为 `GET /api/docker/images`，支持搜索过滤
- [x] 6.2 将 env_vars JSON 输入框改为 key-value 表格组件，每行包含变量名、值和删除按钮，底部提供"添加变量"按钮，提交时序列化为 JSON 字符串
