import React from "react";
import type { ChangeProposal } from "../types";
import { truncate } from "../utils/text";

interface PendingChangesProps {
  proposals: ChangeProposal[];
  onAccept: (id: string) => void;
  onReject: (id: string, note?: string) => void;
}

export const PendingChanges: React.FC<PendingChangesProps> = React.memo(({
  proposals,
  onAccept,
  onReject,
}) => {
  const [rejectNote, setRejectNote] = React.useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = React.useState<string | null>(null);

  const handleReject = (id: string) => {
    onReject(id, rejectNote[id] ?? "");
    setRejectOpen(null);
    setRejectNote((n) => { const next = { ...n }; delete next[id]; return next; });
  };

  return (
    <div className="panel-section">
      <div className="panel-label">
        Pending changes
        {proposals.length > 0 && (
          <span className="pending-badge">{proposals.length}</span>
        )}
      </div>
      <div className="review-list">
        {proposals.length === 0 ? (
          <span className="empty-hint" style={{ fontSize: 12 }}>
            No changes waiting for review.
          </span>
        ) : (
          proposals.map((proposal) => (
            <div className="review-item" key={proposal.id}>
              <div className="review-header">
                <span
                  className="act-dot"
                  style={{ background: proposal.writer.color }}
                  aria-hidden="true"
                />
                <strong style={{ color: proposal.writer.color }}>{proposal.writer.name}</strong>
                <span className="review-time">
                  {new Date(proposal.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {proposal.draft.title && (
                <div className="review-field-label">Title: <em>{truncate(proposal.draft.title, 50)}</em></div>
              )}

              <div className="review-preview">
                {truncate(proposal.draft.body || proposal.draft.title, 100)}
              </div>

              {rejectOpen === proposal.id ? (
                <div className="reject-form">
                  <input
                    className="reject-input"
                    type="text"
                    placeholder="Reason (optional)"
                    value={rejectNote[proposal.id] ?? ""}
                    onChange={(e) => setRejectNote((n) => ({ ...n, [proposal.id]: e.target.value }))}
                    autoFocus
                  />
                  <div className="review-actions">
                    <button className="review-btn reject" type="button" onClick={() => handleReject(proposal.id)}>
                      Confirm reject
                    </button>
                    <button className="review-btn cancel" type="button" onClick={() => setRejectOpen(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="review-actions">
                  <button
                    className="review-btn accept"
                    type="button"
                    onClick={() => onAccept(proposal.id)}
                  >
                    ✓ Accept
                  </button>
                  <button
                    className="review-btn reject"
                    type="button"
                    onClick={() => setRejectOpen(proposal.id)}
                  >
                    ✕ Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
});

PendingChanges.displayName = "PendingChanges";
