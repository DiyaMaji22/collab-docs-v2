import React from "react";

interface ToolbarProps {
  targetId: string;
  onTextChange: (value: string) => void;
}

type HistoryState = {
  past: string[];
  future: string[];
};

const MAX_HISTORY = 40;
const FONT_OPTIONS = ["Arial", "Georgia", "Courier New", "Times New Roman"];
const SIZE_OPTIONS = ["12", "14", "16", "18", "20", "24", "32"];
const COLOR_OPTIONS = ["#111827", "#2563eb", "#0f766e", "#dc2626", "#9333ea"];
const HIGHLIGHT_OPTIONS = ["#fef3c7", "#dbeafe", "#dcfce7", "#fee2e2"];

function getEditor(targetId: string): HTMLElement | null {
  return document.getElementById(targetId);
}

function keepEditorSelection(event: React.MouseEvent<HTMLButtonElement>): void {
  event.preventDefault();
}

function pushHistory(history: React.MutableRefObject<HistoryState>, value: string) {
  history.current = {
    past: [...history.current.past, value].slice(-MAX_HISTORY),
    future: [],
  };
}

export const Toolbar: React.FC<ToolbarProps> = ({ targetId, onTextChange }) => {
  const history = React.useRef<HistoryState>({ past: [], future: [] });
  const [fontSize, setFontSize] = React.useState("16");

  const runCommand = (command: string, value?: string) => {
    const editor = getEditor(targetId);
    if (!editor) return;

    pushHistory(history, editor.innerHTML);
    editor.focus();
    document.execCommand(command, false, value);
    onTextChange(editor.innerHTML);
  };

  const undo = () => {
    const editor = getEditor(targetId);
    const previous = history.current.past[history.current.past.length - 1];
    if (!editor || previous === undefined) return;

    history.current = {
      past: history.current.past.slice(0, -1),
      future: [editor.innerHTML, ...history.current.future],
    };
    editor.innerHTML = previous;
    onTextChange(previous);
    editor.focus();
  };

  const redo = () => {
    const editor = getEditor(targetId);
    const next = history.current.future[0];
    if (!editor || next === undefined) return;

    history.current = {
      past: [...history.current.past, editor.innerHTML].slice(-MAX_HISTORY),
      future: history.current.future.slice(1),
    };
    editor.innerHTML = next;
    onTextChange(next);
    editor.focus();
  };

  return (
    <div className="toolbar docs-toolbar" aria-label="Document formatting">
      <button className="tb-chip" type="button" onMouseDown={keepEditorSelection}>Menus</button>
      <button className="tb-btn" title="Undo" type="button" onMouseDown={keepEditorSelection} onClick={undo}>Undo</button>
      <button className="tb-btn" title="Redo" type="button" onMouseDown={keepEditorSelection} onClick={redo}>Redo</button>
      <button className="tb-btn" title="Print" type="button" onMouseDown={keepEditorSelection} onClick={() => window.print()}>Print</button>

      <span className="tb-separator" />

      <select
        className="tb-select"
        title="Paragraph style"
        defaultValue="normal"
        onChange={(event) => runCommand("formatBlock", event.target.value === "normal" ? "p" : `h${event.target.value}`)}
      >
        <option value="normal">Normal text</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>

      <select
        className="tb-select"
        title="Font"
        defaultValue="Arial"
        onChange={(event) => runCommand("fontName", event.target.value)}
      >
        {FONT_OPTIONS.map((font) => (
          <option key={font} value={font}>{font}</option>
        ))}
      </select>

      <button
        className="tb-btn"
        title="Decrease font size"
        type="button"
        onMouseDown={keepEditorSelection}
        onClick={() => {
          const next = String(Math.max(8, Number(fontSize) - 1));
          setFontSize(next);
          runCommand("fontSize", "3");
        }}
      >
        -
      </button>
      <select
        className="tb-size"
        title="Font size"
        value={fontSize}
        onChange={(event) => {
          setFontSize(event.target.value);
          runCommand("fontSize", "3");
        }}
      >
        {SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>
      <button
        className="tb-btn"
        title="Increase font size"
        type="button"
        onMouseDown={keepEditorSelection}
        onClick={() => {
          const next = String(Math.min(96, Number(fontSize) + 1));
          setFontSize(next);
          runCommand("fontSize", "4");
        }}
      >
        +
      </button>

      <span className="tb-separator" />

      <button className="tb-btn strong" title="Bold" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("bold")}>B</button>
      <button className="tb-btn italic" title="Italic" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("italic")}>I</button>
      <button className="tb-btn underline" title="Underline" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("underline")}>U</button>

      <select
        className="tb-color"
        title="Text color"
        defaultValue="#111827"
        onChange={(event) => runCommand("foreColor", event.target.value)}
      >
        {COLOR_OPTIONS.map((color) => (
          <option key={color} value={color}>{color}</option>
        ))}
      </select>

      <select
        className="tb-color"
        title="Highlight"
        defaultValue="#fef3c7"
        onChange={(event) => runCommand("hiliteColor", event.target.value)}
      >
        {HIGHLIGHT_OPTIONS.map((color) => (
          <option key={color} value={color}>{color}</option>
        ))}
      </select>

      <span className="tb-separator" />

      <button className="tb-btn" title="Insert link" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("createLink", "https://example.com")}>Link</button>
      <button className="tb-btn" title="Insert image" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("insertImage", "https://example.com/image.png")}>Image</button>
      <button className="tb-btn" title="Paragraph break" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("insertParagraph")}>Para</button>

      <span className="tb-separator" />

      <button className="tb-btn" title="Align left" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("justifyLeft")}>Left</button>
      <button className="tb-btn" title="Align center" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("justifyCenter")}>Center</button>
      <button className="tb-btn" title="Align right" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("justifyRight")}>Right</button>
      <button className="tb-btn" title="Justify" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("justifyFull")}>Justify</button>
      <button className="tb-btn" title="Bulleted list" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("insertUnorderedList")}>Bullets</button>
      <button className="tb-btn" title="Numbered list" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("insertOrderedList")}>Numbers</button>
      <button className="tb-btn" title="Decrease indent" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("outdent")}>Outdent</button>
      <button className="tb-btn" title="Increase indent" type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("indent")}>Indent</button>
    </div>
  );
};
