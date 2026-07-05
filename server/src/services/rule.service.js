const prisma = require("../lib/prisma");

const createRule = async (repositoryId, rule) => {
  return prisma.rule.create({
    data: {
      ...rule,
      repository: {
        connect: {
          id: repositoryId,
        },
      },
    },
  });
};

const getRulesByRepositoryId = async (repositoryId) => {
  return prisma.rule.findMany({
    where: {
      repositoryId: repositoryId,
    },
  });
};

// Finds an identical rule (same event, filter, and action) in the repo.
const findDuplicateRule = async (repositoryId, rule) => {
  return prisma.rule.findFirst({
    where: {
      repositoryId,
      event: rule.event,
      filterField: rule.filterField,
      filterOperator: rule.filterOperator,
      filterValue: rule.filterValue,
      actionType: rule.actionType,
      actionValue: rule.actionValue,
    },
  });
};

const getRulesByRepositoryIdAndEvent = async (repositoryId, event) => {
  return prisma.rule.findMany({
    where: {
      repositoryId,
      event,
    },
  });
};

// Scoped to repositoryId so a rule can only be deleted by its owner's repo.
// Returns the number of rows removed (0 when the rule isn't found / not owned).
const deleteRule = async (ruleId, repositoryId) => {
  const { count } = await prisma.rule.deleteMany({
    where: {
      id: ruleId,
      repositoryId,
    },
  });

  return count;
};

module.exports = {
  createRule,
  getRulesByRepositoryId,
  getRulesByRepositoryIdAndEvent,
  findDuplicateRule,
  deleteRule,
};
