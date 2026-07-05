const express = require("express");
const router = express.Router();
const {
  exchangeCodeForToken,
  getAuthenticatedUser,
} = require("../services/github.service");

const {
  createOrUpdateUser,
  getUserById,
  updateSlackWebhookUrl,
} = require("../services/user.service");
const { generateToken } = require("../services/jwt.service");
const { sendSlackMessage } = require("../services/slack.service");
const authMiddleware = require("../middlewares/auth.middleware");

const clientID = process.env.GITHUB_CLIENT_ID;
const githubRedirectUrl = process.env.GITHUB_CALLBACK_URL;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

// Frontend and backend are served from the same origin, so the cookie is
// first-party — SameSite=Lax is enough. Secure over HTTPS in production.
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
};

router.get("/github", (req, res) => {
  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: githubRedirectUrl,
    scope: "repo",
  });

  const url = `https://github.com/login/oauth/authorize?${params}`;

  if (clientID && githubRedirectUrl) {
    res.redirect(url);
  } else {
    res.status(400).send("Missing ID or URL");
  }
});

router.get("/github/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({
      message: "Missing authorization code",
    });
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const userData = await getAuthenticatedUser(accessToken);
    const user = await createOrUpdateUser(userData, accessToken);

    const jwt = generateToken(user);

    res.cookie("token", jwt, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.redirect(clientUrl);
  } catch (error) {
    return res.status(500).json({
      message: `${error.response?.status || error.response?.data || error.message || "GitHub authentication failed"} `,
    });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.sub);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      slackWebhookUrl: user.slackWebhookUrl,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to get current user",
    });
  }
});

router.patch("/me", authMiddleware, async (req, res) => {
  try {
    const { slackWebhookUrl } = req.body;

    // Allow clearing (empty/null), else require a real Slack webhook URL so we
    // never post to an arbitrary host.
    const value =
      slackWebhookUrl === undefined || slackWebhookUrl === ""
        ? null
        : slackWebhookUrl;

    if (value !== null && !value.startsWith("https://hooks.slack.com/")) {
      return res.status(400).json({
        message:
          "slackWebhookUrl must be a Slack Incoming Webhook (https://hooks.slack.com/...)",
      });
    }

    // Verify the webhook actually works before saving it — a test message must
    // reach Slack, otherwise rules would silently fail later.
    if (value !== null) {
      try {
        await sendSlackMessage(
          "✅ GitHub Automation connected to this channel.",
          value,
        );
      } catch (slackError) {
        return res.status(400).json({
          message: `Could not reach that Slack webhook: ${slackError.message}`,
        });
      }
    }

    const user = await updateSlackWebhookUrl(req.user.sub, value);

    return res.json({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      slackWebhookUrl: user.slackWebhookUrl,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update settings",
    });
  }
});

router.post("/logout", (req, res) => {
  // Attributes must match those used when setting the cookie, or it won't clear.
  res.clearCookie("token", cookieOptions);

  return res.json({
    message: "Logged out successfully",
  });
});

module.exports = router;
