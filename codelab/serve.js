import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "dist", "nusaroute-ai-codelab");

const mimeTypes = {
  html: "text/html; charset=utf-8",
  js: "application/javascript",
  css: "text/css",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
};

const port = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  const reqUrl = req.url?.split("?")[0] || "/";
  let relativePath = reqUrl === "/" ? "index.html" : reqUrl.replace(/^\//, "");
  let filePath = path.join(dir, relativePath);

  // Security: prevent path traversal
  if (!filePath.startsWith(dir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  // If directory requested, look for index.html inside
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`\n📘 NusaRoute AI Codelab berjalan di http://localhost:${port}`);
  console.log("Tekan Ctrl+C untuk menghentikan server.\n");
});
