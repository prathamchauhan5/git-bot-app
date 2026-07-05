const express = require("express");

const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const { getUserById } = require("../services/user.service");
const { getRepositories } = require("../services/github.service");
const {
  createOrUpdateRepository,
  getRepositoryByUserId,
} = require("../services/repository.service");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.sub);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const repositories = await getRepositories(user.accessToken);

    return res.json(repositories);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch repositories",
    });
  }
});

router.post("/select", authMiddleware, async (req, res) => {
  try {
    const { githubId } = req.body;

    if (!githubId) {
      return res.status(400).json({
        message: "Missing githubId",
      });
    }

    const user = await getUserById(req.user.sub);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const repositories = await getRepositories(user.accessToken);

    const selectedRepo = repositories.find(
      (repo) => String(repo.id) === String(githubId),
    );

    if (!selectedRepo) {
      return res.status(404).json({
        message: "Repository not found",
      });
    }

    const repository = await createOrUpdateRepository(user.id, {
      githubId: BigInt(selectedRepo.id),
      name: selectedRepo.name,
      fullName: selectedRepo.fullName,
    });

    return res.json({
      message: "Repository connected.",
      repository: {
        id: repository.id,
        githubId: repository.githubId.toString(),
        name: repository.name,
        fullName: repository.fullName,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to connect repository",
    });
  }
});

router.get("/connected", authMiddleware, async (req, res) => {
  try {
    const repository = await getRepositoryByUserId(req.user.sub);

    if (!repository) {
      return res.status(404).json({
        message: "No repository connected",
      });
    }

    return res.json({
      id: repository.id,
      githubId: repository.githubId.toString(),
      name: repository.name,
      fullName: repository.fullName,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch connected repository",
    });
  }
});

module.exports = router;
