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

const statuses = {
  added: { Icon: Plus, label: "New file" },
  modified: { Icon: Pencil, label: "Modified" },
  deleted: { Icon: Minus, label: "Deleted" },
  renamed: { Icon: ArrowRight, label: "Moved or renamed" },
} satisfies Record<FileStatus, unknown>;

/** Shows what happened to a file with a colored glyph instead of a git letter. */
export function StatusIcon({ status }: { status: FileStatus }) {
  const { Icon, label } = statuses[status];
  return (
    <span
      className={`status-icon status-${status}`}
      title={label}
      aria-label={label}
      role="img"
    >
      <Icon />
    </span>
  );
}
