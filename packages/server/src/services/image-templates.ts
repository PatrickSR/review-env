/**
 * Dockerfile template system for building review images.
 * Templates are composed from: AI tool + runtime environment.
 */

export interface TemplateConfig {
  tool: string;
  runtime: string;
}

export interface TemplateInfo {
  tool: string;
  toolLabel: string;
  runtime: string;
  runtimeLabel: string;
  baseImage: string;
}

const ENTRYPOINT_SH = `#!/bin/bash
set -e

STATUS_FILE="/tmp/review-status"

# 写入 tmux 配置（对新手友好）
cat > /root/.tmux.conf << 'TMUX_CONF'
# 鼠标支持：点击切 pane、拖拽调大小、滚轮翻页
set -g mouse on

# 256 色支持
set -g default-terminal "screen-256color"

# scrollback buffer
set -g history-limit 10000

# 直觉分屏快捷键：| 竖分，- 横分
bind | split-window -h -c "#{pane_current_path}"
bind - split-window -v -c "#{pane_current_path}"

# 状态栏快捷键提示
set -g status-style "bg=colour235,fg=colour248"
set -g status-left "[#S] "
set -g status-right " Ctrl+B |:竖分 -:横分 "
set -g status-right-length 40

# 当前 pane 边框高亮
set -g pane-active-border-style "fg=colour39"
TMUX_CONF

echo "cloning" > "\$STATUS_FILE"

# Configure git credentials
git config --global user.name "\$GIT_USER_NAME"
git config --global user.email "\$GIT_USER_EMAIL"
git config --global credential.helper '!f() { echo "username=oauth2"; echo "password=\$GITLAB_PAT"; }; f'

# Shallow clone single branch
REPO_URL="\${GITLAB_URL}/\${PROJECT_PATH}.git"
if ! git clone --single-branch -b "\$BRANCH" "\$REPO_URL" /workspace 2>&1; then
  echo "error: clone failed" > "\$STATUS_FILE"
  echo "Clone failed, starting ttyd for debugging"
  ttyd -W -p 7681 -w /workspace tmux new-session -A -s main &
  exec sleep infinity
fi

cd /workspace

echo "ready" > "\$STATUS_FILE"
echo "Environment ready, starting ttyd"

ttyd -W -p 7681 -w /workspace tmux new-session -A -s main &

exec sleep infinity
`;

const TOOLS: Record<string, { label: string; install: string }> = {
  "claude-code": {
    label: "Claude Code",
    install: 'RUN npm install -g @anthropic-ai/claude-code',
  },
};

const RUNTIMES: Record<string, { label: string; baseImage: string; extraInstall: string }> = {
  node: {
    label: "Node",
    baseImage: "node:22",
    extraInstall: "",
  },
  python: {
    label: "Python",
    baseImage: "python:3.12",
    extraInstall: [
      '# Install Node.js (required for Claude Code)',
      'RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \\',
      '    apt-get install -y nodejs && \\',
      '    rm -rf /var/lib/apt/lists/*',
    ].join("\n"),
  },
};

export function getAvailableTemplates(): TemplateInfo[] {
  const result: TemplateInfo[] = [];
  for (const [toolKey, tool] of Object.entries(TOOLS)) {
    for (const [rtKey, rt] of Object.entries(RUNTIMES)) {
      result.push({
        tool: toolKey,
        toolLabel: tool.label,
        runtime: rtKey,
        runtimeLabel: rt.label,
        baseImage: rt.baseImage,
      });
    }
  }
  return result;
}

export function isValidTemplate(tool: string, runtime: string): boolean {
  return tool in TOOLS && runtime in RUNTIMES;
}

export function generateDockerfile(tool: string, runtime: string): string {
  const toolConfig = TOOLS[tool];
  const rtConfig = RUNTIMES[runtime];
  if (!toolConfig || !rtConfig) {
    throw new Error(`Invalid template: tool=${tool}, runtime=${runtime}`);
  }

  const lines: string[] = [
    `FROM ${rtConfig.baseImage}`,
    '',
    'LABEL managed-by=review-service',
    '',
    '# Install git, curl and tmux',
    'RUN apt-get update && apt-get install -y --no-install-recommends git curl tmux && \\',
    '    rm -rf /var/lib/apt/lists/*',
    '',
    '# Install ttyd',
    'RUN curl -fSL https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.aarch64 \\',
    '    -o /usr/local/bin/ttyd && \\',
    '    chmod +x /usr/local/bin/ttyd',
  ];

  // Runtime-specific extra install (e.g., Node for Python)
  if (rtConfig.extraInstall) {
    lines.push('', rtConfig.extraInstall);
  }

  // Tool install
  lines.push('', toolConfig.install);

  // Entrypoint
  lines.push(
    '',
    'COPY entrypoint.sh /entrypoint.sh',
    'RUN chmod +x /entrypoint.sh',
    '',
    'WORKDIR /workspace',
    '',
    'ENTRYPOINT ["/entrypoint.sh"]',
    '',
  );

  return lines.join('\n');
}

export function getEntrypointScript(): string {
  return ENTRYPOINT_SH;
}
