// ─── Permission system ────────────────────────────────────────────────────────

export type Permission = "view" | "comment" | "edit" | "admin";

export interface SessionUser {
  sessionId: string;
  permission: Permission;
  joinedAt: string;
  name: string;
  isAnonymous: boolean;
}

// ─── Core writers ─────────────────────────────────────────────────────────────

export type WriterId = string;

export interface Writer {
  id: WriterId;
  name: string;
  color: string;
  lightBg: string;
  midColor: string;
}

export interface WriterDraft {
  title: string;
  body: string;
}

// ─── Proposals ────────────────────────────────────────────────────────────────

export type ProposalStatus = "pending" | "accepted" | "rejected";

export interface ChangeProposal {
  id: string;
  writer: Writer;
  draft: WriterDraft;
  createdAt: string;
  status: ProposalStatus;
  reviewedAt?: string;
  reviewNote?: string;
}

// ─── Presence & activity ──────────────────────────────────────────────────────

export interface WriterPresence {
  isTyping: boolean;
  activity: string;
}

export interface ViewerPresence {
  sessionId: string;
  joinedAt: string;
  lastSeen: string;
  name: string;
}

export interface ActivityEntry {
  id: number;
  writer: Writer;
  action: string;
  preview: string;
  time: string;
}

// ─── Document metadata ───────────────────────────────────────────────────────

export interface DocumentMetadata {
  documentId: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  admins: string[]; // List of session IDs that have admin access
  adminMembers?: AdminMember[];
}

export interface AdminMember {
  sessionId: string;
  name: string;
  joinedAt: string;
  isCreator?: boolean;
}

// ─── Document state ───────────────────────────────────────────────────────────

export interface DocumentState {
  document: WriterDraft;
  drafts: Record<WriterId, WriterDraft>;
  proposals: ChangeProposal[];
  presence: Record<WriterId, WriterPresence>;
  viewers: ViewerPresence[];
  activityLog: ActivityEntry[];
  metadata?: DocumentMetadata;
}

export interface WordStats {
  total: number;
}

export interface ShareConfig {
  viewLink: string;
  editLink: string;
  adminLink: string;
}
