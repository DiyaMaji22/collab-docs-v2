import React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import type { Writer, WriterDraft, WriterPresence } from "../types";
import { addToCustomDictionary, getSpellingSuggestions, getWordAtPoint } from "../utils/spellcheck";

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

const IMAGE_BOX_WIDTH = 420;
const IMAGE_BOX_HEIGHT = 260;

type SpellMenuState = {
  x: number;
  y: number;
  word: string;
  suggestions: string[];
  range: Range;
} | null;

function resizeImageDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = IMAGE_BOX_WIDTH;
      canvas.height = IMAGE_BOX_HEIGHT;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not resize pasted image"));
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const x = (canvas.width - width) / 2;
      const y = (canvas.height - height) / 2;

      ctx.drawImage(image, x, y, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };
    image.onerror = () => reject(new Error("Could not load pasted image"));
    image.src = src;
  });
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
  const [spellMenu, setSpellMenu] = React.useState<SpellMenuState>(null);
  const editor = useEditor({
    extensions: [
      StarterKit,
      ImageExtension,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: draft.body,
    editorProps: {
      attributes: {
        class: "ep-input rich-editor",
        "data-placeholder": isAdmin ? "Write your document here..." : "Write your contribution here...",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onUpdate("body", activeEditor.getHTML());
    },
    onFocus: () => onFocus("body"),
    onBlur,
  });

  React.useEffect(() => {
    if (!editor || editor.isFocused || editor.getHTML() === draft.body) return;
    editor.commands.setContent(draft.body, { emitUpdate: false });
  }, [draft.body, editor]);

  const closeSpellMenu = React.useCallback(() => setSpellMenu(null), []);

  React.useEffect(() => {
    if (!spellMenu) return;
    window.addEventListener("click", closeSpellMenu);
    window.addEventListener("scroll", closeSpellMenu, true);
    return () => {
      window.removeEventListener("click", closeSpellMenu);
      window.removeEventListener("scroll", closeSpellMenu, true);
    };
  }, [closeSpellMenu, spellMenu]);

  const replaceRange = React.useCallback((range: Range, value: string) => {
    range.deleteContents();
    range.insertNode(document.createTextNode(value));
    if (editor) onUpdate("body", editor.getHTML());
    closeSpellMenu();
  }, [closeSpellMenu, editor, onUpdate]);

  const handleContextMenu = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const wordAtPoint = getWordAtPoint(event.clientX, event.clientY);
    if (!wordAtPoint) {
      closeSpellMenu();
      return;
    }

    const suggestions = getSpellingSuggestions(wordAtPoint.word);
    if (suggestions.length === 0) {
      closeSpellMenu();
      return;
    }

    event.preventDefault();
    setSpellMenu({
      x: event.clientX,
      y: event.clientY,
      word: wordAtPoint.word,
      range: wordAtPoint.range,
      suggestions,
    });
  }, [closeSpellMenu]);

  const insertImage = React.useCallback((src: string) => {
    editor?.chain().focus().setImage({ src, alt: "Pasted image" }).run();
  }, [editor]);

  const handlePaste = React.useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        try {
          insertImage(await resizeImageDataUrl(reader.result));
        } catch {
          insertImage(reader.result);
        }
      }
    };
    reader.readAsDataURL(file);
  }, [insertImage]);

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
        <div className="toolbar docs-toolbar">
          <button className="tb-btn strong" type="button" onClick={() => editor?.chain().focus().toggleBold().run()}>B</button>
          <button className="tb-btn italic" type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}>I</button>
          <button className="tb-btn underline" type="button" onClick={() => editor?.chain().focus().toggleStrike().run()}>S</button>
          <span className="tb-separator" />
          <button className="tb-btn" type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
          <button className="tb-btn" type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
          <button className="tb-btn" type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()}>List</button>
          <span className="tb-separator" />
          <button className="tb-btn" type="button" onClick={() => editor?.chain().focus().setTextAlign("left").run()}>Left</button>
          <button className="tb-btn" type="button" onClick={() => editor?.chain().focus().setTextAlign("center").run()}>Center</button>
          <button className="tb-btn" type="button" onClick={() => editor?.chain().focus().setTextAlign("right").run()}>Right</button>
          <input className="tb-color" type="color" title="Text color" onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()} />
          <button className="tb-chip" type="button" onClick={() => editor?.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}>Mark</button>
        </div>
        <div className="ep-label">Body</div>
        <div onContextMenu={handleContextMenu} onPaste={handlePaste} style={{ "--focus-color": writer.color } as React.CSSProperties}>
          <EditorContent editor={editor} />
        </div>
        {spellMenu && (
          <div
            className="spell-menu"
            style={{ left: spellMenu.x, top: spellMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="spell-menu-title">Spelling</div>
            {spellMenu.suggestions.map((suggestion) => (
              <button
                className="spell-menu-item"
                key={suggestion}
                type="button"
                onClick={() => replaceRange(spellMenu.range, suggestion)}
              >
                {suggestion}
              </button>
            ))}
            <button
              className="spell-menu-item muted"
              type="button"
              onClick={() => {
                addToCustomDictionary(spellMenu.word);
                closeSpellMenu();
              }}
            >
              Add to dictionary
            </button>
          </div>
        )}
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
