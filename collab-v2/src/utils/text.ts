export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function sanitizeStyleValue(value: string): string {
  return value.replace(/[^#(),.%\w\s-]/g, "");
}

function formatInline(text: string): string {
  return escapeHtml(text)
    .replace(/!\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, alt, url) => {
      return `<img class="doc-image" src="${url}" alt="${alt}" />`;
    })
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label, url) => {
      return `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
    })
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.*?)__/g, "<u>$1</u>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/\{color=([^}]+)\}(.*?)\{\/color\}/g, (_match, color, content) => {
      return `<span style="color:${sanitizeStyleValue(color)}">${content}</span>`;
    })
    .replace(/\{mark=([^}]+)\}(.*?)\{\/mark\}/g, (_match, color, content) => {
      return `<mark style="background:${sanitizeStyleValue(color)}">${content}</mark>`;
    })
    .replace(/\{font=([^}]+)\}(.*?)\{\/font\}/g, (_match, font, content) => {
      return `<span style="font-family:${sanitizeStyleValue(font)}">${content}</span>`;
    })
    .replace(/\{size=(\d{1,2})\}(.*?)\{\/size\}/g, (_match, size, content) => {
      return `<span style="font-size:${size}px">${content}</span>`;
    });
}

function formatLine(line: string): string {
  const alignMatch = line.match(/^\[align=(left|center|right|justify)\](.*)\[\/align\]$/);
  if (alignMatch) {
    return `<p style="text-align:${alignMatch[1]}">${formatInline(alignMatch[2])}</p>`;
  }

  if (/^###\s+/.test(line)) {
    return `<h3>${formatInline(line.replace(/^###\s+/, ""))}</h3>`;
  }

  if (/^##\s+/.test(line)) {
    return `<h2>${formatInline(line.replace(/^##\s+/, ""))}</h2>`;
  }

  if (/^#\s+/.test(line)) {
    return `<h1>${formatInline(line.replace(/^#\s+/, ""))}</h1>`;
  }

  if (/^\s*[-*]\s+/.test(line)) {
    const indent = line.match(/^ */)?.[0].length ?? 0;
    return `<div class="doc-list-line" style="margin-left:${indent * 8}px">• ${formatInline(
      line.replace(/^\s*[-*]\s+/, "")
    )}</div>`;
  }

  if (/^\s*\d+\.\s+/.test(line)) {
    const indent = line.match(/^ */)?.[0].length ?? 0;
    return `<div class="doc-list-line" style="margin-left:${indent * 8}px">${formatInline(
      line.trim()
    )}</div>`;
  }

  if (!line.trim()) {
    return "<br>";
  }

  return `<p>${formatInline(line)}</p>`;
}

export function formatBodyText(text: string): string {
  return text.split("\n").map(formatLine).join("");
}

export function truncate(text: string, maxLength = 38): string {
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
