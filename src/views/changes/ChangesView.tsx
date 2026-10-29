import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleCheck,
  History,
} from "lucide-react";
import { DiffView } from "../../diff/DiffView";
import { dirName, fileName } from "../../git/paths";
import type { StashEntry } from "../../git/types";
import {
  groupFiles,
  groupSelection,
  groupStatus,
  groupWithMeta,
  metaOnlyNote,
  primaryFile,
  type FileGroup,
} from "../../git/unity";
import { useI18n, type Key } from "../../i18n/i18n";
import { Checkbox } from "../../ui/Checkbox";
import { FileIcon, StatusIcon } from "../../ui/FileIcon";
import { Panes } from "../../ui/Panes";
import type { RepoApi } from "../repoApi";
import { Composer } from "./Composer";
import { ConflictView, useConflictNote } from "./ConflictView";
import { LfsHint } from "./LfsHint";
import { MergeBanner } from "./MergeBanner";
import { StashDetail, StashList, useStashName } from "./Stashes";

const conflictOf = (g: FileGroup) =>
  groupFiles(g).find((f) => f.conflict && !f.conflict.resolution) ??
  groupFiles(g).find((f) => f.conflict);

export function ChangesView({
  repo,
  phase,
  initialPath,
}: {
  repo: RepoApi;
  phase: string;
  /** The row to show first. */
  initialPath?: string;
}) {
  const { snapshot, act, openOperation } = repo;
  const { files, stashes, operation } = snapshot;
  const { t, mode } = useI18n();
  const stashName = useStashName();
  const conflictNote = useConflictNote(operation);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initialPath);
  // Stashes renumber when one is removed, so remember the viewed one by date.
  const [viewingStash, setViewingStash] = useState<number | null>(null);
  // Sent here for one file: bring its row into view.
  useEffect(() => {
    if (initialPath)
      document
        .querySelector(".file-row.selected")
        ?.scrollIntoView({ block: "nearest" });
  }, [initialPath]);

  // An asset and its Unity .meta file are one row, selected together.
  const groups = groupWithMeta(files);
  // A stopped merge: conflicts come first, and nothing is picked for a commit.
  const merging = !!operation || files.some((f) => f.conflict);
  // By path, so a settled file whose row git rebuilt keeps its place.
  const conflicts = groups
    .filter(conflictOf)
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  const others = groups.filter((g) => !conflictOf(g));
  // During a merge, what is already in the index came with the merge.
  const merged = others.filter((g) => groupSelection(g) !== "none");
  const unsaved = others.filter((g) => groupSelection(g) === "none");
  const ordered = merging ? [...conflicts, ...merged, ...unsaved] : groups;
  const currentGroup = ordered.find((g) => g.path === selected) ?? ordered[0];
  const current = currentGroup && primaryFile(currentGroup);
  const states = groups.map(groupSelection);
  const selectedCount = states.filter((s) => s !== "none").length;
  const allState =
    selectedCount === 0
      ? false
      : states.every((s) => s === "all")
        ? true
        : ("mixed" as const);
  const matches = (g: FileGroup) =>
    g.path.toLowerCase().includes(query.toLowerCase());
  const visible = groups.filter(matches);
  const stash = stashes.find((s) => s.date === viewingStash);

  const restore = (index: number) => {
    setViewingStash(null);
    act((b) => b.stashPop(index), t("changes.restored"));
  };
  const remove = (s: StashEntry) =>
    openOperation("drop-stash", { stash: s, stashName: stashName(s) });
  const toggle = (g: FileGroup) => {
    const select = groupSelection(g) !== "all";
    return act(async (b) => {
      for (const f of groupFiles(g)) await b.setStaged(f.path, select);
    });
  };

  const fileRow = (g: FileGroup) => {
    const state = groupSelection(g);
    const name = fileName(g.path);
    const conflict = conflictOf(g)?.conflict;
    const note = metaOnlyNote(g);
    const status = groupStatus(g);
    return (
      <div
        key={g.path}
        className={`file-row ${!stash && currentGroup?.path === g.path ? "selected" : ""} ${status === "deleted" && !conflict ? "deleted" : ""}`}
      >
        {conflict ? (
          <span
            className={`conflict-mark ${conflict.resolution ? "resolved" : ""}`}
          >
            {conflict.resolution ? <CircleCheck /> : <AlertTriangle />}
          </span>
        ) : merging ? (
          <span className="conflict-mark" />
        ) : (
          <Checkbox
            checked={
              state === "all" ? true : state === "partial" ? "mixed" : false
            }
            label={t(state === "all" ? "changes.exclude" : "changes.include", {
              name,
            })}
            onChange={() => toggle(g)}
          />
        )}
        <button
          className="file-select"
          title={g.meta && g.file ? t("meta.withMeta") : undefined}
          onClick={() => {
            setSelected(g.path);
            setViewingStash(null);
          }}
        >
          <FileIcon path={g.path} />
          <span className="file-label">
            <span>{name}</span>
            <small className={conflict && !conflict.resolution ? "open" : ""}>
              {conflict
                ? conflictNote(conflict)
                : note
                  ? t(note)
                  : dirName(g.path) || t("common.repositoryRoot")}
            </small>
          </span>
          {/* A .meta-only change explains itself in the second line. */}
          {!note && !conflict && (
            <StatusIcon status={status} word={mode === "simple"} />
          )}
        </button>
      </div>
    );
  };

  const section = (title: Key, list: FileGroup[]) => {
    const shown = list.filter(matches);
    return (
      list.length > 0 && (
        <div className="file-group" key={title}>
          <div className="group-heading changes-heading">
            <span className="row">
              {t(title)}
              <span className="count">{list.length}</span>
            </span>
          </div>
          {shown.map(fileRow)}
        </div>
      )
    );
  };

  return (
    <Panes
      title={t("changes.title")}
      count={groups.length}
      phase={phase}
      search={{
        value: query,
        onChange: setQuery,
        placeholder: t("changes.filter"),
      }}
      sidebar={
        merging ? (
          <>
            {section("merge.conflicts", conflicts)}
            {section("merge.merged", merged)}
            {section("merge.unsaved", unsaved)}
            {!visible.length && (
              <p className="list-empty">{t("changes.noMatches")}</p>
            )}
          </>
        ) : (
          <>
            <LfsHint repo={repo} />
            <div className="group-heading changes-heading">
              <span className="row">
                <Checkbox
                  checked={allState}
                  disabled={!files.length}
                  label={t(
                    allState === true
                      ? "changes.unselectAll"
                      : "changes.selectAll",
                  )}
                  onChange={() => act((b) => b.setAllStaged(allState !== true))}
                />
                {groups.length
                  ? t("changes.count", { count: groups.length })
                  : t("changes.none")}
              </span>
              <button
                className="text-button"
                disabled={!files.length}
                title={t("changes.stashAllTitle")}
                onClick={() => act((b) => b.stash(), t("changes.stashed"))}
              >
                <Archive size={12} /> {t("changes.stashAll")}
              </button>
            </div>
            {visible.map(fileRow)}
            {!files.length && (
              <p className="list-empty">{t("changes.clean")}</p>
            )}
            {files.length > 0 && !visible.length && (
              <p className="list-empty">{t("changes.noMatches")}</p>
            )}
            <StashList
              stashes={stashes}
              viewing={viewingStash}
              onView={(s) => setViewingStash(s.date)}
              onRestore={restore}
              onDelete={remove}
            />
          </>
        )
      }
      footer={
        <>
          <span className="status-dot" /> {t("changes.footer")}
          {repo.demo && <span className="muted">{t("common.demo")}</span>}
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
                <span className="status-dot" /> {t("changes.workingChanges")}
              </span>
              <span>{t("changes.motto")}</span>
            </div>
            {merging && <MergeBanner repo={repo} />}
            {currentGroup && conflictOf(currentGroup) ? (
              <ConflictView
                key={currentGroup.path}
                repo={repo}
                group={currentGroup}
              />
            ) : (
              <DiffView
                file={current}
                context={t("changes.diffContext")}
                revisions={{ before: "HEAD", after: "worktree" }}
                actions={
                  // A new file has no versions yet.
                  current?.status !== "added" && (
                    <button
                      className="text-button file-action"
                      title={t("history.fileHistory")}
                      onClick={() =>
                        current && repo.showFileHistory(current.path)
                      }
                    >
                      <History size={14} />
                      <span>{t("history.fileHistory")}</span>
                    </button>
                  )
                }
                onToggleHunk={
                  // Picking parts of a file is a full-mode tool, and a merge commit takes everything.
                  mode === "full" && !merging
                    ? (i) =>
                        current &&
                        act((b) =>
                          b.setStaged(
                            current.path,
                            !current.hunks[i].staged,
                            i,
                          ),
                        )
                    : undefined
                }
                onDiscard={
                  merging &&
                  currentGroup &&
                  groupSelection(currentGroup) !== "none"
                    ? undefined
                    : () =>
                        currentGroup &&
                        openOperation("discard-file", {
                          file: current,
                          extraPaths: groupFiles(currentGroup)
                            .map((f) => f.path)
                            .filter((p) => p !== current?.path),
                        })
                }
                empty={
                  <div className="empty">
                    <CheckCircle2 />
                    <h2>{t("changes.emptyTitle")}</h2>
                    <p>
                      {t(
                        stashes.length
                          ? "changes.emptyStashed"
                          : "changes.clean",
                      )}
                    </p>
                  </div>
                }
              />
            )}
            {!merging && (
              <Composer
                repo={repo}
                selectedCount={selectedCount}
                total={groups.length}
              />
            )}
          </>
        )
      }
    />
  );
}
