const prisma = require("../lib/prisma");

const createExecution = async (execution) => {
  return prisma.ruleExecution.create({
    data: execution,
  });
};

const getExecutionsByRepositoryId = async (repositoryId) => {
  return prisma.ruleExecution.findMany({
    where: {
      repositoryId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });
};

module.exports = {
  createExecution,
  getExecutionsByRepositoryId,
};
