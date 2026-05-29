const COOKIE_NAME = "stackd_launch";
const COOKIE_VALUE = "granted";
const COOKIE_MAX_AGE = 60 * 60 * 24;

function parseCookies(header) {
  const cookies = {};

  if (!header) {
    return cookies;
  }

  header.split(";").forEach((part) => {
    const [key, ...valueParts] = part.trim().split("=");
    if (key) {
      cookies[key] = valueParts.join("=");
    }
  });

  return cookies;
}

function hasLaunchAccess(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] === COOKIE_VALUE;
}

function setLaunchCookie(res) {
  const isProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${COOKIE_VALUE}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`
  );
}

function getExpectedPasscode() {
  return process.env.LAUNCH_PASSCODE || "0000";
}

module.exports = {
  hasLaunchAccess,
  setLaunchCookie,
  getExpectedPasscode,
};
