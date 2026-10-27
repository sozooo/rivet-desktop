import {
  Box,
  FileCode2,
  FileImage,
  FileJson2,
  FileText,
  Plus,
  Pencil,
  Minus,
  ArrowRight,
} from "lucide-react";
import { extension } from "../git/paths";
import type { FileStatus } from "../git/types";
import { useI18n } from "../i18n/i18n";

const images = new Set(["png", "jpg", "jpeg", "tga", "psd", "exr", "gif"]);
const models = new Set(["fbx", "obj", "gltf", "glb", "blend"]);
const documents = new Set(["md", "txt", "yml", "yaml"]);

export function FileIcon({ path }: { path: string }) {
  const ext = extension(path);
  const Icon =
    ext === "json"
      ? FileJson2
      : documents.has(ext)
        ? FileText
        : images.has(ext)
          ? FileImage
          : models.has(ext)
            ? Box
            : FileCode2;
  return (
    <span className={`file-icon file-icon-${ext || "none"}`}>
      <Icon />
    </span>
  );
}

const icons = {
  added: Plus,
  modified: Pencil,
  deleted: Minus,
  renamed: ArrowRight,
} satisfies Record<FileStatus, unknown>;

/**
 * Shows what happened to a file with a colored glyph instead of a git letter;
 * `word` adds a plain-language label beside it.
 */
export function StatusIcon({
  status,
  word,
}: {
  status: FileStatus;
  word?: boolean;
}) {
  const { t } = useI18n();
  const Icon = icons[status];
  const label = t(`status.${status}Title`);
  return (
    <span className={`status-badge status-${status}`}>
      {word && <span className="status-word">{t(`status.${status}`)}</span>}
      <span className="status-icon" title={label} aria-label={label} role="img">
        <Icon />
      </span>
    </span>
  );
}
