import { useRef, useState, type ReactNode } from "react";
import {
  AlignJustify,
  ChevronRight,
  Columns2,
  Copy,
  MoreHorizontal,
  RotateCcw,
} from "lucide-react";
import { dirName, fileName, lineStats } from "../git/paths";
import type { FileChange } from "../git/types";
import { FileIcon, StatusIcon } from "../ui/FileIcon";
import { useDismiss, useStoredState } from "../ui/hooks";
import { useNotify } from "../ui/Toast";
import { DiffHunk } from "./DiffHunk";

export function DiffView({
  file,
  context,
  onToggleHunk,
  onDiscard,
  empty,
}: {
  file?: FileChange;
  /** What the diff compares, e.g. "Working tree → HEAD". */
  context: string;
  onToggleHunk?: (hunk: number) => void;
  onDiscard?: () => void;
  empty?: ReactNode;
}) {
  const [split, setSplit] = useStoredState("rivet.diff.split", false);
  const [whitespace, setWhitespace] = useStoredState(
    "rivet.diff.whitespace",
    false,
  );
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(menuRef, menu, () => setMenu(false));
  const notify = useNotify();

  if (!file) return <>{empty}</>;
  const { added, removed } = lineStats(file.hunks);
  const folder = dirName(file.path);
  return (
    <>
      <div className="diff-title">
        <div className="file-heading">
          <FileIcon path={file.path} />
          <strong>{fileName(file.path)}</strong>
          <StatusIcon status={file.status} />
          <span className="diff-stats">
            <b>+{added}</b>
            <em>−{removed}</em>
          </span>
        </div>
        <div className="row" ref={menuRef}>
          <div className="segmented">
            <button
              className={!split ? "active" : ""}
              title="Unified diff"
              aria-label="Unified diff"
              onClick={() => setSplit(false)}
            >
              <AlignJustify />
            </button>
            <button
              className={split ? "active" : ""}
              title="Side-by-side diff"
              aria-label="Side-by-side diff"
              onClick={() => setSplit(true)}
            >
              <Columns2 />
            </button>
          </div>
          <button
            className="icon-button"
            title="File actions"
            aria-label="File actions"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <MoreHorizontal />
          </button>
          {menu && (
            <div className="dropdown file-menu">
              <button
                onClick={() => {
                  setMenu(false);
                  navigator.clipboard
                    .writeText(file.path)
                    .then(() => notify("Path copied"))
                    .catch(() => notify("Clipboard unavailable", "error"));
                }}
              >
                <Copy />
                Copy path
              </button>
              {onDiscard && (
                <button
                  className="danger-text"
                  onClick={() => {
                    setMenu(false);
                    onDiscard();
                  }}
                >
                  <RotateCcw />
                  Discard changes…
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="diff-subbar">
        <span>
          {folder || "Repository root"} <ChevronRight size={12} />{" "}
          {fileName(file.path)}
        </span>
        <div className="row">
          <button
            className={whitespace ? "text-button accent" : "text-button"}
            onClick={() => setWhitespace(!whitespace)}
            title="Toggle whitespace visibility"
          >
            ¶ <span>Whitespace</span>
          </button>
          <span className="separator" />
          <span>{context}</span>
        </div>
      </div>
      <div className="diff-scroll">
        {split && (
          <div className="split-label">
            <span>Original</span>
            <span>Modified</span>
          </div>
        )}
        {file.hunks.map((hunk, i) => (
          <DiffHunk
            key={i}
            hunk={hunk}
            split={split}
            whitespace={whitespace}
            onToggle={onToggleHunk && (() => onToggleHunk(i))}
          />
        ))}
      </div>
    </>
  );
}
