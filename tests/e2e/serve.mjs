// Serves the built app (dist/) like the Docker image does: data at /api/,
// config.json and a stamped version. Tests can change the version and
// config via /__test/version?v=… and /__test/config?publicUrl=….
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const DIST = join(root, "dist");
const DATA = join(root, "tests/e2e/.data");
const port = Number(process.env.PORT ?? 4173);
let version = "v1";
let publicUrl = "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (status, body, type = "application/json") => {
    res.writeHead(status, { "content-type": type, "cache-control": "no-cache" });
    res.end(body);
  };
  if (url.pathname === "/__test/version") return (version = url.searchParams.get("v")), send(200, "ok");
  if (url.pathname === "/__test/config") return (publicUrl = url.searchParams.get("publicUrl") ?? ""), send(200, "ok");
  if (url.pathname === "/version.json") return send(200, JSON.stringify({ version }));
  if (url.pathname === "/config.json") return send(200, JSON.stringify({ publicUrl }));
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = rel.startsWith("/api/") ? join(DATA, rel) : join(DIST, rel === "/" ? "index.html" : rel);
  try {
    let body = await readFile(file);
    if (/\/(index\.html|sw\.js)$/.test(file)) body = body.toString().replaceAll("__APP_VERSION__", version);
    send(200, body, TYPES[extname(file)] ?? "application/octet-stream");
  } catch {
    send(404, "not found", "text/plain");
  }
}).listen(port, () => console.log(`Serving dist/ on http://localhost:${port}`));
