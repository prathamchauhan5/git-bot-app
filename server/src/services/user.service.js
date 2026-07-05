const prisma = require("../lib/prisma");

const createOrUpdateUser = async (githubUser, accessToken) => {
  const userData = {
    username: githubUser.login,
    avatarUrl: githubUser.avatar_url,
    accessToken,
  };

  return await prisma.user.upsert({
    where: {
      githubId: BigInt(githubUser.id),
    },
    update: userData,
    create: {
      githubId: BigInt(githubUser.id),
      ...userData,
    },
  });
};

const getUserById = async (id) => {
  return prisma.user.findUnique({
    where: {
      id,
    },
  });
};

const updateSlackWebhookUrl = async (id, slackWebhookUrl) => {
  return prisma.user.update({
    where: {
      id,
    },
    data: {
      slackWebhookUrl,
    },
  });
};

module.exports = {
  createOrUpdateUser,
  getUserById,
  updateSlackWebhookUrl,
};
