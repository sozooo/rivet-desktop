import { fileName } from "../git/paths";
import type { Key, Params } from "./i18n";

/** Plain words for git messages people run into; null for the rest. */
export function explainError(
  message: string,
): { key: Key; params?: Params } | null {
  // Git lists the files it means on lines that start with a tab.
  const listed = message
    .split("\n")
    .filter((line) => line.startsWith("\t"))
    .map((line) => fileName(line.trim()));
  const files =
    listed.slice(0, 3).join(", ") + (listed.length > 3 ? ", …" : "");
  if (/would be overwritten by (merge|checkout)/.test(message))
    return { key: "error.localChanges", params: { files } };
  if (
    /'lfs' is not a git command|git-lfs.*(not found|not installed)/i.test(
      message,
    )
  )
    return { key: "lfs.missing" };
  if (/still has conflict markers/.test(message))
    return { key: "conflict.markers" };
  return null;
}
