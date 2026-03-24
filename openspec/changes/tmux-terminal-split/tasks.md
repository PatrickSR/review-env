## 1. Dockerfile 模板修改

- [ ] 1.1 在 `image-templates.ts` 的 `generateDockerfile()` 中，将 apt-get install 行追加 `tmux`（与 git、curl 同一行安装）

## 2. Entrypoint 脚本修改

- [ ] 2.1 在 `image-templates.ts` 的 `ENTRYPOINT_SH` 中，在启动 ttyd 之前写入 `/root/.tmux.conf` 配置文件，内容包括：鼠标支持（`set -g mouse on`）、直觉快捷键（`|` 竖分、`-` 横分）、状态栏快捷键提示、256 色支持、scrollback buffer 10000 行
- [ ] 2.2 将 ttyd 启动命令从 `ttyd -W -p 7681 -w /workspace /bin/bash &` 改为 `ttyd -W -p 7681 -w /workspace tmux new-session -A -s main &`
- [ ] 2.3 确保 clone 失败分支中的 ttyd 启动命令也同步修改为 tmux 版本

## 3. 验证

- [ ] 3.1 通过管理后台构建一个新镜像，确认 Dockerfile 中包含 tmux 安装步骤
- [ ] 3.2 启动容器后验证 tmux 会话正常工作：鼠标分屏、快捷键分屏、状态栏提示
- [ ] 3.3 刷新页面后验证自动 attach 到已有 tmux session，pane 布局和运行状态恢复
