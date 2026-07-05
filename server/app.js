const express = require("express");
const app = express();
const path = require("path");
const cookieParser = require("cookie-parser");

const authRoutes = require("./src/routes/auth.routes");
const repositoryRoutes = require("./src/routes/repository.routes");
const ruleRoutes = require("./src/routes/rule.routes");
const webhookRoutes = require("./src/routes/webhook.routes");

app.use(
  express.json({
    // GitHub webhook payloads can be large (pushes with many commits, big PRs);
    // the 100kb default would reject them. Also stash the raw body so the
    // webhook route can verify GitHub's HMAC signature.
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(cookieParser());

// --- API routes ---
app.use("/webhooks", webhookRoutes);
app.use("/auth", authRoutes);
app.use("/repositories", repositoryRoutes);
app.use("/rules", ruleRoutes);

// --- Serve the built frontend from the same origin ---
// Same origin makes the auth cookie first-party, so it works in every browser
// with no CORS and no third-party-cookie problems.
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));

// SPA fallback: any non-API GET returns index.html. Skips gracefully in dev,
// where the frontend is served by Vite rather than this server.
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

module.exports = app;
