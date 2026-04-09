## 上下文

当前 review-base 镜像（`docker/Dockerfile.base`）安装 code-server 后未做任何默认配置。用户每次打开 code-server 都会遇到 workspace trust 弹窗、扩展推荐通知、Copilot 提示等干扰。entrypoint.sh 中 code-server 启动命令仅使用 `--auth none --disable-telemetry` 两个参数。

code-server 的用户设置存储在 `~/.local/share/code-server/User/settings.json`，在 Dockerfile 构建时写入此文件即可预置默认配置。

## 目标 / 非目标

**目标：**
- code-server 开箱即用，无需手动关闭任何弹窗或调整设置
- 深色主题作为默认外观
- 禁用所有不必要的通知和认证流程

**非目标：**
- 不修改 code-server 版本或安装方式
- 不预装第三方扩展
- 不阻止用户在容器内手动覆盖设置

## 决策

### 1. 配置注入方式：Dockerfile 构建时写入 settings.json

**影响 package**: docker/Dockerfile.base

在 Dockerfile 中使用 `RUN mkdir -p` + `COPY` 或内联写入，将预置的 settings.json 写入 `~/.local/share/code-server/User/settings.json`。

**替代方案**：在 entrypoint.sh 运行时动态生成。放弃原因：每次启动都执行不必要，且构建时写入更简洁、更可预测。

### 2. settings.json 内容

**影响 package**: docker/Dockerfile.base

预置以下配置项：

```json
{
  "workbench.colorTheme": "Default Dark Modern",
  "security.workspace.trust.enabled": false,
  "extensions.ignoreRecommendations": true,
  "extensions.autoCheckUpdates": false,
  "extensions.autoUpdate": false,
  "github.copilot.enable": { "*": false },
  "github.copilot.chat.enabled": false,
  "chat.commandCenter.enabled": false,
  "chat.disableAIFeatures": true,
  "git.githubAuthentication": false,
  "git.terminalAuthentication": false,
  "workbench.welcomePage.walkthroughs.openOnInstall": false,
  "workbench.startupEditor": "none",
  "update.showReleaseNotes": false,
  "telemetry.telemetryLevel": "off"
}
```

**替代方案**：仅配置部分项。放弃原因：一次性解决所有已知的体验问题，避免遗漏。

### 3. 禁用内置认证扩展：entrypoint 启动参数

**影响 package**: docker/entrypoint.sh

在 code-server 启动命令中添加 `--disable-extension vscode.github-authentication` 参数，从根源禁用 GitHub 账号登录功能。

**替代方案**：仅通过 settings.json 禁用。放弃原因：settings.json 只能禁用 git 认证行为，无法完全隐藏 Accounts 面板中的 GitHub 登录入口，需要从扩展层面禁用。

## 风险 / 权衡

- [用户覆盖] 用户在容器内修改 settings.json 后，下次重建镜像会恢复默认值 → 这是预期行为，容器本身是临时的
- [code-server 版本兼容] 部分设置项名称可能随 code-server 版本变化 → 使用的都是稳定的 VS Code 核心设置，风险低
- [Copilot 设置] code-server 使用 Open VSX 而非微软 marketplace，可能不包含 Copilot 扩展，但 VS Code 核心可能内置 AI 功能 → 同时使用 `github.copilot.*` 和 `chat.disableAIFeatures` 双重保险
