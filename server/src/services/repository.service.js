const prisma = require("../lib/prisma");

const createOrUpdateRepository = async (userId, repository) => {
  return await prisma.repository.upsert({
    where: {
      userId: userId,
    },
    update: { ...repository },
    create: {
      ...repository,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });
};

const getRepositoryByUserId = async (userId) => {
  return prisma.repository.findUnique({
    where: {
      userId: userId,
    },
  });
};

const getRepositoryByGithubId = async (githubId) => {
  return prisma.repository.findFirst({
    where: {
      githubId: BigInt(githubId),
    },
  });
};

// githubId isn't unique across users — multiple users can connect the same
// repo. A webhook must process every connected instance, each with its owner's
// rules and token.
const getRepositoriesByGithubId = async (githubId) => {
  return prisma.repository.findMany({
    where: {
      githubId: BigInt(githubId),
    },
  });
};

module.exports = {
  createOrUpdateRepository,
  getRepositoryByUserId,
  getRepositoryByGithubId,
  getRepositoriesByGithubId,
};
