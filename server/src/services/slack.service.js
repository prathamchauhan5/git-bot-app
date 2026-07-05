const axios = require("axios");

// Posts a message to a Slack Incoming Webhook. Uses the per-user webhook URL
// when provided, falling back to the global SLACK_WEBHOOK_URL env var.
const sendSlackMessage = async (text, webhookUrl) => {
  const url = webhookUrl || process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    throw new Error(
      "Slack is not configured — set your Slack webhook URL in settings",
    );
  }

  try {
    await axios.post(url, { text });
  } catch (error) {
    throw new Error(
      `Failed to send Slack message: ${
        error.response?.data || error.message
      }`,
    );
  }
};

module.exports = {
  sendSlackMessage,
};
