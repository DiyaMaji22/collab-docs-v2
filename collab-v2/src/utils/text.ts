export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function countWords(text: string): number {
  const trimmed = text.replace(/<[^>]*>/g, " ").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function sanitizeStyleValue(value: string): string {
  return value.replace(/[^#(),.%\w\s-]/g, "");
}

function isAllowedImageSource(value: string): boolean {
  return /^https?:\/\//.test(value) || /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(value);
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

  if (!line.trim()) {
    return "<br>";
  }

  return `<p>${formatInline(line)}</p>`;
}

function hasHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

function sanitizeRichHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowedTags = new Set([
    "A",
    "B",
    "BR",
    "DIV",
    "EM",
    "H1",
    "H2",
    "H3",
    "I",
    "IMG",
    "LI",
    "OL",
    "P",
    "SPAN",
    "STRONG",
    "U",
    "UL",
  ]);

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as HTMLElement;
    if (!allowedTags.has(element.tagName)) {
      const fragment = document.createDocumentFragment();
      element.childNodes.forEach((child) => {
        const cleaned = cleanNode(child);
        if (cleaned) fragment.appendChild(cleaned);
      });
      return fragment;
    }

    if (element.tagName === "UL" || element.tagName === "OL") {
      const fragment = document.createDocumentFragment();
      element.childNodes.forEach((child) => {
        const cleaned = cleanNode(child);
        if (cleaned) fragment.appendChild(cleaned);
      });
      return fragment;
    }

    if (element.tagName === "LI" && !element.textContent?.trim() && !element.querySelector("img")) {
      return null;
    }

    const clone = document.createElement(element.tagName === "LI" ? "div" : element.tagName.toLowerCase());
    if (element.tagName === "A") {
      const href = element.getAttribute("href") ?? "";
      if (/^https?:\/\//.test(href)) {
        clone.setAttribute("href", href);
        clone.setAttribute("target", "_blank");
        clone.setAttribute("rel", "noreferrer");
      }
    }
    if (element.tagName === "IMG") {
      const src = element.getAttribute("src") ?? "";
      if (isAllowedImageSource(src)) {
        clone.setAttribute("src", src);
        clone.setAttribute("alt", element.getAttribute("alt") ?? "");
        clone.className = "doc-image";
      }
    }
    if (element.style.textAlign) {
      clone.style.textAlign = sanitizeStyleValue(element.style.textAlign);
    }

    element.childNodes.forEach((child) => {
      const cleaned = cleanNode(child);
      if (cleaned) clone.appendChild(cleaned);
    });

    return clone;
  };

  const cleaned = document.createDocumentFragment();
  template.content.childNodes.forEach((child) => {
    const node = cleanNode(child);
    if (node) cleaned.appendChild(node);
  });

  const wrapper = document.createElement("div");
  wrapper.appendChild(cleaned);
  return wrapper.innerHTML;
}

export function sanitizeDocumentBody(html: string): string {
  return sanitizeRichHtml(html);
}

export function formatBodyText(text: string): string {
  if (hasHtml(text)) {
    return sanitizeRichHtml(text);
  }

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
