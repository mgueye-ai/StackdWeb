const { hasLaunchAccess } = require("./launch-auth");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function requireAdmin(req, res) {
  if (!hasLaunchAccess(req)) {
    json(res, 401, { error: "Unauthorized." });
    return false;
  }
  return true;
}

module.exports = { requireAdmin, json };
