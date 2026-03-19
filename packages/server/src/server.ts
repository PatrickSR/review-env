import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { getDb } from "./db/index.js";
import { dockerManager } from "./services/docker-manager.js";
import { webhookRouter } from "./routes/webhook.js";
import { terminalRouter } from "./routes/terminal.js";
import { apiRouter } from "./routes/api.js";
import { setupTtydProxy } from "./proxy/ttyd-proxy.js";
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

// Routes
app.use(webhookRouter);
app.use(terminalRouter);
app.use("/api", apiRouter);

// Static files (terminal.html)
app.use("/public", express.static(path.join(__dirname, "../public")));

// Serve admin SPA
const webDistPath = path.join(__dirname, "../../web/dist");
app.use("/admin", express.static(webDistPath));
app.get("/admin/*", (_req, res) => {
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

const server = app.listen(config.port, () => {
  log.info(`Review Service running on http://localhost:${config.port}`);
});

// Setup proxies (needs server instance for WebSocket upgrade)
setupTtydProxy(app, server);
