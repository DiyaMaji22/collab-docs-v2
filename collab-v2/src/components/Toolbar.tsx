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

function getTextArea(targetId: string): HTMLTextAreaElement | null {
  return document.getElementById(targetId) as HTMLTextAreaElement | null;
}

function restoreSelection(
  el: HTMLTextAreaElement,
  start: number,
  end = start
): void {
  requestAnimationFrame(() => {
    el.selectionStart = start;
    el.selectionEnd = end;
    el.focus();
  });
}

function selectedText(el: HTMLTextAreaElement, fallback = "text"): string {
  return el.value.slice(el.selectionStart, el.selectionEnd) || fallback;
}

function replaceSelection(
  el: HTMLTextAreaElement,
  replacement: string,
  selectionStart: number,
  selectionEnd = selectionStart
): string {
  const next =
    el.value.slice(0, el.selectionStart) +
    replacement +
    el.value.slice(el.selectionEnd);
  restoreSelection(el, selectionStart, selectionEnd);
  return next;
}

function lineBounds(value: string, start: number, end: number): [number, number] {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = value.indexOf("\n", end);
  return [lineStart, nextBreak === -1 ? value.length : nextBreak];
}

function updateLines(
  el: HTMLTextAreaElement,
  transform: (line: string, index: number) => string
): string {
  const [start, end] = lineBounds(el.value, el.selectionStart, el.selectionEnd);
  const block = el.value.slice(start, end);
  const nextBlock = block.split("\n").map(transform).join("\n");
  const next = el.value.slice(0, start) + nextBlock + el.value.slice(end);
  restoreSelection(el, start, start + nextBlock.length);
  return next;
}

function wrapSelection(
  el: HTMLTextAreaElement,
  before: string,
  after: string,
  fallback = "text"
): string {
  const start = el.selectionStart;
  const selected = selectedText(el, fallback);
  const replacement = `${before}${selected}${after}`;
  return replaceSelection(
    el,
    replacement,
    start + before.length,
    start + before.length + selected.length
  );
}

function applyHeading(el: HTMLTextAreaElement, level: string): string {
  if (level === "normal") {
    return updateLines(el, (line) => line.replace(/^#{1,3}\s+/, ""));
  }

  const prefix = `${"#".repeat(Number(level))} `;
  return updateLines(el, (line) => `${prefix}${line.replace(/^#{1,3}\s+/, "")}`);
}

function applyList(el: HTMLTextAreaElement, type: "bullet" | "numbered"): string {
  return updateLines(el, (line, index) => {
    const stripped = line.replace(/^(\s*)([-*]|\d+\.)\s+/, "$1");
    return type === "bullet" ? `- ${stripped}` : `${index + 1}. ${stripped}`;
  });
}

function indentLines(el: HTMLTextAreaElement, direction: "in" | "out"): string {
  return updateLines(el, (line) =>
    direction === "in" ? `  ${line}` : line.replace(/^ {1,2}/, "")
  );
}

function alignSelection(
  el: HTMLTextAreaElement,
  alignment: "left" | "center" | "right" | "justify"
): string {
  const selected = selectedText(el, "Aligned text");
  const start = el.selectionStart;
  const replacement = `[align=${alignment}]${selected}[/align]`;
  return replaceSelection(el, replacement, start + replacement.length);
}

function insertParagraph(el: HTMLTextAreaElement): string {
  const start = el.selectionStart;
  return replaceSelection(el, "\n\n", start + 2);
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

  const runTransform = (transform: (el: HTMLTextAreaElement) => string) => {
    const el = getTextArea(targetId);
    if (!el) return;
    pushHistory(history, el.value);
    onTextChange(transform(el));
  };

  const undo = () => {
    const el = getTextArea(targetId);
    const previous = history.current.past[history.current.past.length - 1];
    if (!el || previous === undefined) return;

    history.current = {
      past: history.current.past.slice(0, -1),
      future: [el.value, ...history.current.future],
    };
    onTextChange(previous);
    restoreSelection(el, previous.length);
  };

  const redo = () => {
    const el = getTextArea(targetId);
    const next = history.current.future[0];
    if (!el || next === undefined) return;

    history.current = {
      past: [...history.current.past, el.value].slice(-MAX_HISTORY),
      future: history.current.future.slice(1),
    };
    onTextChange(next);
    restoreSelection(el, next.length);
  };

  return (
    <div className="toolbar docs-toolbar" aria-label="Document formatting">
      <button className="tb-chip" type="button">Menus</button>
      <button className="tb-btn" title="Undo" type="button" onClick={undo}>Undo</button>
      <button className="tb-btn" title="Redo" type="button" onClick={redo}>Redo</button>
      <button className="tb-btn" title="Print" type="button" onClick={() => window.print()}>Print</button>

      <span className="tb-separator" />

      <select
        className="tb-select"
        title="Paragraph style"
        defaultValue="normal"
        onChange={(event) => runTransform((el) => applyHeading(el, event.target.value))}
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
        onChange={(event) =>
          runTransform((el) =>
            wrapSelection(el, `{font=${event.target.value}}`, "{/font}")
          )
        }
      >
        {FONT_OPTIONS.map((font) => (
          <option key={font} value={font}>{font}</option>
        ))}
      </select>

      <button
        className="tb-btn"
        title="Decrease font size"
        type="button"
        onClick={() => {
          const next = String(Math.max(8, Number(fontSize) - 1));
          setFontSize(next);
          runTransform((el) => wrapSelection(el, `{size=${next}}`, "{/size}"));
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
          runTransform((el) => wrapSelection(el, `{size=${event.target.value}}`, "{/size}"));
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
        onClick={() => {
          const next = String(Math.min(96, Number(fontSize) + 1));
          setFontSize(next);
          runTransform((el) => wrapSelection(el, `{size=${next}}`, "{/size}"));
        }}
      >
        +
      </button>

      <span className="tb-separator" />

      <button className="tb-btn strong" title="Bold" type="button" onClick={() => runTransform((el) => wrapSelection(el, "**", "**"))}>B</button>
      <button className="tb-btn italic" title="Italic" type="button" onClick={() => runTransform((el) => wrapSelection(el, "_", "_"))}>I</button>
      <button className="tb-btn underline" title="Underline" type="button" onClick={() => runTransform((el) => wrapSelection(el, "__", "__"))}>U</button>

      <select
        className="tb-color"
        title="Text color"
        defaultValue="#111827"
        onChange={(event) => runTransform((el) => wrapSelection(el, `{color=${event.target.value}}`, "{/color}"))}
      >
        {COLOR_OPTIONS.map((color) => (
          <option key={color} value={color}>{color}</option>
        ))}
      </select>

      <select
        className="tb-color"
        title="Highlight"
        defaultValue="#fef3c7"
        onChange={(event) => runTransform((el) => wrapSelection(el, `{mark=${event.target.value}}`, "{/mark}"))}
      >
        {HIGHLIGHT_OPTIONS.map((color) => (
          <option key={color} value={color}>{color}</option>
        ))}
      </select>

      <span className="tb-separator" />

      <button className="tb-btn" title="Insert link" type="button" onClick={() => runTransform((el) => wrapSelection(el, "[", "](https://example.com)", "link"))}>Link</button>
      <button className="tb-btn" title="Insert image" type="button" onClick={() => runTransform((el) => wrapSelection(el, "![", "](https://example.com/image.png)", "image"))}>Image</button>
      <button className="tb-btn" title="Paragraph break" type="button" onClick={() => runTransform(insertParagraph)}>Para</button>

      <span className="tb-separator" />

      <button className="tb-btn" title="Align left" type="button" onClick={() => runTransform((el) => alignSelection(el, "left"))}>Left</button>
      <button className="tb-btn" title="Align center" type="button" onClick={() => runTransform((el) => alignSelection(el, "center"))}>Center</button>
      <button className="tb-btn" title="Align right" type="button" onClick={() => runTransform((el) => alignSelection(el, "right"))}>Right</button>
      <button className="tb-btn" title="Justify" type="button" onClick={() => runTransform((el) => alignSelection(el, "justify"))}>Justify</button>
      <button className="tb-btn" title="Bulleted list" type="button" onClick={() => runTransform((el) => applyList(el, "bullet"))}>Bullets</button>
      <button className="tb-btn" title="Numbered list" type="button" onClick={() => runTransform((el) => applyList(el, "numbered"))}>Numbers</button>
      <button className="tb-btn" title="Decrease indent" type="button" onClick={() => runTransform((el) => indentLines(el, "out"))}>Outdent</button>
      <button className="tb-btn" title="Increase indent" type="button" onClick={() => runTransform((el) => indentLines(el, "in"))}>Indent</button>
    </div>
  );
};
