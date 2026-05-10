import React from "react";
import type { ViewerPresence, WordStats, WriterPresence } from "../types";

interface CollaboratorsPanelProps {
  isAdmin: boolean;
  presence: Record<string, WriterPresence>;
  viewers: ViewerPresence[];
  viewerCount: number;
  wordStats: WordStats;
}

const StatCard: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="stat-card">
    <div className="stat-num">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
);

export const CollaboratorsPanel: React.FC<CollaboratorsPanelProps> = React.memo(({
  isAdmin,
  presence,
  viewers,
  viewerCount,
  wordStats,
}) => {
  const activeEditors = Object.entries(presence).filter(([, p]) => p.activity !== "Idle");

  return (
    <div>
      {/* Active editors */}
      <div className="panel-section">
        <div className="panel-label">Active editors</div>
        <div className="collab-list">
          {activeEditors.length === 0 ? (
            <span className="empty-hint" style={{ fontSize: 12 }}>No active editors.</span>
          ) : (
            activeEditors.map(([id, p]) => (
              <div className="collab-item" key={id}>
                <div
                  className="collab-avatar"
                  style={{ background: "#eff6ff", color: "#2563eb" }}
                >
                  ✎
                </div>
                <div className="collab-info">
                  <div className="collab-name">Editor</div>
                  <div className="collab-state">{p.activity}</div>
                </div>
                <div className="online-ring" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Viewer count — always shown */}
      <div className="panel-section">
        <div className="panel-label">Viewers</div>
        <div className="viewer-count-display">
          <span className="viewer-dot pulse" />
          <span className="viewer-count-num">{viewerCount}</span>
          <span className="viewer-count-label">
            {viewerCount === 1 ? "person" : "people"} viewing
          </span>
        </div>

        {/* Admin sees actual names */}
        {isAdmin && viewers.length > 0 && (
          <div className="admin-viewer-list">
            <div className="admin-viewer-heading">Identities (admin only)</div>
            {viewers.map((v) => (
              <div className="admin-viewer-row" key={v.sessionId}>
                <span className="admin-viewer-dot" />
                <span className="admin-viewer-name">{v.name}</span>
                <span className="admin-viewer-time">
                  {new Date(v.joinedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Non-admin sees anonymised count only */}
        {!isAdmin && (
          <p className="viewer-anon-note">Viewer identities are hidden from contributors.</p>
        )}
      </div>

      {/* Stats */}
      <div className="panel-section">
        <div className="panel-label">Document stats</div>
        <div className="stats-grid">
          <StatCard value={wordStats.total} label="Words" />
        </div>
      </div>
    </div>
  );
});

CollaboratorsPanel.displayName = "CollaboratorsPanel";
