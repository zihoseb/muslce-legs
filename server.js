const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const baseUrl = `http://${host === "127.0.0.1" ? "localhost" : host}:${port}`;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".wav": "audio/wav"
};

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, baseUrl);

    if (req.method === "GET" && url.pathname === "/healthz") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" || req.method === "HEAD") {
      return serveStatic(url.pathname, res, req.method === "HEAD");
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: "Unexpected server error" });
  }
});

server.listen(port, host, () => {
  console.log(`Muscle Leg Merge is running at ${baseUrl}`);
  if (host === "0.0.0.0") {
    getLanUrls(port).forEach((url) => console.log(`LAN preview: ${url}`));
  }
});

function serveStatic(requestPath, res, headOnly = false) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const decodedPath = decodeURIComponent(safePath);
  const filePath = path.normalize(path.join(publicDir, decodedPath));

  if (!filePath.startsWith(publicDir)) {
    return sendText(res, 403, "Forbidden");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        return fs.readFile(path.join(publicDir, "index.html"), (fallbackError, fallbackContent) => {
          if (fallbackError) {
            return sendText(res, 404, "Not found");
          }
          return send(res, 200, fallbackContent, "text/html; charset=utf-8", headOnly);
        });
      }

      return sendText(res, 500, "Unable to read file");
    }

    const mimeType = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    return send(res, 200, content, mimeType, headOnly);
  });
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}

function sendText(res, statusCode, payload) {
  send(res, statusCode, payload, "text/plain; charset=utf-8");
}

function send(res, statusCode, payload, contentType, headOnly = false) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(headOnly ? undefined : payload);
}

function getLanUrls(serverPort) {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${serverPort}`);
}
