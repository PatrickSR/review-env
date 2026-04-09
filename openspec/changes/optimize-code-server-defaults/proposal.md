## 为什么

review-base 镜像中的 code-server 使用默认配置，用户每次打开都会遇到多个烦人的弹窗和不合理的默认值：workspace trust 确认弹窗、扩展推荐通知、GitHub Copilot 内置功能、账号登录提示，以及浅色主题。这些都需要手动关闭，严重影响开箱即用体验。

## 变更内容

- 在 `docker/Dockerfile.base` 构建时预置 code-server 的 User settings.json，包含以下默认配置：
  - 深色主题（Default Dark Modern）
  - 禁用 workspace trust 机制（消除 "Do you trust the authors" 弹窗）
  - 禁用扩展推荐和自动更新通知
  - 禁用内置 GitHub Copilot / AI 功能
  - 禁用 GitHub 账号认证和 git 终端认证
  - 禁用遥测、欢迎页、更新通知等干扰项
- 修改 `docker/entrypoint.sh`，在 code-server 启动参数中添加 `--disable-extension` 标志禁用内置认证扩展

### 非目标

- 不预装任何第三方扩展（如 claude-sessions）
- 不修改 code-server 的安装方式或版本
- 不影响用户在容器内手动修改 settings.json 的能力

## 功能 (Capabilities)

### 新增功能

- `code-server-defaults`: review-base 镜像中 code-server 的默认配置预置，包括主题、信任机制、通知、AI 功能和认证的默认关闭

### 修改功能

- `review-image`: entrypoint 启动参数新增 --disable-extension 标志

## 影响

- `docker/Dockerfile.base` — 新增 settings.json 写入步骤
- `docker/entrypoint.sh` — code-server 启动命令新增参数
- 所有基于 review-base 的用户镜像重新构建后自动继承新默认值
