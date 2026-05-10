import type { DocumentMetadata, DocumentState } from "../types";
import type { DocumentId } from "./documentSession";

type DocumentRecord = {
  documentId: string;
  state: DocumentState;
  metadata?: DocumentMetadata;
  createdAt: string;
  updatedAt: string;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000";

function documentUrl(documentId: DocumentId): string {
  return `${API_BASE}/api/documents/${encodeURIComponent(documentId)}`;
}

export async function loadDocumentRecord(documentId: DocumentId): Promise<DocumentRecord | null> {
  const response = await fetch(documentUrl(documentId));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load document: ${response.status}`);
  return response.json();
}

export async function saveDocumentRecord(
  documentId: DocumentId,
  state: DocumentState,
  metadata?: DocumentMetadata | null
): Promise<DocumentRecord> {
  const response = await fetch(documentUrl(documentId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, metadata }),
  });

  if (!response.ok) throw new Error(`Failed to save document: ${response.status}`);
  return response.json();
}
