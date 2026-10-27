import { useState } from "react";
import { Archive, CheckCircle2 } from "lucide-react";
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
import { useI18n } from "../../i18n/i18n";
import { Checkbox } from "../../ui/Checkbox";
import { FileIcon, StatusIcon } from "../../ui/FileIcon";
import { Panes } from "../../ui/Panes";
import type { RepoApi } from "../repoApi";
import { Composer } from "./Composer";
import { StashDetail, StashList, useStashName } from "./Stashes";

export function ChangesView({ repo, phase }: { repo: RepoApi; phase: string }) {
  const { snapshot, act, openOperation } = repo;
  const { files, stashes } = snapshot;
  const { t, mode } = useI18n();
  const stashName = useStashName();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>();
  // Stashes renumber when one is removed, so remember the viewed one by date.
  const [viewingStash, setViewingStash] = useState<number | null>(null);

  // An asset and its Unity .meta file are one row, selected together.
  const groups = groupWithMeta(files);
  const currentGroup = groups.find((g) => g.path === selected) ?? groups[0];
  const current = currentGroup && primaryFile(currentGroup);
  const states = groups.map(groupSelection);
  const selectedCount = states.filter((s) => s !== "none").length;
  const allState =
    selectedCount === 0
      ? false
      : states.every((s) => s === "all")
        ? true
        : ("mixed" as const);
  const visible = groups.filter((g) =>
    g.path.toLowerCase().includes(query.toLowerCase()),
  );
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
    const note = metaOnlyNote(g);
    const status = groupStatus(g);
    return (
      <div
        key={g.path}
        className={`file-row ${!stash && currentGroup?.path === g.path ? "selected" : ""} ${status === "deleted" ? "deleted" : ""}`}
      >
        <Checkbox
          checked={
            state === "all" ? true : state === "partial" ? "mixed" : false
          }
          label={t(state === "all" ? "changes.exclude" : "changes.include", {
            name,
          })}
          onChange={() => toggle(g)}
        />
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
            <small>
              {note ? t(note) : dirName(g.path) || t("common.repositoryRoot")}
            </small>
          </span>
          {/* A .meta-only change explains itself in the second line. */}
          {!note && <StatusIcon status={status} word={mode === "simple"} />}
        </button>
      </div>
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
        <>
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
          {!files.length && <p className="list-empty">{t("changes.clean")}</p>}
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
            <DiffView
              file={current}
              context={t("changes.diffContext")}
              revisions={{ before: "HEAD", after: "worktree" }}
              onToggleHunk={
                // Picking parts of a file is a full-mode tool.
                mode === "full"
                  ? (i) =>
                      current &&
                      act((b) =>
                        b.setStaged(current.path, !current.hunks[i].staged, i),
                      )
                  : undefined
              }
              onDiscard={() =>
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
                      stashes.length ? "changes.emptyStashed" : "changes.clean",
                    )}
                  </p>
                </div>
              }
            />
            <Composer
              repo={repo}
              selectedCount={selectedCount}
              total={groups.length}
            />
          </>
        )
      }
    />
  );
}
