const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = {
  generateToken,
  verifyToken,
};
