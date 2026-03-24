import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { getDb } from "./db/index.js";
import { dockerManager } from "./services/docker-manager.js";
import { webhookRouter } from "./routes/webhook.js";
import { terminalRouter } from "./routes/terminal.js";
import { apiRouter } from "./routes/api.js";
import { dockerRouter } from "./routes/docker.js";

import { createLogger } from "./utils/logger.js";

const log = createLogger("server");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Initialize database
getDb();
log.info("Database initialized");

// Webhook needs raw JSON body
app.use("/webhook", express.json());

// API routes need JSON body
app.use("/api", express.json());
app.use("/api/docker", express.json());

// Routes
app.use(webhookRouter);
app.use(terminalRouter);
app.use("/api", apiRouter);

app.use("/api/docker", dockerRouter);

// Serve SPA (根路径，放在所有 API 路由之后)
const webDistPath = path.join(__dirname, "../../web/dist");
app.use(express.static(webDistPath));
// SPA fallback：非 API/webhook/public 路径都返回 index.html
app.get("*", (req, res, next) => {
  // 跳过 API、webhook、public 等后端路由
  if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) {
    next();
    return;
  }
  res.sendFile(path.join(webDistPath, "index.html"));
});

// Recover state from database + Docker
try {
  await dockerManager.recoverState();
} catch (err) {
  log.error("Failed to recover Docker state (Docker may not be available)", err);
}

// Periodic cleanup (every 60s)
setInterval(() => dockerManager.cleanupExpired(), 60_000);

app.listen(config.port, () => {
  log.info(`Review Service running on http://localhost:${config.port}`);
});
