import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function parseAppPorts(value: string): number[] {
  return value
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);
}

export const config = {
  // GitLab
  gitlabUrl: required("GITLAB_URL"),
  gitlabPat: required("GITLAB_PAT"),
  gitlabProjectId: required("GITLAB_PROJECT_ID"),
  gitlabProjectPath: required("GITLAB_PROJECT_PATH"),
  gitUserName: optional("GIT_USER_NAME", "review-bot"),
  gitUserEmail: optional("GIT_USER_EMAIL", "review-bot@company.com"),
  webhookSecret: required("WEBHOOK_SECRET"),

  // Service
  port: Number(optional("PORT", "3000")),
  maxContainers: Number(optional("MAX_CONTAINERS", "20")),
  containerTimeoutHours: Number(optional("CONTAINER_TIMEOUT_HOURS", "4")),

  // Container
  appPorts: parseAppPorts(optional("APP_PORTS", "7702")),
  reviewImage: optional("REVIEW_IMAGE", "review-env:latest"),
  containerCpuLimit: Number(optional("CONTAINER_CPU_LIMIT", "2")),
  containerMemoryLimit: optional("CONTAINER_MEMORY_LIMIT", "4g"),

  // Claude Code
  anthropicAuthToken: optional("ANTHROPIC_AUTH_TOKEN", ""),
  anthropicBaseUrl: optional("ANTHROPIC_BASE_URL", ""),
  anthropicModel: optional("ANTHROPIC_MODEL", ""),
} as const;
