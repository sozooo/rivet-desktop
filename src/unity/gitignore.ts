import template from "./Unity.gitignore?raw";

/**
 * GitHub's Unity .gitignore with Rivet's additions, as Rivet writes it into a
 * Unity project's folder. Its rules start with "/", so they only work there.
 */
export const UNITY_GITIGNORE = template.replace(/\r\n/g, "\n");

const isRule = (line: string) => !!line && !line.startsWith("#");

/** The template in paragraphs, each with its comments and rules. */
const paragraphs = UNITY_GITIGNORE.split(/\n\s*\n/).map((block) =>
  block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean),
);
const RULES = paragraphs.flat().filter(isRule);

/** One path segment of a gitignore pattern as a regular expression. */
function segment(pattern: string) {
  const source = pattern.replace(/\[!?[^\]]*\]|[*?]|[^[*?]+/g, (part) =>
    part === "*"
      ? "[^/]*"
      : part === "?"
        ? "[^/]"
        : part.startsWith("[")
          ? part.replace(/^\[!/, "[^")
          : part.replace(/[.+^${}()|\\]/g, "\\$&"),
  );
  return new RegExp(`^${source}$`);
}

/** Every spelling a pattern without wildcards allows: "[Ll]ibrary" → Library, library. */
function spellings(pattern: string): string[] {
  if (/[*?]/.test(pattern)) return [];
  const match = pattern.match(/\[([^\]]*)\]/);
  if (!match) return [pattern];
  const [before, after] = [
    pattern.slice(0, match.index),
    pattern.slice(match.index! + match[0].length),
  ];
  return [...match[1]].flatMap((c) => spellings(before + c + after));
}

/**
 * Folders Unity and code editors make in a project's folder, from the
 * template's one-level folder rules: "/[Ll]ibrary/", ".vs/" and so on.
 */
const folderRules = RULES.filter((r) => /^\/?[^/]+\/$/.test(r)).map((r) =>
  r.replace(/^\/|\/$/g, ""),
);
const FOLDERS = folderRules.map(segment);

/** The names those folders usually have, e.g. Library, library, Temp, temp. */
export const GENERATED_FOLDER_NAMES = folderRules.flatMap(spellings);

/**
 * Project files code editors write next to Assets. The template ignores them
 * wherever they are; Rivet only looks for them in a project's own folder.
 */
export const PROJECT_FILES = [
  "*.csproj",
  "*.sln",
  "*.slnx",
  "*.unityproj",
  "*.suo",
  "*.user",
  "*.userprefs",
];
const FILES = PROJECT_FILES.map(segment);

/**
 * Whether a path inside a Unity project's folder is something Unity or a code
 * editor makes for itself: one of its generated folders (given with a
 * trailing "/") or an editor's project file, directly in that folder.
 */
export function isGenerated(path: string) {
  const folder = path.endsWith("/");
  const name = folder ? path.slice(0, -1) : path;
  if (!name || name.includes("/")) return false;
  return (folder ? FOLDERS : FILES).some((r) => r.test(name));
}

/** Generated paths for people to read: "Library, Temp, kinetic.sln". */
export const generatedNames = (paths: string[]) =>
  paths.map((path) => path.replace(/\/$/, "")).join(", ");

/**
 * A Unity project's .gitignore with the template's rules it lacks added at the
 * end, under their comments; the text itself when nothing is missing. Lines
 * already there are never changed, and a rule the file un-ignores ("!rule")
 * stays un-ignored.
 */
export function withUnityIgnore(current: string) {
  if (!current.trim()) return UNITY_GITIGNORE;
  const present = new Set(
    current
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^!/, ""))
      .filter(isRule),
  );
  const added = paragraphs
    .filter((p) => p.some((line) => isRule(line) && !present.has(line)))
    .map((p) => p.filter((line) => !isRule(line) || !present.has(line)));
  if (!added.length) return current;
  const eol = current.includes("\r\n") ? "\r\n" : "\n";
  const block = [
    "# Added by Rivet: what Unity's .gitignore has and this file didn't",
    ...added.map((p) => p.join(eol)),
  ].join(eol + eol);
  const base = current.endsWith("\n") ? current : current + eol;
  return base + eol + block + eol;
}
