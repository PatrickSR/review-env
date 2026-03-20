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

echo "cloning" > "$STATUS_FILE"

# Configure git credentials
git config --global user.name "\$GIT_USER_NAME"
git config --global user.email "\$GIT_USER_EMAIL"
git config --global credential.helper '!f() { echo "username=oauth2"; echo "password=\$GITLAB_PAT"; }; f'

# Shallow clone single branch
REPO_URL="\${GITLAB_URL}/\${PROJECT_PATH}.git"
if ! git clone --depth 1 --single-branch -b "\$BRANCH" "\$REPO_URL" /workspace 2>&1; then
  echo "error: clone failed" > "\$STATUS_FILE"
  echo "Clone failed, starting ttyd for debugging"
  ttyd -p 7681 -w /workspace /bin/bash &
  exec sleep infinity
fi

cd /workspace

echo "ready" > "\$STATUS_FILE"
echo "Environment ready, starting ttyd"

ttyd -p 7681 -w /workspace /bin/bash &

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
    '# Install git and curl',
    'RUN apt-get update && apt-get install -y --no-install-recommends git curl && \\',
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
