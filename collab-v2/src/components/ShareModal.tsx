import React from "react";
import type { ShareConfig, DocumentMetadata } from "../types";

interface ShareModalProps {
  shareLinks: ShareConfig;
  onClose: () => void;
  isAdmin?: boolean;
  metadata?: DocumentMetadata | null;
}

type CopyState = Record<string, "idle" | "copied">;

export const ShareModal: React.FC<ShareModalProps> = ({ 
  shareLinks, 
  onClose,
  isAdmin = false,
  metadata,
}) => {
  const [copyState, setCopyState] = React.useState<CopyState>({});
  const admins = metadata?.adminMembers ?? [];

  const copy = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopyState((s) => ({ ...s, [key]: "copied" }));
    setTimeout(() => setCopyState((s) => ({ ...s, [key]: "idle" })), 1800);
  };

  const links = [
    {
      key: "view",
      label: "View only",
      description: "Recipients can read but not edit. Identity stays hidden from contributors.",
      url: shareLinks.viewLink,
      badge: "View",
      badgeColor: "#64748b",
    },
    {
      key: "edit",
      label: "Contributor",
      description: "Recipients can submit changes for admin review.",
      url: shareLinks.editLink,
      badge: "Edit",
      badgeColor: "#0f766e",
    },
    {
      key: "admin",
      label: "Admin",
      description: "Full access — can save directly, accept/reject changes, and see all identities. Share carefully.",
      url: shareLinks.adminLink,
      badge: "Admin",
      badgeColor: "#2563eb",
    },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Share document</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p className="modal-subtitle">
          Choose a link based on what you want recipients to be able to do.
          Viewer identities are hidden from contributors — only admins can see who is viewing.
        </p>

        <div className="share-links">
          {links.map(({ key, label, description, url, badge, badgeColor }) => (
            <div className="share-link-row" key={key}>
              <div className="share-link-info">
                <div className="share-link-label">
                  <span
                    className="share-link-badge"
                    style={{ background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}33` }}
                  >
                    {badge}
                  </span>
                  {label}
                </div>
                <div className="share-link-desc">{description}</div>
                <div className="share-link-url">{url.slice(0, 60)}{url.length > 60 ? "…" : ""}</div>
              </div>
              <button
                className={`copy-btn${copyState[key] === "copied" ? " copied" : ""}`}
                type="button"
                onClick={() => copy(key, url)}
              >
                {copyState[key] === "copied" ? "✓ Copied" : "Copy link"}
              </button>
            </div>
          ))}
        </div>

        {isAdmin && metadata && (
          <div className="admin-section">
            <hr className="modal-divider" />
            <h3 className="admin-section-title">Admin Management</h3>
            
            <div className="admin-info">
              <p className="admin-info-label">Document creator: <strong>{metadata.creatorName}</strong></p>
              <p className="admin-info-text">
                Current admins: <strong>{metadata.admins.length}</strong>
              </p>
              {admins.length > 0 && (
                <div className="admin-member-list">
                  {admins.map((admin) => (
                    <div className="admin-member-row" key={admin.sessionId}>
                      <span className="admin-member-avatar">{admin.name.slice(0, 1).toUpperCase()}</span>
                      <span className="admin-member-name">{admin.name}</span>
                      {admin.isCreator && <span className="admin-member-badge">Creator</span>}
                    </div>
                  ))}
                </div>
              )}
              <p className="admin-info-note">
                Tip: Share the Admin link above with people you want to make admin. They'll join as admins automatically.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
