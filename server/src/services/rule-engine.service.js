const { addLabel } = require("./github.service");
const { sendSlackMessage } = require("./slack.service");

// Resolves the payload value a filter is matched against, based on filterField.
const getFilterValue = (filterField, payload) => {
  switch (filterField) {
    case "TITLE":
      return payload.issue?.title ?? payload.pull_request?.title ?? "";

    case "AUTHOR":
      return (
        payload.issue?.user?.login ?? payload.pull_request?.user?.login ?? ""
      );

    case "BRANCH":
      return payload.ref?.replace("refs/heads/", "") ?? "";

    default:
      return "";
  }
};

// Applies a filter operator; comparison is case-insensitive.
const matchesOperator = (operator, actualValue, expectedValue) => {
  const actual = actualValue.toLowerCase();
  const expected = expectedValue.toLowerCase();

  switch (operator) {
    case "CONTAINS":
      return actual.includes(expected);
    case "EQUALS":
      return actual === expected;
    case "STARTS_WITH":
      return actual.startsWith(expected);
    case "ENDS_WITH":
      return actual.endsWith(expected);
    default:
      return false;
  }
};

const evaluateRule = (rule, payload) => {
  // Filter is optional — a rule with no filter applies to every event of its
  // type. Only evaluate when all three filter parts are present.
  if (!rule.filterField || !rule.filterOperator || rule.filterValue == null) {
    return true;
  }

  const actualValue = getFilterValue(rule.filterField, payload);
  return matchesOperator(rule.filterOperator, actualValue, rule.filterValue);
};

// Runs a rule's action. Returns true when an action was actually attempted
// (so the caller can log it), false for no-ops. Throws if the action fails.
const executeRule = async (
  rule,
  repository,
  payload,
  accessToken,
  slackWebhookUrl,
) => {
  const issueNumber = payload.issue?.number ?? payload.pull_request?.number;

  switch (rule.actionType) {
    case "ADD_LABEL":
      // Labels attach to an issue or PR; pushes have neither, so skip.
      if (!issueNumber) {
        return false;
      }
      await addLabel(accessToken, repository, issueNumber, rule.actionValue);
      return true;

    case "SEND_SLACK":
      await sendSlackMessage(
        buildSlackMessage(rule, repository, payload),
        slackWebhookUrl,
      );
      return true;

    default:
      return false;
  }
};

// Human-readable description of what an event acted on, for the activity log.
const describeTarget = (event, payload) => {
  switch (event) {
    case "ISSUE_OPENED":
      return {
        target: `#${payload.issue?.number} ${payload.issue?.title ?? ""}`.trim(),
        targetUrl: payload.issue?.html_url ?? null,
      };

    case "PULL_REQUEST_OPENED":
      return {
        target:
          `#${payload.pull_request?.number} ${payload.pull_request?.title ?? ""}`.trim(),
        targetUrl: payload.pull_request?.html_url ?? null,
      };

    case "PUSH":
      return {
        target: `${payload.ref?.replace("refs/heads/", "") ?? ""}: ${
          payload.head_commit?.message ?? ""
        }`.trim(),
        targetUrl: payload.head_commit?.url ?? null,
      };

    default:
      return { target: "", targetUrl: null };
  }
};

const EVENT_LABELS = {
  ISSUE_OPENED: "Issue",
  PULL_REQUEST_OPENED: "Pull Request",
  PUSH: "Push",
};

// The main subject of the event (issue/PR title, or push commit message).
const getEventTitle = (event, payload) => {
  switch (event) {
    case "ISSUE_OPENED":
      return payload.issue?.title ?? "";
    case "PULL_REQUEST_OPENED":
      return payload.pull_request?.title ?? "";
    case "PUSH":
      return payload.head_commit?.message ?? "";
    default:
      return "";
  }
};

// Builds a readable, sectioned Slack message for an event.
const buildSlackMessage = (rule, repository, payload) => {
  const eventLabel = EVENT_LABELS[rule.event] ?? "Event";
  const title = getEventTitle(rule.event, payload);
  const { targetUrl } = describeTarget(rule.event, payload);

  const sections = [];

  // The rule's configured message, when provided, leads the notification.
  if (rule.actionValue) {
    sections.push(rule.actionValue);
  }

  sections.push(`*Repository:*\n${repository.fullName}`);

  if (title) {
    sections.push(`*${eventLabel}:*\n${title}`);
  }

  if (targetUrl) {
    sections.push(targetUrl);
  }

  return sections.join("\n\n");
};

module.exports = {
  executeRule,
  evaluateRule,
  describeTarget,
};
