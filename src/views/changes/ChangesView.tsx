import { useState } from "react";
import { Archive, CheckCircle2 } from "lucide-react";
import { DiffView } from "../../diff/DiffView";
import { dirName, fileName, selectionOf } from "../../git/paths";
import type { FileChange, StashEntry } from "../../git/types";
import { Checkbox } from "../../ui/Checkbox";
import { FileIcon, StatusIcon } from "../../ui/FileIcon";
import { Panes } from "../../ui/Panes";
import type { RepoApi } from "../repoApi";
import { Composer } from "./Composer";
import { StashDetail, StashList } from "./Stashes";

export function ChangesView({ repo, phase }: { repo: RepoApi; phase: string }) {
  const { snapshot, act, openOperation } = repo;
  const { files, stashes } = snapshot;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>();
  // Stashes renumber when one is removed, so remember the viewed one by date.
  const [viewingStash, setViewingStash] = useState<number | null>(null);

  const current = files.find((f) => f.path === selected) ?? files[0];
  const states = files.map(selectionOf);
  const selectedCount = states.filter((s) => s !== "none").length;
  const allState =
    selectedCount === 0
      ? false
      : states.every((s) => s === "all")
        ? true
        : ("mixed" as const);
  const visible = files.filter((f) =>
    f.path.toLowerCase().includes(query.toLowerCase()),
  );
  const stash = stashes.find((s) => s.date === viewingStash);

  const restore = (index: number) => {
    setViewingStash(null);
    act((b) => b.stashPop(index), "Stashed changes restored.");
  };
  const remove = (s: StashEntry) => openOperation("drop-stash", { stash: s });

  const fileRow = (f: FileChange) => {
    const state = selectionOf(f);
    const name = fileName(f.path);
    return (
      <div
        key={f.path}
        className={`file-row ${!stash && current?.path === f.path ? "selected" : ""} ${f.status === "deleted" ? "deleted" : ""}`}
      >
        <Checkbox
          checked={
            state === "all" ? true : state === "partial" ? "mixed" : false
          }
          label={
            state === "all"
              ? `Leave ${name} out of the commit`
              : `Include ${name} in the commit`
          }
          onChange={() => act((b) => b.setStaged(f.path, state !== "all"))}
        />
        <button
          className="file-select"
          onClick={() => {
            setSelected(f.path);
            setViewingStash(null);
          }}
        >
          <FileIcon path={f.path} />
          <span className="file-label">
            <span>{name}</span>
            <small>{dirName(f.path) || "Repository root"}</small>
          </span>
          <StatusIcon status={f.status} />
        </button>
      </div>
    );
  };

  return (
    <Panes
      title="Changes"
      count={files.length}
      phase={phase}
      search={{
        value: query,
        onChange: setQuery,
        placeholder: "Filter files…",
      }}
      sidebar={
        <>
          <div className="group-heading changes-heading">
            <span className="row">
              <Checkbox
                checked={allState}
                disabled={!files.length}
                label={allState === true ? "Unselect all" : "Select all"}
                onChange={() => act((b) => b.setAllStaged(allState !== true))}
              />
              {files.length ? `${files.length} CHANGED` : "NO CHANGES"}
            </span>
            <button
              className="text-button"
              disabled={!files.length}
              title="Put all changes aside and get a clean working tree. Restore them any time from the list below."
              onClick={() =>
                act(
                  (b) => b.stash(),
                  "Changes stashed. Restore them from the list below.",
                )
              }
            >
              <Archive size={12} /> Stash all
            </button>
          </div>
          {visible.map(fileRow)}
          {!files.length && (
            <p className="list-empty">Your working tree is clean.</p>
          )}
          {files.length > 0 && !visible.length && (
            <p className="list-empty">No matching files.</p>
          )}
          <StashList
            stashes={stashes}
            viewing={viewingStash}
            onView={(s) => setViewingStash(s.date)}
            onRestore={restore}
            onDelete={remove}
          />
        </>
      }
      footer={
        <>
          <span className="status-dot" /> Working tree
          {repo.demo && <span className="muted">Demo</span>}
        </>
      }
      main={
        stash ? (
          <StashDetail
            key={`${stash.index}-${stash.date}`}
            repo={repo}
            stash={stash}
            onBack={() => setViewingStash(null)}
            onRestore={() => restore(stash.index)}
            onDelete={() => remove(stash)}
          />
        ) : (
          <>
            <div className="workspace-label">
              <span>
                <span className="status-dot" /> Working changes
              </span>
              <span>Review. Select. Commit.</span>
            </div>
            <DiffView
              file={current}
              context="Working tree → HEAD"
              onToggleHunk={(i) =>
                current &&
                act((b) =>
                  b.setStaged(current.path, !current.hunks[i].staged, i),
                )
              }
              onDiscard={() => openOperation("discard-file", { file: current })}
              empty={
                <div className="empty">
                  <CheckCircle2 />
                  <h2>Everything in its place.</h2>
                  <p>
                    {stashes.length
                      ? "Your working tree is clean. Stashed changes are waiting in the list."
                      : "Your working tree is clean."}
                  </p>
                </div>
              }
            />
            <Composer repo={repo} selectedCount={selectedCount} />
          </>
        )
      }
    />
  );
}
