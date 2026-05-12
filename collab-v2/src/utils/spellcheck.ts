const DICTIONARY_KEY = "collab-custom-dictionary-v1";

const CORRECTIONS: Record<string, string[]> = {
  accomodate: ["accommodate"],
  acheive: ["achieve"],
  adress: ["address"],
  adminstrator: ["administrator"],
  apparant: ["apparent"],
  becuase: ["because"],
  beleive: ["believe"],
  calender: ["calendar"],
  colaborate: ["collaborate"],
  colaboration: ["collaboration"],
  definately: ["definitely"],
  docment: ["document"],
  documant: ["document"],
  enviroment: ["environment"],
  existance: ["existence"],
  grammer: ["grammar"],
  occured: ["occurred"],
  recieve: ["receive"],
  seperate: ["separate"],
  sucess: ["success"],
  teh: ["the"],
  thier: ["their"],
  wierd: ["weird"],
  writting: ["writing"],
};

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/^'+|'+$/g, "");
}

export function getCustomDictionary(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DICTIONARY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addToCustomDictionary(word: string): void {
  const normalized = normalizeWord(word);
  if (!normalized) return;

  const words = new Set(getCustomDictionary());
  words.add(normalized);
  localStorage.setItem(DICTIONARY_KEY, JSON.stringify([...words].sort()));
}

export function getSpellingSuggestions(word: string): string[] {
  const normalized = normalizeWord(word);
  if (!normalized || getCustomDictionary().includes(normalized)) return [];
  return CORRECTIONS[normalized] ?? [];
}

export function getWordAtPoint(x: number, y: number): { word: string; range: Range } | null {
  const docWithCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };

  let range = docWithCaret.caretRangeFromPoint?.(x, y) ?? null;
  if (!range && docWithCaret.caretPositionFromPoint) {
    const position = docWithCaret.caretPositionFromPoint(x, y);
    if (position) {
      range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
    }
  }
  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;

  const text = range.startContainer.textContent ?? "";
  let start = range.startOffset;
  let end = range.startOffset;

  while (start > 0 && /[\p{L}']/u.test(text[start - 1])) start -= 1;
  while (end < text.length && /[\p{L}']/u.test(text[end])) end += 1;

  const word = text.slice(start, end);
  if (!word.trim()) return null;

  const wordRange = document.createRange();
  wordRange.setStart(range.startContainer, start);
  wordRange.setEnd(range.startContainer, end);
  return { word, range: wordRange };
}
