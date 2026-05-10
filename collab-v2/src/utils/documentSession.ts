export type DocumentId = string;

const DOCUMENT_QUERY_KEY = "doc";
const ROLE_QUERY_KEY = "role";

function createDocumentId(): DocumentId {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getCurrentDocumentId(): DocumentId {
  const url = new URL(window.location.href);
  const existing = url.searchParams.get(DOCUMENT_QUERY_KEY);
  if (existing) return existing;

  const id = createDocumentId();
  url.searchParams.set(DOCUMENT_QUERY_KEY, id);
  window.history.replaceState(null, "", url);
  return id;
}

export function hasSharedDocumentLink(): boolean {
  const url = new URL(window.location.href);
  const role = url.searchParams.get(ROLE_QUERY_KEY);
  return (
    Boolean(url.searchParams.get(DOCUMENT_QUERY_KEY)) &&
    (role === "view" || role === "edit" || role === "admin")
  );
}
