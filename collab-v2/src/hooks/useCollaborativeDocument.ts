import { useCallback, useEffect, useReducer, useMemo, useRef, useState } from "react";
import type {
  ChangeProposal,
  DocumentState,
  ViewerPresence,
  WriterDraft,
  WriterPresence,
  DocumentMetadata,
} from "../types";
import type { DocumentId } from "../utils/documentSession";
import { createActivityEntry, appendToLog } from "../utils/activityLog";
import { countWords } from "../utils/text";
import { ADMIN_WRITER, buildWriterForUser, getDocumentMetadata, grantAdminAccess, isUserAdmin, normalizeDocumentMetadata, saveDocumentMetadata } from "../utils/session";
import { loadDocumentRecord, saveDocumentRecord } from "../utils/api";
import type { SessionUser } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function storageKey(docId: DocumentId): string {
  return `collab-doc-v2:${docId}`;
}

function createProposalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyDraft(): WriterDraft {
  return { title: "", body: "" };
}

function buildEmptyState(): DocumentState {
  return {
    document: emptyDraft(),
    drafts: {},
    proposals: [],
    presence: {},
    viewers: [],
    activityLog: [],
  };
}

function loadState(docId: DocumentId): DocumentState {
  try {
    const raw = localStorage.getItem(storageKey(docId));
    if (!raw) return buildEmptyState();
    const parsed = JSON.parse(raw) as Partial<DocumentState>;
    return {
      document: parsed.document ?? emptyDraft(),
      drafts: parsed.drafts ?? {},
      proposals: parsed.proposals ?? [],
      presence: parsed.presence ?? {},
      viewers: [], // never persist viewer sessions
      activityLog: parsed.activityLog ?? [],
    };
  } catch {
    return buildEmptyState();
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "SYNC_FROM_STORAGE"; payload: DocumentState }
  | { type: "INITIALIZE_DOCUMENT"; writerId: string; title: string }
  | { type: "SET_PRESENCE"; writerId: string; patch: Partial<WriterPresence> }
  | { type: "UPDATE_DRAFT"; writerId: string; field: "title" | "body"; value: string }
  | { type: "SAVE_DOCUMENT"; writerId: string; draft: WriterDraft }
  | { type: "SUBMIT_PROPOSAL"; writerId: string; draft: WriterDraft; writerName: string; writerColor: string; writerLightBg: string; writerMidColor: string }
  | { type: "ACCEPT_PROPOSAL"; proposalId: string }
  | { type: "REJECT_PROPOSAL"; proposalId: string; note?: string }
  | { type: "UPSERT_VIEWER"; viewer: ViewerPresence }
  | { type: "REMOVE_VIEWER"; sessionId: string };

function reducer(state: DocumentState, action: Action): DocumentState {
  switch (action.type) {

    case "SYNC_FROM_STORAGE":
      return { ...action.payload, viewers: state.viewers };

    case "INITIALIZE_DOCUMENT": {
      const draft = { title: action.title, body: "" };
      const entry = createActivityEntry(ADMIN_WRITER, "created the document", action.title);
      return {
        ...state,
        document: draft,
        drafts: { ...state.drafts, [action.writerId]: draft },
        activityLog: appendToLog(state.activityLog, entry),
      };
    }

    case "SET_PRESENCE":
      return {
        ...state,
        presence: {
          ...state.presence,
          [action.writerId]: {
            ...(state.presence[action.writerId] ?? { isTyping: false, activity: "Idle" }),
            ...action.patch,
          },
        },
      };

    case "UPDATE_DRAFT":
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [action.writerId]: {
            ...(state.drafts[action.writerId] ?? state.document),
            [action.field]: action.value,
          },
        },
      };

    case "SAVE_DOCUMENT": {
      const entry = createActivityEntry(ADMIN_WRITER, "saved the document", action.draft.title);
      return {
        ...state,
        document: { ...action.draft },
        drafts: { ...state.drafts, [action.writerId]: { ...action.draft } },
        activityLog: appendToLog(state.activityLog, entry),
      };
    }

    case "SUBMIT_PROPOSAL": {
      const writer = {
        id: action.writerId,
        name: action.writerName,
        color: action.writerColor,
        lightBg: action.writerLightBg,
        midColor: action.writerMidColor,
      };
      const proposal: ChangeProposal = {
        id: createProposalId(),
        writer,
        draft: { ...action.draft },
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      const entry = createActivityEntry(writer, "submitted changes for review", action.draft.title || action.draft.body);
      return {
        ...state,
        proposals: [proposal, ...state.proposals],
        activityLog: appendToLog(state.activityLog, entry),
      };
    }

    case "ACCEPT_PROPOSAL": {
      const proposal = state.proposals.find((p) => p.id === action.proposalId);
      if (!proposal) return state;
      const accepted: ChangeProposal = { ...proposal, status: "accepted", reviewedAt: new Date().toISOString() };
      const entry = createActivityEntry(ADMIN_WRITER, `accepted ${proposal.writer.name}'s changes`, proposal.draft.title || proposal.draft.body);
      return {
        ...state,
        document: { ...proposal.draft },
        drafts: { ...state.drafts, [proposal.writer.id]: { ...proposal.draft } },
        proposals: state.proposals.map((p) => p.id === action.proposalId ? accepted : p),
        activityLog: appendToLog(state.activityLog, entry),
      };
    }

    case "REJECT_PROPOSAL": {
      const proposal = state.proposals.find((p) => p.id === action.proposalId);
      if (!proposal) return state;
      const rejected: ChangeProposal = { ...proposal, status: "rejected", reviewedAt: new Date().toISOString(), reviewNote: action.note };
      const entry = createActivityEntry(ADMIN_WRITER, `rejected ${proposal.writer.name}'s changes`, action.note ?? "");
      return {
        ...state,
        proposals: state.proposals.map((p) => p.id === action.proposalId ? rejected : p),
        activityLog: appendToLog(state.activityLog, entry),
      };
    }

    case "UPSERT_VIEWER": {
      const existing = state.viewers.find((v) => v.sessionId === action.viewer.sessionId);
      const viewers = existing
        ? state.viewers.map((v) => v.sessionId === action.viewer.sessionId ? action.viewer : v)
        : [...state.viewers, action.viewer];
      return { ...state, viewers };
    }

    case "REMOVE_VIEWER":
      return { ...state, viewers: state.viewers.filter((v) => v.sessionId !== action.sessionId) };

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCollaborativeDocument(documentId: DocumentId, currentUser: SessionUser) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState(documentId));
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [backendReady, setBackendReady] = useState(false);
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(() => getDocumentMetadata(documentId));

  // Check if user is admin based on metadata
  const isAdminByMetadata = useMemo(() => {
    return metadata
      ? metadata.admins.includes(currentUser.sessionId)
      : isUserAdmin(documentId, currentUser.sessionId);
  }, [documentId, metadata, currentUser.sessionId]);
  const isAdmin = isAdminByMetadata || currentUser.permission === "admin";
  const canEdit = currentUser.permission === "edit" || isAdmin;
  const writer = useMemo(() => buildWriterForUser(currentUser), [currentUser]);

  useEffect(() => {
    let cancelled = false;
    setBackendReady(false);

    loadDocumentRecord(documentId)
      .then((record) => {
        if (cancelled) return;
        if (record?.state) {
          dispatch({ type: "SYNC_FROM_STORAGE", payload: record.state });
        }
        if (record?.metadata) {
          const normalized = normalizeDocumentMetadata(record.metadata);
          saveDocumentMetadata(normalized);
          setMetadata(normalized);
        }
      })
      .catch((error) => {
        console.warn("MongoDB document load failed; using browser cache.", error);
      })
      .finally(() => {
        if (!cancelled) {
          setBackendReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // Persist to localStorage (skip viewers — ephemeral)
  useEffect(() => {
    const { viewers: _v, ...persistable } = state;
    try {
      localStorage.setItem(storageKey(documentId), JSON.stringify(persistable));
    } catch (error) {
      console.warn("Browser cache save failed; MongoDB save will still be attempted.", error);
    }
  }, [documentId, state]);

  useEffect(() => {
    if (!backendReady) return;

    const timeout = setTimeout(() => {
      const { viewers: _v, ...persistable } = state;
      saveDocumentRecord(
        documentId,
        { ...persistable, viewers: [] },
        metadata ?? getDocumentMetadata(documentId)
      ).catch((error) => {
        console.warn("MongoDB document save failed; kept browser cache.", error);
      });
    }, 500);

    return () => clearTimeout(timeout);
  }, [backendReady, documentId, metadata, state]);

  // Cross-tab sync via storage events
  useEffect(() => {
    const key = storageKey(documentId);
    const handler = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as DocumentState;
        dispatch({ type: "SYNC_FROM_STORAGE", payload: parsed });
      } catch {}
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [documentId]);

  // Register viewer presence (ping every 30s, remove on unmount)
  useEffect(() => {
    if (!canEdit && !isAdmin) {
      const viewer: ViewerPresence = {
        sessionId: currentUser.sessionId,
        joinedAt: currentUser.joinedAt,
        lastSeen: new Date().toISOString(),
        name: currentUser.name,
      };
      dispatch({ type: "UPSERT_VIEWER", viewer });
      const interval = setInterval(() => {
        dispatch({ type: "UPSERT_VIEWER", viewer: { ...viewer, lastSeen: new Date().toISOString() } });
      }, 30_000);
      return () => {
        clearInterval(interval);
        dispatch({ type: "REMOVE_VIEWER", sessionId: currentUser.sessionId });
      };
    }
  }, [currentUser, canEdit, isAdmin]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const initializeDocument = useCallback((title: string) => {
    dispatch({ type: "INITIALIZE_DOCUMENT", writerId: currentUser.sessionId, title });
    dispatch({ type: "SET_PRESENCE", writerId: currentUser.sessionId, patch: { isTyping: false, activity: "Created document" } });
  }, [currentUser.sessionId]);

  const updateDraft = useCallback((field: "title" | "body", value: string) => {
    if (!canEdit) return;
    dispatch({ type: "UPDATE_DRAFT", writerId: currentUser.sessionId, field, value });
    dispatch({ type: "SET_PRESENCE", writerId: currentUser.sessionId, patch: { isTyping: true, activity: field === "title" ? "Editing title" : "Typing..." } });

    clearTimeout(typingTimers.current[currentUser.sessionId]);
    typingTimers.current[currentUser.sessionId] = setTimeout(() => {
      dispatch({ type: "SET_PRESENCE", writerId: currentUser.sessionId, patch: { isTyping: false, activity: "Idle" } });
    }, 600);
  }, [canEdit, currentUser.sessionId]);

  const setFocusActivity = useCallback((field: "title" | "body") => {
    if (!canEdit) return;
    dispatch({ type: "SET_PRESENCE", writerId: currentUser.sessionId, patch: { activity: field === "title" ? "Editing title" : "Editing body" } });
  }, [canEdit, currentUser.sessionId]);

  const clearFocusActivity = useCallback(() => {
    clearTimeout(typingTimers.current[currentUser.sessionId]);
    dispatch({ type: "SET_PRESENCE", writerId: currentUser.sessionId, patch: { isTyping: false, activity: "Idle" } });
  }, [currentUser.sessionId]);

  const saveDraft = useCallback(() => {
    const draft = state.drafts[currentUser.sessionId] ?? state.document;
    if (isAdmin) {
      dispatch({ type: "SAVE_DOCUMENT", writerId: currentUser.sessionId, draft });
      dispatch({ type: "SET_PRESENCE", writerId: currentUser.sessionId, patch: { isTyping: false, activity: "Saved" } });
      const entry = createActivityEntry(ADMIN_WRITER, "saved the document", draft.title);
      saveDocumentRecord(
        documentId,
        {
          ...state,
          document: { ...draft },
          drafts: { ...state.drafts, [currentUser.sessionId]: { ...draft } },
          viewers: [],
          activityLog: appendToLog(state.activityLog, entry),
        },
        getDocumentMetadata(documentId)
      ).catch((error) => {
        console.warn("MongoDB document save failed; kept browser cache.", error);
      });
    } else if (canEdit) {
      dispatch({
        type: "SUBMIT_PROPOSAL",
        writerId: currentUser.sessionId,
        draft,
        writerName: writer.name,
        writerColor: writer.color,
        writerLightBg: writer.lightBg,
        writerMidColor: writer.midColor,
      });
      dispatch({ type: "SET_PRESENCE", writerId: currentUser.sessionId, patch: { isTyping: false, activity: "Submitted for review" } });
    }
  }, [documentId, state, currentUser.sessionId, isAdmin, canEdit, writer]);

  const acceptProposal = useCallback((proposalId: string) => {
    if (!isAdmin) return;
    dispatch({ type: "ACCEPT_PROPOSAL", proposalId });
  }, [isAdmin]);

  const rejectProposal = useCallback((proposalId: string, note?: string) => {
    if (!isAdmin) return;
    dispatch({ type: "REJECT_PROPOSAL", proposalId, note });
  }, [isAdmin]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (currentUser.permission !== "admin") return;
    const nextMetadata = grantAdminAccess(documentId, currentUser.sessionId, currentUser.name);
    if (nextMetadata) setMetadata(nextMetadata);
  }, [documentId, metadata, currentUser.permission, currentUser.sessionId, currentUser.name]);

  const currentDraft = state.drafts[currentUser.sessionId] ?? { ...state.document };
  const resolvedTitle = state.document.title.trim();
  const wordStats = useMemo(() => ({
    total: countWords(state.document.body),
  }), [state.document]);

  const pendingProposals = useMemo(() =>
    state.proposals.filter((p) => p.status === "pending"), [state.proposals]);

  const viewerCount = state.viewers.length;

  return {
    state,
    currentDraft,
    resolvedTitle,
    wordStats,
    writer,
    isAdmin,
    canEdit,
    pendingProposals,
    viewerCount,
    metadata,
    initializeDocument,
    updateDraft,
    saveDraft,
    acceptProposal,
    rejectProposal,
    setFocusActivity,
    clearFocusActivity,
  };
}
