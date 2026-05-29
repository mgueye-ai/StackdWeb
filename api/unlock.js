const { setLaunchCookie, getExpectedPasscode } = require("./lib/launch-auth");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  let body = req.body;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      json(res, 400, { error: "Invalid request." });
      return;
    }
  }

  const passcode = String(body?.passcode || "").trim();

  if (!passcode) {
    json(res, 400, { error: "Passcode required." });
    return;
  }

  if (passcode !== getExpectedPasscode()) {
    json(res, 401, { error: "Invalid passcode." });
    return;
  }

  setLaunchCookie(res);
  json(res, 200, { ok: true });
};
