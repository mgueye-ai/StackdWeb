const { hasLaunchAccess } = require("./lib/launch-auth");

module.exports = async (req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: hasLaunchAccess(req) }));
};
