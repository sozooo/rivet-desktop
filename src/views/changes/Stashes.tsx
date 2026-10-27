import { useState } from "react";
import { Archive, ArrowLeft, GitBranch, Trash2, Undo2 } from "lucide-react";
import { CommitFiles } from "../../diff/CommitFiles";
import { DiffView } from "../../diff/DiffView";
import type { StashEntry } from "../../git/types";
import { timeAgo, useAsync } from "../../ui/hooks";
import type { RepoApi } from "../repoApi";

const files = (n: number) => `${n} ${n === 1 ? "file" : "files"}`;

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
  if (!stashes.length) return null;
  return (
    <section className="stash-section">
      <div className="group-heading">
        <span>
          STASHED <b>{stashes.length}</b>
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
              <strong title={s.message}>{s.message}</strong>
              <small>
                {files(s.fileCount)} · {timeAgo(s.date)}
              </small>
            </span>
          </button>
          <div className="stash-actions">
            <button
              className="text-button"
              title="Put these changes back into your working files and remove the stash"
              onClick={() => onRestore(s.index)}
            >
              <Undo2 size={12} /> Restore
            </button>
            <button
              className="icon-button"
              title="Delete stash…"
              aria-label={`Delete stash ${s.message}`}
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
          <ArrowLeft size={13} /> Back to changes
        </button>
        <div className="eyebrow">
          STASHED CHANGES · stash@{`{${stash.index}}`}
        </div>
        <h2>{stash.message}</h2>
        <div className="metadata">
          <GitBranch size={14} />
          {stash.branch}
          <span>· {timeAgo(stash.date)}</span>
          <span>· {files(stash.fileCount)}</span>
        </div>
        <div className="detail-actions">
          <button className="button primary" onClick={onRestore}>
            <Undo2 size={13} /> Restore changes
          </button>
          <button className="button danger-text" onClick={onDelete}>
            <Trash2 size={13} /> Delete…
          </button>
        </div>
      </div>
      {contents && (
        <CommitFiles
          files={contents}
          selected={current?.path}
          onSelect={setSelected}
        >
          <DiffView file={current} context="Stash → HEAD" />
        </CommitFiles>
      )}
    </>
  );
}
