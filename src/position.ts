/** Source-line coordinates are shared by Obsidian's Markdown subviews. */
export interface Position {
  line: number;
  fraction: number;
  text: string;
  before: string;
  after: string;
  heading: string;
  headingOffset: number;
  ratio: number;
}

const snippet = (text: string | undefined) => (text ?? '').trim().slice(0, 240);
const headingAt = (lines: string[], at: number): { text: string; line: number } => {
  // Ignore heading-looking text inside fenced code blocks.
  let fence = '', result = { text: '', line: 0 };
  for (let i = 0; i <= at; i++) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i]);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = '';
    } else if (!fence && /^ {0,3}#{1,6}\s+/.test(lines[i])) result = { text: snippet(lines[i]), line: i };
  }
  return result;
};

export function capturePosition(source: string, scroll: number, ratio: number): Position {
  const lines = source.split('\n');
  const safe = Number.isFinite(scroll) ? Math.max(0, Math.min(scroll, lines.length - 0.000001)) : 0;
  const line = Math.floor(safe);
  const heading = headingAt(lines, line);
  return {
    line, fraction: safe - line, text: snippet(lines[line]),
    before: snippet(lines[line - 1]), after: snippet(lines[line + 1]),
    heading: heading.text, headingOffset: line - heading.line,
    ratio: Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0
  };
}

export interface ResolvedPosition { line: number; strategy: 'context' | 'heading' | 'line' | 'ratio' }
export function resolvePosition(source: string, position: Position): ResolvedPosition {
  const lines = source.split('\n');
  const texts = lines.map(snippet);
  let best = -1, bestScore = -Infinity;
  // Scan only on an explicit navigation action, never on scrolling.
  let fence = '', heading = '';
  let headingLine = -1, headingDistance = Infinity;
  for (let i = 0; i < texts.length; i++) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i]);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = '';
    } else if (!fence && /^ {0,3}#{1,6}\s+/.test(lines[i])) {
      heading = texts[i];
      if (position.heading && heading === position.heading) {
        const distance = Math.abs(i + position.headingOffset - position.line);
        if (distance < headingDistance) { headingLine = i; headingDistance = distance; }
      }
    }
    const before = position.before !== '' && texts[i - 1] === position.before;
    const after = position.after !== '' && texts[i + 1] === position.after;
    if (texts[i] !== position.text || (!position.text && !before && !after)) continue;
    const score = (before ? 4 : 0) + (after ? 4 : 0) +
      (position.heading && heading === position.heading ? 6 : 0) +
      1 / (1 + Math.abs(i - position.line));
    if (score > bestScore) { best = i; bestScore = score; }
  }
  if (best >= 0) return { line: best + position.fraction, strategy: 'context' };
  if (headingLine >= 0) return {
    line: Math.min(lines.length - 0.000001, headingLine + position.headingOffset + position.fraction), strategy: 'heading'
  };
  if (Number.isFinite(position.line) && position.line >= 0 && position.line < lines.length) {
    return { line: position.line + position.fraction, strategy: 'line' };
  }
  return { line: Math.max(0, Math.min(1, position.ratio)) * (lines.length - 1), strategy: 'ratio' };
}

export function samePosition(a: Position, b: Position): boolean {
  return a.line === b.line && Math.abs(a.fraction - b.fraction) < 0.1 &&
    a.text === b.text && a.heading === b.heading;
}
