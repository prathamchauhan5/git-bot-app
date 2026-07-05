const express = require("express");

const router = express.Router();

const {
  EventType,
  FilterField,
  FilterOperator,
  ActionType,
} = require("../generated/prisma");

const authMiddleware = require("../middlewares/auth.middleware");
const { getRepositoryByUserId } = require("../services/repository.service");
const {
  createRule,
  getRulesByRepositoryId,
  findDuplicateRule,
  deleteRule,
} = require("../services/rule.service");
const {
  getExecutionsByRepositoryId,
} = require("../services/rule-execution.service");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const repository = await getRepositoryByUserId(req.user.sub);

    if (!repository) {
      return res.status(404).json({
        message: "No repository connected",
      });
    }

    const rules = await getRulesByRepositoryId(repository.id);

    return res.json(rules);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch rule",
    });
  }
});

router.get("/executions", authMiddleware, async (req, res) => {
  try {
    const repository = await getRepositoryByUserId(req.user.sub);

    if (!repository) {
      return res.status(404).json({
        message: "No repository connected",
      });
    }

    const executions = await getExecutionsByRepositoryId(repository.id);

    return res.json(executions);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch activity",
    });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      event,
      filterField,
      filterOperator,
      filterValue,
      actionType,
      actionValue,
    } = req.body;

    if (!event || !actionType) {
      return res.status(400).json({
        message: "Missing required fields: event, actionType",
      });
    }

    if (!Object.keys(EventType).includes(event)) {
      return res.status(400).json({
        message: `Invalid event. Allowed: ${Object.keys(EventType).join(", ")}`,
      });
    }

    if (!Object.keys(ActionType).includes(actionType)) {
      return res.status(400).json({
        message: `Invalid actionType. Allowed: ${Object.keys(ActionType).join(", ")}`,
      });
    }

    // ADD_LABEL needs a label name; SEND_SLACK's message is optional.
    if (actionType === "ADD_LABEL" && !actionValue) {
      return res.status(400).json({
        message: "actionValue (label) is required for ADD_LABEL",
      });
    }

    // Filter is optional, but all three parts must be supplied together.
    const hasFilter = filterField || filterOperator || filterValue;
    if (hasFilter && (!filterField || !filterOperator || !filterValue)) {
      return res.status(400).json({
        message:
          "Filter requires all of: filterField, filterOperator, filterValue",
      });
    }

    if (hasFilter && !Object.keys(FilterField).includes(filterField)) {
      return res.status(400).json({
        message: `Invalid filterField. Allowed: ${Object.keys(FilterField).join(", ")}`,
      });
    }

    if (hasFilter && !Object.keys(FilterOperator).includes(filterOperator)) {
      return res.status(400).json({
        message: `Invalid filterOperator. Allowed: ${Object.keys(FilterOperator).join(", ")}`,
      });
    }

    const repository = await getRepositoryByUserId(req.user.sub);

    if (!repository) {
      return res.status(404).json({
        message: "No repository connected",
      });
    }

    const ruleData = {
      event,
      filterField: hasFilter ? filterField : null,
      filterOperator: hasFilter ? filterOperator : null,
      filterValue: hasFilter ? filterValue.trim() : null,
      actionType,
      actionValue: actionValue ? actionValue.trim() : null,
    };

    const duplicate = await findDuplicateRule(repository.id, ruleData);
    if (duplicate) {
      return res.status(409).json({
        message: "An identical rule already exists.",
      });
    }

    const rule = await createRule(repository.id, ruleData);

    return res.status(201).json({
      message: "Rule saved.",
      rule,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to save rule",
    });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const repository = await getRepositoryByUserId(req.user.sub);

    if (!repository) {
      return res.status(404).json({
        message: "No repository connected",
      });
    }

    const deleted = await deleteRule(req.params.id, repository.id);

    if (!deleted) {
      return res.status(404).json({
        message: "Rule not found",
      });
    }

    return res.json({
      message: "Rule deleted.",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete rule",
    });
  }
});

module.exports = router;
