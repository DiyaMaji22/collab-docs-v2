import type { Permission, SessionUser, Writer, DocumentMetadata, AdminMember, ShareTokens } from "../types";
import type { DocumentId } from "./documentSession";

// ─── URL param keys ───────────────────────────────────────────────────────────

const DOC_KEY = "doc";
const PERM_KEY = "role";           // view | edit | admin
const ACCESS_KEY = "access";
const SESSION_KEY = "collab-session-v2";
const ANON_COUNTER_KEY = "collab-anon-counter";

// ─── Session ID ───────────────────────────────────────────────────────────────

export function getOrCreateSessionId(): string {
  const stored = sessionStorage.getItem("collab-session-id");
  if (stored) return stored;
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem("collab-session-id", id);
  return id;
}

// ─── Anonymous name generator ─────────────────────────────────────────────────

const ADJECTIVES = ["Swift", "Quiet", "Bright", "Calm", "Bold", "Keen", "Wise", "Cool"];
const NOUNS = ["Penguin", "Falcon", "Otter", "Panda", "Fox", "Owl", "Bear", "Wolf"];

function nextAnonName(docId: DocumentId): string {
  const key = `${ANON_COUNTER_KEY}:${docId}`;
  const count = Number(localStorage.getItem(key) ?? 0) + 1;
  localStorage.setItem(key, String(count));
  const adj = ADJECTIVES[(count - 1) % ADJECTIVES.length];
  const noun = NOUNS[Math.floor((count - 1) / ADJECTIVES.length) % NOUNS.length];
  return `${adj} ${noun} ${count}`;
}

// ─── Resolve current user from URL + storage ──────────────────────────────────

export function resolveCurrentUser(docId: DocumentId): SessionUser {
  const params = new URLSearchParams(window.location.search);
  const urlRole = params.get(PERM_KEY);

  // Persist resolved permission across page loads
  const storedRaw = sessionStorage.getItem(SESSION_KEY);
  const stored: Partial<SessionUser> = storedRaw ? JSON.parse(storedRaw) : {};

  const permission: Permission = stored.permission ?? "view";

  const sessionId = getOrCreateSessionId();
  const isAnonymous = permission === "view";

  let name = stored.name;
  if (!name) {
    if (isAnonymous) {
      name = nextAnonName(docId);
    } else if (permission === "admin") {
      name = "Admin";
    } else {
      // Named contributor — generate a stable name
      const idx = Number(localStorage.getItem(`collab-contributor-idx:${docId}`) ?? 0);
      localStorage.setItem(`collab-contributor-idx:${docId}`, String(idx + 1));
      name = `Contributor ${idx + 1}`;
    }
  }

  const user: SessionUser = {
    sessionId,
    permission,
    joinedAt: stored.joinedAt ?? new Date().toISOString(),
    name,
    isAnonymous,
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));

  // Legacy role links are no longer trusted. Remove them after landing.
  if (urlRole) {
    const url = new URL(window.location.href);
    url.searchParams.delete(PERM_KEY);
    window.history.replaceState(null, "", url);
  }

  return user;
}

// ─── Share link factory ───────────────────────────────────────────────────────

export function buildShareLinks(docId: DocumentId): {
  viewLink: string;
  editLink: string;
  adminLink: string;
} {
  const base = new URL(window.location.href);
  base.searchParams.set(DOC_KEY, docId);
  base.searchParams.delete(PERM_KEY);
  const tokens = getDocumentMetadata(docId)?.shareTokens ?? createShareTokens();

  function link(role: keyof ShareTokens): string {
    const u = new URL(base.toString());
    u.searchParams.set(ACCESS_KEY, tokens[role]);
    return u.toString();
  }

  return {
    viewLink: link("view"),
    editLink: link("edit"),
    adminLink: link("admin"),
  };
}

// ─── Writer identity for a named contributor ──────────────────────────────────

const CONTRIBUTOR_COLORS = [
  { color: "#0f766e", lightBg: "#f0fdf4", midColor: "#bbf7d0" },
  { color: "#7c3aed", lightBg: "#f5f3ff", midColor: "#ddd6fe" },
  { color: "#b45309", lightBg: "#fffbeb", midColor: "#fde68a" },
  { color: "#be185d", lightBg: "#fdf2f8", midColor: "#fbcfe8" },
  { color: "#0369a1", lightBg: "#f0f9ff", midColor: "#bae6fd" },
];

export function buildWriterForUser(user: SessionUser): Writer {
  const hash = user.sessionId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const palette = CONTRIBUTOR_COLORS[hash % CONTRIBUTOR_COLORS.length];
  return {
    id: user.sessionId,
    name: user.name,
    ...palette,
  };
}

// ─── Admin writer constant ────────────────────────────────────────────────────

export const ADMIN_WRITER: Writer = {
  id: "admin",
  name: "Admin",
  color: "#2563eb",
  lightBg: "#eff6ff",
  midColor: "#bfdbfe",
};

// ─── Document metadata management ──────────────────────────────────────────────

const METADATA_KEY = (docId: DocumentId) => `collab-metadata:${docId}`;

function createToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
}

function createShareTokens(): ShareTokens {
  return {
    view: createToken(),
    edit: createToken(),
    admin: createToken(),
  };
}

export function createDocumentMetadata(
  docId: DocumentId,
  creatorId: string,
  creatorName: string
): DocumentMetadata {
  return {
    documentId: docId,
    creatorId,
    creatorName,
    createdAt: new Date().toISOString(),
    admins: [creatorId], // Creator is the first admin
    shareTokens: createShareTokens(),
    adminMembers: [{
      sessionId: creatorId,
      name: creatorName,
      joinedAt: new Date().toISOString(),
      isCreator: true,
    }],
  };
}

export function normalizeDocumentMetadata(metadata: DocumentMetadata): DocumentMetadata {
  const existingMembers = metadata.adminMembers ?? [];
  const memberById = new Map(existingMembers.map((member) => [member.sessionId, member]));
  const adminMembers: AdminMember[] = metadata.admins.map((sessionId) => {
    const member = memberById.get(sessionId);
    if (member) return member;
    return {
      sessionId,
      name: sessionId === metadata.creatorId ? metadata.creatorName : "Admin",
      joinedAt: metadata.createdAt,
      isCreator: sessionId === metadata.creatorId,
    };
  });

  return { ...metadata, adminMembers, shareTokens: metadata.shareTokens ?? createShareTokens() };
}

export function getPermissionForAccessToken(metadata: DocumentMetadata | null, token: string | null): Permission | null {
  if (!metadata || !token) return null;
  const tokens = normalizeDocumentMetadata(metadata).shareTokens;
  if (tokens?.admin === token) return "admin";
  if (tokens?.edit === token) return "edit";
  if (tokens?.view === token) return "view";
  return null;
}

export function getDocumentMetadata(docId: DocumentId): DocumentMetadata | null {
  try {
    const stored = localStorage.getItem(METADATA_KEY(docId));
    return stored ? normalizeDocumentMetadata(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

export function saveDocumentMetadata(metadata: DocumentMetadata): void {
  localStorage.setItem(METADATA_KEY(metadata.documentId), JSON.stringify(normalizeDocumentMetadata(metadata)));
}

export function isUserAdmin(docId: DocumentId, sessionId: string): boolean {
  const metadata = getDocumentMetadata(docId);
  return metadata ? metadata.admins.includes(sessionId) : false;
}

export function grantAdminAccess(docId: DocumentId, sessionId: string, name = "Admin"): DocumentMetadata | null {
  const metadata = getDocumentMetadata(docId);
  if (!metadata) return null;
  const normalized = normalizeDocumentMetadata(metadata);
  let changed = false;
  if (!normalized.admins.includes(sessionId)) {
    normalized.admins.push(sessionId);
    changed = true;
  }
  if (!normalized.adminMembers?.some((member) => member.sessionId === sessionId)) {
    normalized.adminMembers = [
      ...(normalized.adminMembers ?? []),
      { sessionId, name, joinedAt: new Date().toISOString() },
    ];
    changed = true;
  }
  if (!changed) return null;
  saveDocumentMetadata(normalized);
  return normalized;
}

export function revokeAdminAccess(docId: DocumentId, sessionId: string): boolean {
  const metadata = getDocumentMetadata(docId);
  if (!metadata || metadata.creatorId === sessionId) return false; // Can't revoke creator
  const idx = metadata.admins.indexOf(sessionId);
  if (idx < 0) return false;
  metadata.admins.splice(idx, 1);
  saveDocumentMetadata(metadata);
  return true;
}

export function getLocalDocumentSummaries(): Array<{
  documentId: string;
  title: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
}> {
  const summaries = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith("collab-metadata:")) continue;
    const documentId = key.replace("collab-metadata:", "");
    const metadata = getDocumentMetadata(documentId);
    const rawState = localStorage.getItem(`collab-doc-v2:${documentId}`);
    let title = "Untitled Document";
    try {
      const state = rawState ? JSON.parse(rawState) : null;
      title = state?.document?.title || title;
    } catch {
      title = "Untitled Document";
    }
    if (metadata) {
      summaries.push({
        documentId,
        title,
        creatorName: metadata.creatorName,
        createdAt: metadata.createdAt,
        updatedAt: metadata.createdAt,
      });
    }
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
