import { useState } from "react";
import { Archive, ArrowLeft, GitBranch, Trash2, Undo2 } from "lucide-react";
import { CommitFiles } from "../../diff/CommitFiles";
import { DiffView } from "../../diff/DiffView";
import type { StashEntry } from "../../git/types";
import { useI18n } from "../../i18n/i18n";
import { useAsync } from "../../ui/hooks";
import type { RepoApi } from "../repoApi";

/** Rivet names stashes "Changes on <branch>"; show that in the user's language. */
export function useStashName() {
  const { t } = useI18n();
  return (stash: StashEntry) => {
    const branch = stash.message.match(/^Changes on (.+)$/)?.[1];
    return branch ? t("stash.defaultName", { branch }) : stash.message;
  };
}

/** Stashes at the bottom of the Changes list: restore or delete without leaving the view. */
export function StashList({
  stashes,
  viewing,
  onView,
  onRestore,
  onDelete,
}: {
  stashes: StashEntry[];
  /** Date of the stash shown in the main area. */
  viewing: number | null;
  onView: (stash: StashEntry) => void;
  onRestore: (index: number) => void;
  onDelete: (stash: StashEntry) => void;
}) {
  const { t, timeAgo } = useI18n();
  const name = useStashName();
  if (!stashes.length) return null;
  return (
    <section className="stash-section">
      <div className="group-heading">
        <span>
          {t("stash.heading")} <b>{stashes.length}</b>
        </span>
      </div>
      {stashes.map((s) => (
        <div
          key={`${s.index}-${s.date}`}
          className={`stash-card ${viewing === s.date ? "selected" : ""}`}
        >
          <button className="stash-open" onClick={() => onView(s)}>
            <Archive size={15} />
            <span>
              <strong title={s.message}>{name(s)}</strong>
              <small>
                {t("common.files", { count: s.fileCount })} · {timeAgo(s.date)}
              </small>
            </span>
          </button>
          <div className="stash-actions">
            <button
              className="text-button"
              title={t("stash.restoreTitle")}
              onClick={() => onRestore(s.index)}
            >
              <Undo2 size={12} /> {t("stash.restore")}
            </button>
            <button
              className="icon-button"
              title={t("stash.delete")}
              aria-label={t("stash.deleteLabel", { name: name(s) })}
              onClick={() => onDelete(s)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

export function StashDetail({
  repo,
  stash,
  onBack,
  onRestore,
  onDelete,
}: {
  repo: RepoApi;
  stash: StashEntry;
  onBack: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { t, mode, timeAgo } = useI18n();
  const name = useStashName();
  const contents = useAsync(
    () => repo.backend.stashFiles(stash.index),
    [stash.index, stash.date],
  );
  const [selected, setSelected] = useState<string>();
  const current = contents?.find((f) => f.path === selected) ?? contents?.[0];
  return (
    <>
      <div className="detail-header">
        <button className="text-button detail-back" onClick={onBack}>
          <ArrowLeft size={13} /> {t("stash.back")}
        </button>
        <div className="eyebrow">
          {t("stash.eyebrow")}
          {mode === "full" && ` · stash@{${stash.index}}`}
        </div>
        <h2>{name(stash)}</h2>
        <div className="metadata">
          {mode === "full" && (
            <>
              <GitBranch size={14} />
              {stash.branch}
              <span>·</span>
            </>
          )}
          <span>{timeAgo(stash.date)}</span>
          <span>· {t("common.files", { count: stash.fileCount })}</span>
        </div>
        <div className="detail-actions">
          <button className="button primary" onClick={onRestore}>
            <Undo2 size={13} /> {t("stash.restoreChanges")}
          </button>
          <button className="button danger-text" onClick={onDelete}>
            <Trash2 size={13} /> {t("stash.deleteButton")}
          </button>
        </div>
      </div>
      {contents && (
        <CommitFiles
          files={contents}
          selected={current?.path}
          onSelect={setSelected}
        >
          <DiffView file={current} context={t("stash.context")} />
        </CommitFiles>
      )}
    </>
  );
}
