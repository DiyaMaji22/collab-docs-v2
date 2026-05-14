import type { DocumentMetadata, DocumentState, ViewerPresence } from "../types";
import type { DocumentId } from "./documentSession";

type DocumentRecord = {
  documentId: string;
  state: DocumentState;
  metadata?: DocumentMetadata;
  accessRole?: "view" | "edit" | "admin";
  createdAt: string;
  updatedAt: string;
};

export type DocumentSummary = {
  documentId: string;
  title: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000";
const API_KEY = import.meta.env.VITE_API_KEY;

function documentUrl(documentId: DocumentId): string {
  return `${API_BASE}/api/documents/${encodeURIComponent(documentId)}`;
}

function presenceUrl(documentId: DocumentId): string {
  return `${documentUrl(documentId)}/presence`;
}

export function documentEventsUrl(documentId: DocumentId, accessToken?: string | null): string {
  const url = new URL(`${documentUrl(documentId)}/events`);
  if (accessToken) url.searchParams.set("access", accessToken);
  return url.toString();
}

function authHeaders(accessToken?: string | null): Record<string, string> {
  return {
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
    ...(accessToken ? { "X-Access-Token": accessToken } : {}),
  };
}

export async function loadDocumentRecord(documentId: DocumentId, accessToken?: string | null): Promise<DocumentRecord | null> {
  const response = await fetch(documentUrl(documentId), {
    headers: authHeaders(accessToken),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load document: ${response.status}`);
  return response.json();
}

export async function saveDocumentRecord(
  documentId: DocumentId,
  state: DocumentState,
  metadata?: DocumentMetadata | null,
  accessToken?: string | null
): Promise<DocumentRecord> {
  const response = await fetch(documentUrl(documentId), {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify({ state, metadata }),
  });

  if (!response.ok) throw new Error(`Failed to save document: ${response.status}`);
  return response.json();
}

export async function savePresence(
  documentId: DocumentId,
  viewer: Pick<ViewerPresence, "sessionId" | "name" | "joinedAt">,
  accessToken?: string | null
): Promise<void> {
  await fetch(presenceUrl(documentId), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify(viewer),
  });
}

export async function removePresence(
  documentId: DocumentId,
  sessionId: string,
  accessToken?: string | null
): Promise<void> {
  await fetch(presenceUrl(documentId), {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify({ sessionId }),
  });
}

export async function listDocumentRecords(): Promise<DocumentSummary[]> {
  const response = await fetch(`${API_BASE}/api/documents`, {
    headers: authHeaders(),
  });
  if (!response.ok) return [];
  const body = await response.json();
  return body.documents ?? [];
}
