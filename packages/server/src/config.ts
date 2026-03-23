import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

// Locate .env reliably: try cwd first, then relative to this file (packages/server/src/ -> root)
const __configDir = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__configDir, "../../../.env"),  // packages/server/src -> root
  path.resolve(process.cwd(), "../../.env"),
];
const envPath = candidates.find((p) => existsSync(p));
if (envPath) dotenv.config({ path: envPath });

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  // Global GitLab URL (single instance)
  gitlabUrl: optional("GITLAB_URL", "https://gitlab.internal"),

  // Service
  port: Number(optional("PORT", "3000")),
  maxContainers: Number(optional("MAX_CONTAINERS", "20")),
  containerTimeoutHours: Number(optional("CONTAINER_TIMEOUT_HOURS", "4")),

  // Container resource limits
  containerCpuLimit: Number(optional("CONTAINER_CPU_LIMIT", "2")),
  containerMemoryLimit: optional("CONTAINER_MEMORY_LIMIT", "4g"),

  // Docker host IP for port-mapped proxy (use host.docker.internal when running in container)
  dockerHostIp: optional("DOCKER_HOST_IP", "127.0.0.1"),

  // Test container timeout
  testContainerTimeoutMinutes: Number(optional("TEST_CONTAINER_TIMEOUT_MINUTES", "30")),
} as const;
