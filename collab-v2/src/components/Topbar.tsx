import React from "react";
import type { SessionUser } from "../types";

interface TopbarProps {
  currentUser: SessionUser;
  resolvedTitle: string;
  viewerCount: number;
  pendingCount: number;
  onShare: () => void;
}

const MENUS = ["File", "Edit", "View", "Insert", "Format", "Tools", "Help"];

const PERMISSION_LABELS: Record<string, string> = {
  admin: "Admin",
  edit: "Editor",
  view: "Viewer",
};

const PERMISSION_COLORS: Record<string, string> = {
  admin: "#2563eb",
  edit: "#0f766e",
  view: "#64748b",
};

export const Topbar: React.FC<TopbarProps> = ({
  currentUser,
  resolvedTitle,
  viewerCount,
  pendingCount,
  onShare,
}) => {
  const [menuStatus, setMenuStatus] = React.useState("Ready");
  const [saveFeedback, setSaveFeedback] = React.useState<"idle" | "saved">("idle");

  const handlePrint = () => window.print();

  return (
    <header className="topbar" role="banner">
      <div className="docs-title-row">
        <div className="logo" aria-label="Collab Docs">D</div>

        <div className="title-stack">
          <div className="title-line">
            <input
              className="doc-title-input"
              value={resolvedTitle || "Untitled Document"}
              readOnly
              aria-label="Document title"
            />
            <button className="icon-btn" title="Print" type="button" onClick={handlePrint}>🖨</button>
            <button
              className="icon-btn"
              title="Saved to browser"
              type="button"
              onClick={() => { setSaveFeedback("saved"); setTimeout(() => setSaveFeedback("idle"), 1500); }}
            >
              {saveFeedback === "saved" ? "✓" : "☁"}
            </button>
          </div>
          <nav className="menu-row" aria-label="Document menus">
            {MENUS.map((menu) => (
              <button
                className="menu-btn"
                key={menu}
                type="button"
                onClick={() => setMenuStatus(`${menu} selected`)}
              >
                {menu}
              </button>
            ))}
          </nav>
        </div>

        <div className="topbar-spacer" />

        <div className="header-actions">
          <span className="menu-status">{menuStatus}</span>

          {/* Viewer count pill — always visible */}
          <div className="viewer-pill" title="People currently viewing">
            <span className="viewer-dot" />
            {viewerCount} viewing
          </div>

          {/* Pending changes badge */}
          {pendingCount > 0 && (
            <div className="pending-pill" title="Pending changes waiting for review">
              {pendingCount} pending
            </div>
          )}

          {/* Current user badge */}
          <div
            className="user-badge"
            title={`You are ${currentUser.name} (${currentUser.permission})`}
            style={{
              background: `${PERMISSION_COLORS[currentUser.permission]}18`,
              color: PERMISSION_COLORS[currentUser.permission],
              border: `1px solid ${PERMISSION_COLORS[currentUser.permission]}44`,
            }}
          >
            <span
              className="user-badge-dot"
              style={{ background: PERMISSION_COLORS[currentUser.permission] }}
            />
            {currentUser.name}
            <span className="user-you-label">{PERMISSION_LABELS[currentUser.permission]}</span>
          </div>

          <button className="share-btn" type="button" onClick={onShare}>
            Share
          </button>
        </div>
      </div>
    </header>
  );
};
