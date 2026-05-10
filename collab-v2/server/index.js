import "dotenv/config";
import http from "node:http";
import { MongoClient } from "mongodb";

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const MONGODB_DB = process.env.MONGODB_DB ?? "collab_docs_v2";
const MAX_BODY_BYTES = 20 * 1024 * 1024;

const client = new MongoClient(MONGODB_URI);
const db = client.db(MONGODB_DB);
const documents = db.collection("documents");

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function getDocumentId(pathname) {
  const match = pathname.match(/^\/api\/documents\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const documentId = getDocumentId(url.pathname);
  if (!documentId) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (req.method === "GET") {
    const record = await documents.findOne({ documentId }, { projection: { _id: 0 } });
    sendJson(res, record ? 200 : 404, record ?? { error: "Document not found" });
    return;
  }

  if (req.method === "PUT") {
    try {
      const body = await readJson(req);
      if (!body.state) {
        sendJson(res, 400, { error: "Missing document state" });
        return;
      }

      const now = new Date().toISOString();
      await documents.updateOne(
        { documentId },
        {
          $set: {
            documentId,
            state: body.state,
            metadata: body.metadata,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );

      const saved = await documents.findOne({ documentId }, { projection: { _id: 0 } });
      sendJson(res, 200, saved);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid request" });
    }
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
});

async function start() {
  await client.connect();
  await documents.createIndex({ documentId: 1 }, { unique: true });
  server.listen(PORT, () => {
    console.log(`API server listening on http://127.0.0.1:${PORT}`);
    console.log(`MongoDB database: ${MONGODB_DB}`);
  });
}

start().catch((error) => {
  console.error("Failed to start API server", error);
  process.exit(1);
});
