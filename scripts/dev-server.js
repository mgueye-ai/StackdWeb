const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = path.join(__dirname, "..");

const API_ROUTES = {
  "/api/unlock": "api/unlock.js",
  "/api/check-launch-access": "api/check-launch-access.js",
  "/api/waitlist": "api/waitlist.js",
  "/api/create-checkout": "api/create-checkout.js",
  "/api/verify-session": "api/verify-session.js",
  "/api/stripe-webhook": "api/stripe-webhook.js",
  "/api/admin/stats": "api/admin/stats.js",
  "/api/admin/orders": "api/admin/orders.js",
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function createMockResponse(serverRes) {
  const headers = {};

  return {
    statusCode: 200,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    end(body) {
      serverRes.statusCode = this.statusCode;
      for (const [name, value] of Object.entries(headers)) {
        serverRes.setHeader(name, value);
      }
      serverRes.end(body);
    },
  };
}

async function handleApi(req, res, pathname) {
  const relativePath = API_ROUTES[pathname];

  if (!relativePath) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "API route not found." }));
    return;
  }

  const modulePath = path.join(ROOT, relativePath);
  delete require.cache[require.resolve(modulePath)];
  const handler = require(modulePath);

  const rawBody = await readBody(req);
  let body = rawBody;

  if (rawBody && req.headers["content-type"]?.includes("application/json")) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }

  const mockReq = {
    method: req.method,
    headers: req.headers,
    body,
    url: req.url,
  };

  const mockRes = createMockResponse(res);
  await handler(mockReq, mockRes);
}

function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, safePath));

  if (!filePath.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  res.end(fs.readFileSync(filePath));
}

const port = Number(process.env.PORT) || 3000;

loadEnvFile(path.join(ROOT, ".env"));
loadEnvFile(path.join(ROOT, ".env.local"));

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (API_ROUTES[url.pathname]) {
      await handleApi(req, res, url.pathname);
      return;
    }

    serveStatic(res, decodeURIComponent(url.pathname));
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Server error." }));
    }
  }
});

server.listen(port, () => {
  console.log(`Stackd dev server: http://localhost:${port}`);
  console.log("API routes enabled (same as Vercel /api/*).");
});
