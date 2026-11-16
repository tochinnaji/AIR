import { connect } from "node:net";

const MAX_SCAN_BYTES = 5 * 1024 * 1024;

export class UploadScannerUnavailableError extends Error {}
export class MaliciousUploadError extends Error {}

/** Scan a file through an authenticated HTTPS gateway or a private clamd socket. */
export async function scanUpload(bytes: Buffer) {
  if (bytes.length > MAX_SCAN_BYTES) throw new Error("File exceeds the scanner limit.");

  const scanUrl = process.env.CLAMAV_SCAN_URL;
  if (scanUrl) {
    const token = process.env.CLAMAV_SCAN_TOKEN;
    let url: URL;
    try { url = new URL(scanUrl); } catch { throw new UploadScannerUnavailableError(); }
    if (!token || (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost")) {
      throw new UploadScannerUnavailableError();
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/octet-stream" },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (response.status === 204) return;
      if (response.status === 422) throw new MaliciousUploadError();
      throw new UploadScannerUnavailableError();
    } catch (error) {
      if (error instanceof MaliciousUploadError || error instanceof UploadScannerUnavailableError) throw error;
      throw new UploadScannerUnavailableError();
    }
  }

  const host = process.env.CLAMAV_HOST;
  const port = Number(process.env.CLAMAV_PORT ?? "3310");
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) throw new UploadScannerUnavailableError();

  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host, port });
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => finish(new UploadScannerUnavailableError()), 12_000);
    socket.on("connect", () => {
      socket.write(Buffer.from("zINSTREAM\0", "utf8"));
      for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
        const chunk = bytes.subarray(offset, Math.min(offset + 64 * 1024, bytes.length));
        const length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.length);
        socket.write(length);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", (chunk: Buffer) => chunks.push(chunk));
    socket.on("error", () => finish(new UploadScannerUnavailableError()));
    socket.on("end", () => {
      clearTimeout(timer);
      const result = Buffer.concat(chunks).toString("utf8").replace(/\0+$/, "").trim();
      if (result.endsWith("OK")) finish();
      else if (result.includes("FOUND")) finish(new MaliciousUploadError());
      else finish(new UploadScannerUnavailableError());
    });
    socket.on("close", () => clearTimeout(timer));
  });
}
