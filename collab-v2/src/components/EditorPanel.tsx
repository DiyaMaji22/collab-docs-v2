import React from "react";
import { Toolbar } from "./Toolbar";
import type { Writer, WriterDraft, WriterPresence } from "../types";

interface EditorPanelProps {
  writer: Writer;
  draft: WriterDraft;
  presence: WriterPresence;
  isAdmin: boolean;
  saveLabel: string;
  onUpdate: (field: "title" | "body", value: string) => void;
  onSave: () => void;
  onFocus: (field: "title" | "body") => void;
  onBlur: () => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = React.memo(({
  writer,
  draft,
  presence,
  isAdmin,
  saveLabel,
  onUpdate,
  onSave,
  onFocus,
  onBlur,
}) => {
  const bodyId = `editor-body-${writer.id}`;

  return (
    <div className="editor-panel">
      <div className="ep-header">
        <span className="ep-dot" style={{ background: writer.color }} />
        <span className="ep-name" style={{ color: writer.color }}>
          {writer.name}
          {isAdmin && <span className="role-label" style={{ marginLeft: 6 }}>Admin</span>}
        </span>
        <span className="ep-status">{presence.activity}</span>
        {presence.isTyping && (
          <span
            className="ep-typing"
            style={{ background: writer.color }}
            aria-label="Typing"
          />
        )}
      </div>

      <div className="ep-field">
        <div className="ep-label">Title</div>
        <input
          className="ep-input"
          type="text"
          value={draft.title}
          placeholder="Document title…"
          autoComplete="off"
          onChange={(e) => onUpdate("title", e.target.value)}
          onFocus={() => onFocus("title")}
          onBlur={onBlur}
          style={{ "--focus-color": writer.color } as React.CSSProperties}
        />
      </div>

      <div className="ep-field">
        <Toolbar
          targetId={bodyId}
          onTextChange={(val) => onUpdate("body", val)}
        />
        <div className="ep-label">Body</div>
        <textarea
          id={bodyId}
          className="ep-input"
          value={draft.body}
          placeholder={isAdmin ? "Write your document here…" : "Write your contribution here…"}
          onChange={(e) => onUpdate("body", e.target.value)}
          onFocus={() => onFocus("body")}
          onBlur={onBlur}
          style={{ "--focus-color": writer.color } as React.CSSProperties}
        />
      </div>

      <button
        className="save-draft-btn"
        style={{ background: writer.color }}
        type="button"
        onClick={onSave}
      >
        {saveLabel}
      </button>
    </div>
  );
});

EditorPanel.displayName = "EditorPanel";
