const axios = require("axios");
const GITHUB_PROTECTED_URL = "https://api.github.com";

const exchangeCodeForToken = async (code) => {
  const GITHUB_BASE_URL = "https://github.com";
  const response = await axios.post(
    `${GITHUB_BASE_URL}/login/oauth/access_token`,
    {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    },
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  return response.data.access_token;
};

const getAuthenticatedUser = async (accessToken) => {
  const response = await axios.get(`${GITHUB_PROTECTED_URL}/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  return response.data;
};

const getRepositories = async (accessToken) => {
  const response = await axios.get(`${GITHUB_PROTECTED_URL}/user/repos`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
    params: {
      per_page: 100,
      sort: "updated",
    },
  });
  return response.data.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
  }));
};

const addLabel = async (accessToken, repository, issueNumber, label) => {
  const [owner, repo] = repository.fullName.split("/");
  if (!owner || !repo) {
    throw new Error("Invalid repository name");
  }
  try {
    const response = await axios.post(
      `${GITHUB_PROTECTED_URL}/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
      {
        // GitHub rejects leading/trailing whitespace in label names (422).
        labels: [label.trim()],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to add label "${label}" to ${repository.fullName}#${issueNumber}: ${
        error.response?.data?.message || error.message
      }`,
    );
  }
};

module.exports = {
  exchangeCodeForToken,
  getAuthenticatedUser,
  getRepositories,
  addLabel,
};
