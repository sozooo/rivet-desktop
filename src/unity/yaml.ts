/**
 * A tolerant parser for the YAML subset Unity writes: block mappings,
 * sequences whose "- " sits at the parent key's indentation, flow mappings
 * like {fileID: 0} and plain or quoted scalars. Anything unexpected is skipped
 * rather than failing, so one odd line never hides a whole scene.
 */

export type YamlValue = string | YamlMap | YamlValue[];
export type YamlMap = { [key: string]: YamlValue };

export type UnityDocument = {
  classId: number;
  fileId: string;
  stripped: boolean;
  /** The document's root key, e.g. "GameObject" or "Transform". */
  type: string;
  data: YamlMap;
};

type Line = { indent: number; text: string };

const KEY = /^("[^"]*"|'[^']*'|[^\s{[\-"'][^:]*?|-[^\s][^:]*?):(?:\s+(.*))?$/;

export function parseUnityYaml(text: string): UnityDocument[] {
  const documents: UnityDocument[] = [];
  const header = /^--- !u!(\d+) &(-?\d+)( stripped)?/;
  let current: { head: RegExpMatchArray; lines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const root = parseMapping(toLines(current.lines));
    const type = Object.keys(root)[0] ?? "";
    const data = root[type];
    documents.push({
      classId: Number(current.head[1]),
      fileId: current.head[2],
      stripped: !!current.head[3],
      type,
      data: isMap(data) ? data : {},
    });
  };
  for (const line of text.split(/\r?\n/)) {
    const head = line.match(header);
    if (head) {
      flush();
      current = { head, lines: [] };
    } else if (current && !line.startsWith("%")) current.lines.push(line);
  }
  flush();
  return documents;
}

/** Parses one standalone block of YAML (no Unity document headers). */
export function parseYamlBlock(text: string): YamlMap {
  return parseMapping(toLines(text.split(/\r?\n/)));
}

function toLines(raw: string[]): Line[] {
  return raw
    .filter((l) => l.trim() && !l.trimStart().startsWith("#"))
    .map((l) => ({ indent: l.length - l.trimStart().length, text: l.trim() }));
}

function parseMapping(lines: Line[]): YamlMap {
  const state = { i: 0 };
  return lines.length ? mapping(lines, state, lines[0].indent) : {};
}

function mapping(lines: Line[], state: { i: number }, indent: number): YamlMap {
  const result: YamlMap = {};
  while (state.i < lines.length) {
    const line = lines[state.i];
    if (line.indent < indent) break;
    if (
      line.indent > indent ||
      line.text.startsWith("- ") ||
      line.text === "-"
    ) {
      // Continuation of a multi-line scalar, or a stray item: skip it.
      state.i++;
      continue;
    }
    const match = line.text.match(KEY);
    state.i++;
    if (!match) continue;
    const key = unquote(match[1]);
    const rest = match[2];
    if (rest !== undefined && rest !== "") {
      result[key] = scalar(rest);
      continue;
    }
    const next = lines[state.i];
    if (next && next.indent > indent)
      result[key] = block(lines, state, next.indent);
    else if (next && next.indent === indent && isItem(next.text))
      result[key] = sequence(lines, state, indent);
    else result[key] = "";
  }
  return result;
}

function block(lines: Line[], state: { i: number }, indent: number): YamlValue {
  return isItem(lines[state.i].text)
    ? sequence(lines, state, indent)
    : mapping(lines, state, indent);
}

function sequence(
  lines: Line[],
  state: { i: number },
  indent: number,
): YamlValue[] {
  const items: YamlValue[] = [];
  while (state.i < lines.length) {
    const line = lines[state.i];
    if (line.indent !== indent || !isItem(line.text)) break;
    const body = line.text === "-" ? "" : line.text.slice(2);
    if (KEY.test(body)) {
      // "- key: value" opens a mapping whose other keys sit two columns in.
      lines[state.i] = { indent: indent + 2, text: body };
      items.push(mapping(lines, state, indent + 2));
    } else {
      state.i++;
      const next = lines[state.i];
      items.push(
        body === "" && next && next.indent > indent
          ? block(lines, state, next.indent)
          : scalar(body),
      );
    }
  }
  return items;
}

const isItem = (text: string) => text.startsWith("- ") || text === "-";

function scalar(text: string): YamlValue {
  const value = text.trim();
  if (value.startsWith("{")) return flowMapping(value);
  if (value.startsWith("[")) return flowSequence(value);
  return unquote(value);
}

function splitTopLevel(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0,
    start = 0,
    quote = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

function flowMapping(text: string): YamlMap {
  const result: YamlMap = {};
  for (const part of splitTopLevel(text.slice(1, text.lastIndexOf("}")))) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    result[unquote(part.slice(0, colon).trim())] = scalar(
      part.slice(colon + 1),
    );
  }
  return result;
}

function flowSequence(text: string): YamlValue[] {
  return splitTopLevel(text.slice(1, text.lastIndexOf("]"))).map(scalar);
}

function unquote(text: string) {
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")))
  )
    return text.slice(1, -1);
  return text;
}

export const isMap = (value: YamlValue | undefined): value is YamlMap =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const asList = (value: YamlValue | undefined): YamlValue[] =>
  Array.isArray(value) ? value : [];

export const asText = (value: YamlValue | undefined) =>
  typeof value === "string" ? value : "";

/** A {fileID, guid} reference, or null for an empty one. */
export function reference(value: YamlValue | undefined) {
  if (!isMap(value)) return null;
  const fileId = asText(value.fileID);
  const guid = asText(value.guid);
  if ((!fileId || fileId === "0") && !guid) return null;
  return { fileId, guid };
}
