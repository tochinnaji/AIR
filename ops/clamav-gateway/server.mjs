import { createServer } from "node:http";
import { connect } from "node:net";
import { timingSafeEqual } from "node:crypto";

const port = Number(process.env.PORT ?? "8080");
const token = process.env.CLAMAV_SCAN_TOKEN;
const clamHost = process.env.CLAMAV_HOST;
const clamPort = Number(process.env.CLAMAV_PORT ?? "3310");
const maxBytes = 5 * 1024 * 1024;

if (!token || token.length < 32 || !clamHost || !Number.isInteger(clamPort)) {
  throw new Error("Set a 32-character CLAMAV_SCAN_TOKEN and ClamAV host/port.");
}

function reply(res, status) {
  res.writeHead(status, { "cache-control": "no-store", "content-length": "0" });
  res.end();
}

function authorized(req) {
  const header = req.headers.authorization ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const supplied = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function ping() {
  return new Promise((resolve) => {
    const socket = connect({ host: clamHost, port: clamPort });
    let result = "";
    const timer = setTimeout(() => socket.destroy(), 1500);
    socket.on("connect", () => socket.write(Buffer.from("zPING\0")));
    socket.on("data", (data) => { result += data.toString("utf8"); });
    socket.on("error", () => { clearTimeout(timer); resolve(false); });
    socket.on("end", () => { clearTimeout(timer); resolve(result.includes("PONG")); });
    socket.on("close", () => { clearTimeout(timer); resolve(result.includes("PONG")); });
  });
}

function scan(bytes) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: clamHost, port: clamPort });
    let result = "";
    let settled = false;
    const finish = (error, clean = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      error ? reject(error) : resolve(clean);
    };
    const timer = setTimeout(() => finish(new Error("ClamAV timed out")), 18_000);
    socket.on("connect", () => {
      socket.write(Buffer.from("zINSTREAM\0"));
      for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
        const chunk = bytes.subarray(offset, Math.min(offset + 64 * 1024, bytes.length));
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", (data) => { result += data.toString("utf8"); });
    socket.on("error", (error) => finish(error));
    socket.on("end", () => {
      if (result.includes("FOUND")) finish(null, false);
      else if (result.trim().endsWith("OK")) finish(null, true);
      else finish(new Error("Unexpected ClamAV response"));
    });
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return reply(res, await ping() ? 204 : 503);
  }
  if (req.method !== "POST" || req.url !== "/scan") return reply(res, 404);
  if (!authorized(req)) return reply(res, 401);
  if (req.headers["content-type"] !== "application/octet-stream") return reply(res, 415);
  const declaredLength = Number(req.headers["content-length"] ?? "0");
  if (declaredLength > maxBytes) return reply(res, 413);

  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > maxBytes) {
      reply(res, 413);
      req.destroy();
    } else chunks.push(chunk);
  });
  req.on("end", async () => {
    if (res.writableEnded) return;
    try {
      const clean = await scan(Buffer.concat(chunks));
      reply(res, clean ? 204 : 422);
    } catch {
      reply(res, 503);
    }
  });
});

server.headersTimeout = 10_000;
server.requestTimeout = 25_000;
server.listen(port, "0.0.0.0");
