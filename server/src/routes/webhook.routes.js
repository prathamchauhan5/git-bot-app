const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const {
  getRepositoriesByGithubId,
} = require("../services/repository.service");
const { getRulesByRepositoryIdAndEvent } = require("../services/rule.service");
const { getUserById } = require("../services/user.service");
const {
  evaluateRule,
  executeRule,
  describeTarget,
} = require("../services/rule-engine.service");
const { createExecution } = require("../services/rule-execution.service");

// Verifies GitHub's HMAC-SHA256 signature. Only enforced when
// GITHUB_WEBHOOK_SECRET is set, so local dev (e.g. via smee) works without it.
const hasValidSignature = (req) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }

  const signature = req.headers["x-hub-signature-256"];
  if (!signature || !req.rawBody) {
    return false;
  }

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");

  const received = Buffer.from(signature);
  const computed = Buffer.from(expected);

  return (
    received.length === computed.length &&
    crypto.timingSafeEqual(received, computed)
  );
};

router.post("/github", async (req, res) => {
  try {
    if (!hasValidSignature(req)) {
      return res.status(401).json({
        message: "Invalid signature",
      });
    }

    const payload = req.body;
    const githubEvent = req.headers["x-github-event"];

    let eventType = null;

    switch (githubEvent) {
      case "issues":
        if (payload.action === "opened") {
          eventType = "ISSUE_OPENED";
        }
        break;

      case "pull_request":
        if (payload.action === "opened") {
          eventType = "PULL_REQUEST_OPENED";
        }
        break;

      case "push":
        eventType = "PUSH";
        break;

      default:
        return res.status(200).json({
          message: "Unsupported GitHub event",
        });
    }

    if (!eventType) {
      return res.status(200).json({
        message: "Ignoring GitHub action",
      });
    }

    // The same GitHub repo can be connected by multiple users; process each
    // connected instance with its own owner's rules and access token.
    const repositories = await getRepositoriesByGithubId(payload.repository.id);

    if (repositories.length === 0) {
      return res.status(200).json({
        message: "Repository not connected",
      });
    }

    const { target, targetUrl } = describeTarget(eventType, payload);

    for (const repository of repositories) {
      const user = await getUserById(repository.userId);

      if (!user) {
        continue;
      }

      const rules = await getRulesByRepositoryIdAndEvent(
        repository.id,
        eventType,
      );

      for (const rule of rules) {
        if (!evaluateRule(rule, payload)) {
          continue;
        }

        // Record the outcome so users can see what each rule did (or why it
        // failed). No-op actions (executeRule returns false) aren't logged.
        try {
          const acted = await executeRule(
            rule,
            repository,
            payload,
            user.accessToken,
            user.slackWebhookUrl,
          );

          if (acted) {
            await createExecution({
              repositoryId: repository.id,
              ruleId: rule.id,
              event: eventType,
              target,
              targetUrl,
              actionType: rule.actionType,
              actionValue: rule.actionValue,
              status: "SUCCESS",
            });
          }
        } catch (actionError) {
          await createExecution({
            repositoryId: repository.id,
            ruleId: rule.id,
            event: eventType,
            target,
            targetUrl,
            actionType: rule.actionType,
            actionValue: rule.actionValue,
            status: "FAILED",
            error: actionError.message,
          });
        }
      }
    }

    return res.status(200).json({
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Webhook processing failed",
    });
  }
});

module.exports = router;
