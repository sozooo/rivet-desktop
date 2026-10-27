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
import { useI18n } from "../i18n/i18n";
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
  const { t, mode } = useI18n();
  // Simple mode keeps one plain view: no layout or whitespace switches.
  const advanced = mode === "full";

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
          {advanced && (
            <div className="segmented">
              <button
                className={!split ? "active" : ""}
                title={t("diff.unified")}
                aria-label={t("diff.unified")}
                onClick={() => setSplit(false)}
              >
                <AlignJustify />
              </button>
              <button
                className={split ? "active" : ""}
                title={t("diff.split")}
                aria-label={t("diff.split")}
                onClick={() => setSplit(true)}
              >
                <Columns2 />
              </button>
            </div>
          )}
          <button
            className="icon-button"
            title={t("diff.actions")}
            aria-label={t("diff.actions")}
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
                    .then(() => notify(t("common.pathCopied")))
                    .catch(() =>
                      notify(t("common.clipboardUnavailable"), "error"),
                    );
                }}
              >
                <Copy />
                {t("diff.copyPath")}
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
                  {t("diff.discard")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="diff-subbar">
        <span>
          {folder || t("common.repositoryRoot")} <ChevronRight size={12} />{" "}
          {fileName(file.path)}
        </span>
        {advanced && (
          <div className="row">
            <button
              className={whitespace ? "text-button accent" : "text-button"}
              onClick={() => setWhitespace(!whitespace)}
              title={t("diff.whitespaceTitle")}
            >
              ¶ <span>{t("diff.whitespace")}</span>
            </button>
            <span className="separator" />
            <span>{context}</span>
          </div>
        )}
      </div>
      <div className="diff-scroll">
        {split && advanced && (
          <div className="split-label">
            <span>{t("diff.original")}</span>
            <span>{t("diff.modified")}</span>
          </div>
        )}
        {file.hunks.map((hunk, i) => (
          <DiffHunk
            key={i}
            hunk={hunk}
            split={split && advanced}
            whitespace={whitespace && advanced}
            onToggle={onToggleHunk && (() => onToggleHunk(i))}
          />
        ))}
      </div>
    </>
  );
}
