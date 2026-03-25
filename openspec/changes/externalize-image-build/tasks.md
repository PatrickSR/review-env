## 1. review-base 基础镜像

- [ ] 1.1 创建 `docker/entrypoint.sh`：实现 clone → before_script → ttyd 启动流程，支持 BEFORE_SCRIPT 环境变量（base64 解码执行）、$SHELL 检测、失败时写 error 但 ttyd 照样启动
- [ ] 1.2 创建 `docker/Dockerfile.base`：基于 ubuntu:24.04，安装 git、curl、ttyd，COPY entrypoint.sh，设置 ENTRYPOINT

## 2. 后端：删除模板系统

- [ ] 2.1 删除 `packages/server/src/services/image-templates.ts` 文件
- [ ] 2.2 从 `packages/server/src/routes/docker.ts` 中删除 `GET /api/docker/templates` 端点和 image-templates 的 import

## 3. 后端：改造构建 API

- [ ] 3.1 改造 `POST /api/docker/build`：参数从 `{ tool, runtime, name, tag }` 改为 `{ dockerfile, name, tag }`，直接使用用户提供的 dockerfile 内容构建，createTarStream 只传入 Dockerfile

## 4. 后端：去掉 managed-by 限制

- [ ] 4.1 改造 `DELETE /api/docker/images/:id`：去掉 managed-by label 检查，所有镜像均可删除
- [ ] 4.2 改造 `GET /api/docker/images`：返回数据中去掉 managed 字段（或保留但不再用于权限控制）

## 5. 后端：before_script 支持

- [ ] 5.1 数据库迁移：`project_images` 表新增 `before_script TEXT DEFAULT ''` 列
- [ ] 5.2 修改 `packages/server/src/db/project-images.ts`：ProjectImage 接口和 CRUD 方法支持 before_script 字段
- [ ] 5.3 修改 `packages/server/src/services/docker-manager.ts` 的 `createContainer`：当 imageConfig.before_script 非空时，base64 编码后作为 BEFORE_SCRIPT 环境变量传入容器

## 6. 前端：改造构建页面

- [ ] 6.1 改造 `packages/web/src/pages/ImageBuild.tsx`：去掉模板选择 UI（TOOLS/RUNTIMES 卡片），改为 Dockerfile textarea（monospace 字体），预填基于 review-base 的示例 Dockerfile
- [ ] 6.2 更新构建请求：提交时发送 `{ dockerfile, name, tag }` 而非 `{ tool, runtime, name, tag }`

## 7. 前端：改造镜像管理页面

- [ ] 7.1 修改 `packages/web/src/pages/Images.tsx`：去掉 managed badge，所有镜像操作菜单统一包含"测试运行"和"删除"

## 8. 前端：添加镜像弹窗新增 before_script

- [ ] 8.1 修改 `packages/web/src/pages/ProjectDetail.tsx` 的 ImageFormModal：form state 新增 before_script，新增 textarea（monospace 字体），底部提示"容器启动并 clone 代码后执行此脚本"
- [ ] 8.2 提交时将 before_script 作为字符串传给后端 API

## 9. CI：新增 review-base 构建 job

- [ ] 9.1 修改 `.github/workflows/docker-publish.yml`：新增 build-review-base job，使用 `docker/Dockerfile.base` 构建，推送到 `ghcr.io/patricksr/review-base`，与 review-env 并行，共享 tag 策略
