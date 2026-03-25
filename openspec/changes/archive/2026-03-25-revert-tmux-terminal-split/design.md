## 上下文

`tmux-terminal-split` 变更在 `image-templates.ts` 中引入了 tmux 集成：在 `ENTRYPOINT_SH` 中写入 `.tmux.conf` 配置文件，将 ttyd 启动命令从 `/bin/bash` 改为 `tmux new-session -A -s main`，并在 `generateDockerfile()` 的 apt-get install 中添加了 tmux。

该变更的代码改动混在 commit `7cb04cc`（feat(openspec): add github-actions-docker-publish）中，与 github-actions 的 openspec 产出物共享同一个 commit，无法通过 `git revert` 整体撤回。

影响范围仅限 `packages/server/src/services/image-templates.ts` 一个文件。

## 目标 / 非目标

**目标：**
- 将 `image-templates.ts` 中的 tmux 相关代码全部还原为纯 bash 版本
- 归档 `tmux-terminal-split` 变更到 archive 目录
- 重新构建镜像并发布新版本

**非目标：**
- 不探索其他终端分屏替代方案（后续单独处理）
- 不修改 ttyd 代理或前端代码

## 决策

### D1: 手动还原代码而非 git revert

**选择**：手动修改 `image-templates.ts`，精确还原 4 处 tmux 相关改动。

**替代方案**：
- `git revert 7cb04cc`：会同时撤回 github-actions openspec 产出物，不可接受
- `git checkout ecbaebc -- packages/server/src/services/image-templates.ts`：会丢失 `ecbaebc` 之后的其他非 tmux 改动（如果有的话）

**理由**：tmux 改动集中在 4 处，手动还原最精确、风险最低。

### D2: 归档而非删除 tmux-terminal-split 变更

**选择**：将 `openspec/changes/tmux-terminal-split/` 移动到 `openspec/changes/archive/2026-03-25-tmux-terminal-split/`。

**理由**：保留决策历史，记录"尝试过 tmux 但体验不佳"这个经验，供后续探索终端分屏方案时参考。

## 风险 / 权衡

- **已部署的容器仍运行 tmux 版本** → 现有容器不受影响，新构建的镜像才会生效。用户需要重新构建镜像。
- **review-image 主规范无需更新** → `openspec/specs/review-image/spec.md` 中仍然是 `/bin/bash` 的描述（tmux 变更未同步到主规范），无需修改。
