import "dotenv/config";
import crypto from "node:crypto";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const MONGODB_DB = process.env.MONGODB_DB ?? "collab_docs_v2";
const API_SECRET = process.env.API_SECRET ?? "";
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? "http://127.0.0.1:5173,http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const MAX_BODY_BYTES = 20 * 1024 * 1024;

const client = new MongoClient(MONGODB_URI);
const db = client.db(MONGODB_DB);
const documents = db.collection("documents");
const documentStreams = new Map();
const presenceByDocument = new Map();

function getCorsOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return ALLOWED_ORIGINS[0] ?? "http://127.0.0.1:5173";
  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
}

function setCorsHeaders(req, res) {
  const origin = getCorsOrigin(req);
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-API-Key,X-Access-Token");
}

function sendJson(req, res, status, payload) {
  setCorsHeaders(req, res);
  res.writeHead(status, {
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(payload));
}

function sendEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(documentId, event, payload) {
  const streams = documentStreams.get(documentId);
  if (!streams) return;
  for (const res of streams) {
    sendEvent(res, event, payload);
  }
}

function getPresence(documentId) {
  return [...(presenceByDocument.get(documentId)?.values() ?? [])];
}

function upsertPresence(documentId, viewer) {
  const viewers = presenceByDocument.get(documentId) ?? new Map();
  viewers.set(viewer.sessionId, {
    ...viewer,
    lastSeen: new Date().toISOString(),
  });
  presenceByDocument.set(documentId, viewers);
  broadcast(documentId, "presence", getPresence(documentId));
}

function removePresence(documentId, sessionId) {
  const viewers = presenceByDocument.get(documentId);
  if (!viewers) return;
  viewers.delete(sessionId);
  broadcast(documentId, "presence", getPresence(documentId));
}

export function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function hasApiAccess(req) {
  return !API_SECRET || safeEqual(String(req.headers["x-api-key"] ?? ""), API_SECRET);
}

export function createShareTokens() {
  return {
    view: crypto.randomBytes(24).toString("base64url"),
    edit: crypto.randomBytes(24).toString("base64url"),
    admin: crypto.randomBytes(24).toString("base64url"),
  };
}

export function normalizeMetadata(metadata) {
  if (!metadata) return null;
  const shareTokens = metadata.shareTokens ?? createShareTokens();
  const adminMembers = (metadata.admins ?? []).map((sessionId) => {
    const existing = metadata.adminMembers?.find((member) => member.sessionId === sessionId);
    return existing ?? {
      sessionId,
      name: sessionId === metadata.creatorId ? metadata.creatorName : "Admin",
      joinedAt: metadata.createdAt,
      isCreator: sessionId === metadata.creatorId,
    };
  });
  return { ...metadata, admins: metadata.admins ?? [], shareTokens, adminMembers };
}

export function getAccessRole(req, metadata) {
  if (hasApiAccess(req)) return "admin";
  const token = String(req.headers["x-access-token"] ?? "");
  const tokens = metadata?.shareTokens;
  if (!tokens || !token) return null;
  if (safeEqual(token, tokens.admin)) return "admin";
  if (safeEqual(token, tokens.edit)) return "edit";
  if (safeEqual(token, tokens.view)) return "view";
  return null;
}

function stripPrivateMetadata(metadata, accessRole) {
  if (!metadata) return metadata;
  if (accessRole === "admin") return metadata;
  const { shareTokens: _shareTokens, ...publicMetadata } = metadata;
  return publicMetadata;
}

export function sanitizeHtml(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)=["']\s*javascript:[^"']*["']/gi, "")
    .replace(/<(?!\/?(a|b|br|div|em|h1|h2|h3|i|img|li|ol|p|span|strong|u|ul|mark)\b)[^>]*>/gi, "");
}

export function sanitizeDraft(draft = {}) {
  return {
    title: typeof draft.title === "string" ? draft.title.slice(0, 300) : "",
    body: sanitizeHtml(draft.body),
  };
}

export function sanitizeState(state) {
  const drafts = {};
  for (const [writerId, draft] of Object.entries(state.drafts ?? {})) {
    drafts[writerId] = sanitizeDraft(draft);
  }
  return {
    ...state,
    document: sanitizeDraft(state.document),
    drafts,
    proposals: (state.proposals ?? []).map((proposal) => ({
      ...proposal,
      draft: sanitizeDraft(proposal.draft),
    })),
    viewers: [],
  };
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

function getDocumentEventsId(pathname) {
  const match = pathname.match(/^\/api\/documents\/([^/]+)\/events$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getDocumentPresenceId(pathname) {
  const match = pathname.match(/^\/api\/documents\/([^/]+)\/presence$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getRequestWithQueryToken(req, url) {
  return {
    ...req,
    headers: {
      ...req.headers,
      "x-access-token": req.headers["x-access-token"] ?? url.searchParams.get("access") ?? "",
    },
  };
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    if (!getCorsOrigin(req)) {
      res.writeHead(403);
      res.end();
      return;
    }
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(req, res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/documents") {
    if (!hasApiAccess(req)) {
      sendJson(req, res, 401, { error: "API key is required to list documents" });
      return;
    }
    const records = await documents
      .find({}, { projection: { _id: 0, documentId: 1, "state.document.title": 1, metadata: 1, updatedAt: 1, createdAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
    sendJson(req, res, 200, {
      documents: records.map((record) => ({
        documentId: record.documentId,
        title: record.state?.document?.title || "Untitled Document",
        creatorName: record.metadata?.creatorName ?? "Unknown",
        updatedAt: record.updatedAt,
        createdAt: record.createdAt,
      })),
    });
    return;
  }

  const eventsDocumentId = getDocumentEventsId(url.pathname);
  if (req.method === "GET" && eventsDocumentId) {
    const record = await documents.findOne({ documentId: eventsDocumentId }, { projection: { _id: 0 } });
    if (!record) {
      sendJson(req, res, 404, { error: "Document not found" });
      return;
    }
    const metadata = normalizeMetadata(record.metadata);
    const accessRole = getAccessRole(getRequestWithQueryToken(req, url), metadata);
    if (!accessRole) {
      sendJson(req, res, 401, { error: "Invalid or missing access token" });
      return;
    }

    setCorsHeaders(req, res);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.write("\n");
    const streams = documentStreams.get(eventsDocumentId) ?? new Set();
    streams.add(res);
    documentStreams.set(eventsDocumentId, streams);
    sendEvent(res, "document", { state: record.state, metadata: stripPrivateMetadata(metadata, accessRole), accessRole });
    sendEvent(res, "presence", getPresence(eventsDocumentId));
    req.on("close", () => {
      streams.delete(res);
    });
    return;
  }

  const presenceDocumentId = getDocumentPresenceId(url.pathname);
  if (presenceDocumentId && (req.method === "POST" || req.method === "DELETE")) {
    const record = await documents.findOne({ documentId: presenceDocumentId }, { projection: { _id: 0, metadata: 1 } });
    if (!record) {
      sendJson(req, res, 404, { error: "Document not found" });
      return;
    }
    const metadata = normalizeMetadata(record.metadata);
    const accessRole = getAccessRole(req, metadata);
    if (!accessRole) {
      sendJson(req, res, 401, { error: "Invalid or missing access token" });
      return;
    }
    const body = await readJson(req);
    if (!body.sessionId) {
      sendJson(req, res, 400, { error: "Missing sessionId" });
      return;
    }
    if (req.method === "POST") {
      upsertPresence(presenceDocumentId, {
        sessionId: String(body.sessionId),
        name: String(body.name ?? "Viewer"),
        joinedAt: String(body.joinedAt ?? new Date().toISOString()),
        lastSeen: new Date().toISOString(),
        permission: accessRole,
      });
    } else {
      removePresence(presenceDocumentId, String(body.sessionId));
    }
    sendJson(req, res, 200, { viewers: getPresence(presenceDocumentId) });
    return;
  }

  const documentId = getDocumentId(url.pathname);
  if (!documentId) {
    sendJson(req, res, 404, { error: "Not found" });
    return;
  }

  if (req.method === "GET") {
    const record = await documents.findOne({ documentId }, { projection: { _id: 0 } });
    if (!record) {
      sendJson(req, res, 404, { error: "Document not found" });
      return;
    }
    const metadata = normalizeMetadata(record.metadata);
    const accessRole = getAccessRole(req, metadata);
    if (!accessRole) {
      sendJson(req, res, 401, { error: "Invalid or missing access token" });
      return;
    }
    sendJson(req, res, 200, {
      ...record,
      metadata: stripPrivateMetadata(metadata, accessRole),
      accessRole,
    });
    return;
  }

  if (req.method === "PUT") {
    try {
      const body = await readJson(req);
      if (!body.state) {
        sendJson(req, res, 400, { error: "Missing document state" });
        return;
      }

      const existing = await documents.findOne({ documentId }, { projection: { _id: 0 } });
      const existingMetadata = normalizeMetadata(existing?.metadata);
      const incomingMetadata = normalizeMetadata(body.metadata);
      const metadata = existingMetadata ?? incomingMetadata;
      const accessRole = existing ? getAccessRole(req, existingMetadata) : (hasApiAccess(req) ? "admin" : null);
      if (!accessRole) {
        sendJson(req, res, 401, { error: "Invalid or missing access token" });
        return;
      }
      if (accessRole !== "admin") {
        sendJson(req, res, 403, { error: "Admin access is required to save this document" });
        return;
      }

      const now = new Date().toISOString();
      await documents.updateOne(
        { documentId },
        {
          $set: {
            documentId,
            state: sanitizeState(body.state),
            metadata,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );

      const saved = await documents.findOne({ documentId }, { projection: { _id: 0 } });
      broadcast(documentId, "document", { state: saved.state, metadata: saved.metadata, accessRole: "admin" });
      sendJson(req, res, 200, { ...saved, accessRole: "admin" });
    } catch (error) {
      sendJson(req, res, 400, { error: error instanceof Error ? error.message : "Invalid request" });
    }
    return;
  }

  sendJson(req, res, 405, { error: "Method not allowed" });
});

async function start() {
  await client.connect();
  await documents.createIndex({ documentId: 1 }, { unique: true });
  server.listen(PORT, () => {
    console.log(`API server listening on http://127.0.0.1:${PORT}`);
    console.log(`MongoDB database: ${MONGODB_DB}`);
    if (!API_SECRET) {
      console.warn("API_SECRET is not set. Backend API-key enforcement is disabled for local development.");
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start().catch((error) => {
    console.error("Failed to start API server", error);
    process.exit(1);
  });
}
