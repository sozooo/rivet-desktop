import { useMemo, useState } from "react";
import {
  Copy,
  GitCommitHorizontal,
  History as HistoryIcon,
  RotateCcw,
  Undo2,
  X,
} from "lucide-react";
import { CommitFiles } from "../../diff/CommitFiles";
import { DiffView } from "../../diff/DiffView";
import { unresolved } from "../../git/conflicts";
import { layoutGraph, type GraphRow } from "../../git/graph";
import { fileName, shortSha } from "../../git/paths";
import type { Commit } from "../../git/types";
import { undoBlocker } from "../../git/undo";
import { useI18n } from "../../i18n/i18n";
import { FileIcon } from "../../ui/FileIcon";
import { initials, useAsync } from "../../ui/hooks";
import { Panes } from "../../ui/Panes";
import { useNotify } from "../../ui/Toast";
import type { RepoApi } from "../repoApi";
import { blockerKey } from "../useUndoCommit";
import { useRestoreFile } from "./useRestoreFile";

const LANE = 14,
  ROW = 64,
  NODE_Y = 22;
const x = (lane: number) => LANE / 2 + lane * LANE;
const link = (x1: number, y1: number, x2: number, y2: number) => {
  if (x1 === x2) return `M${x1} ${y1}V${y2}`;
  const mid = (y1 + y2) / 2;
  return `M${x1} ${y1}C${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`;
};

function GraphCell({ row, lanes }: { row: GraphRow; lanes: number }) {
  const lines: { d: string; lane: number }[] = [];
  for (const i of row.incoming) {
    const ends = i === row.lane || row.joining.includes(i);
    lines.push({
      d: ends ? link(x(i), 0, x(row.lane), NODE_Y) : `M${x(i)} 0V${ROW}`,
      lane: i,
    });
  }
  for (const p of row.parents)
    lines.push({ d: link(x(row.lane), NODE_Y, x(p), ROW), lane: p });
  return (
    <svg
      className="commit-graph"
      style={{ width: lanes * LANE, height: ROW }}
      viewBox={`0 0 ${lanes * LANE} ${ROW}`}
      aria-hidden="true"
    >
      {lines.map((l, i) => (
        <path key={i} d={l.d} className={`lane-${l.lane % 4}`} />
      ))}
      <circle
        cx={x(row.lane)}
        cy={NODE_Y}
        r={4.5}
        className={`lane-${row.lane % 4}`}
      />
    </svg>
  );
}

export function HistoryView({
  repo,
  phase,
  initialFile,
}: {
  repo: RepoApi;
  phase: string;
  /** Start on the commits that changed this file. */
  initialFile?: string;
}) {
  const { snapshot, backend, openOperation } = repo;
  const { commits, branches } = snapshot;
  const notify = useNotify();
  const { t, mode, timeAgo, language } = useI18n();
  const restoreFile = useRestoreFile(repo);
  const [query, setQuery] = useState("");
  const [sha, setSha] = useState<string>();
  const [path, setPath] = useState<string | undefined>(initialFile);
  /** Only the commits that changed this file, when set. */
  const [filePath, setFilePath] = useState(initialFile);
  const graph = useMemo(() => layoutGraph(commits), [commits]);
  const versions = useAsync(
    () =>
      filePath
        ? backend.fileHistory(filePath).catch(() => [])
        : Promise.resolve(undefined),
    [filePath, commits[0]?.sha],
  );
  const listed = filePath ? (versions?.map((v) => v.commit) ?? []) : commits;

  const commit =
    listed.find((c) => c.sha === sha) ??
    commits.find((c) => c.sha === sha) ??
    listed[0];
  const files = useAsync(
    () => (commit ? backend.commitFiles(commit.sha) : Promise.resolve([])),
    [commit?.sha],
  );
  const current = files?.find((f) => f.path === path) ?? files?.[0];
  const q = query.toLowerCase();
  const matches = new Set(
    listed.filter(
      (c) =>
        c.summary.toLowerCase().includes(q) ||
        c.author.name.toLowerCase().includes(q) ||
        c.sha.startsWith(q),
    ),
  );
  const merging = !!snapshot.operation || unresolved(snapshot.files).length > 0;
  // "Tuesday, 14:05" finds a version faster than "3 days ago".
  const dated = new Intl.DateTimeFormat(language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  function undo() {
    if (!commit) return;
    const reason = undoBlocker(snapshot, commit.sha);
    if (reason) notify(t(blockerKey(reason)), "warning");
    else
      openOperation("undo-commit", {
        commit,
        repositoryId: repo.repository.id,
      });
  }
  const undoButton = commit?.sha === commits[0]?.sha && (
    <button className="button" onClick={undo}>
      <Undo2 />
      {t("history.undo")}
    </button>
  );

  const commitRow = (c: Commit, i: number) => (
    <button
      className={`commit-row ${commit?.sha === c.sha ? "selected" : ""}`}
      key={c.sha}
      onClick={() => {
        setSha(c.sha);
        setPath(versions?.find((v) => v.commit.sha === c.sha)?.path);
      }}
    >
      {/* A filtered list has gaps, so the graph only makes sense unfiltered. */}
      {!query && !filePath && (
        <GraphCell row={graph.rows[i]} lanes={graph.width} />
      )}
      <div className="commit-text">
        <strong title={c.summary}>{c.summary}</strong>
        <small>
          {c.author.name} · {filePath ? dated.format(c.date) : timeAgo(c.date)}
        </small>
        {!filePath && (i === 0 || c.refs?.length) && (
          <span className="commit-refs">
            {i === 0 && <span className="branch-chip">{branches.current}</span>}
            {c.refs?.map((ref) => (
              <span className="tag" key={ref}>
                {ref}
              </span>
            ))}
          </span>
        )}
      </div>
    </button>
  );

  return (
    <Panes
      title={t("history.title")}
      phase={phase}
      search={{
        value: query,
        onChange: setQuery,
        placeholder: t("history.search"),
      }}
      sidebar={
        <>
          {filePath && (
            <div className="file-history-heading">
              <FileIcon path={filePath} />
              <strong title={filePath}>{fileName(filePath)}</strong>
              <button
                className="icon-button"
                title={t("history.showAll")}
                aria-label={t("history.showAll")}
                onClick={() => setFilePath(undefined)}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="group-heading">
            <span>{t(filePath ? "history.fileVersions" : "history.all")}</span>
            <span>{filePath && !versions ? "" : listed.length}</span>
          </div>
          {listed.map((c, i) => (matches.has(c) ? commitRow(c, i) : null))}
          {filePath && versions && !versions.length ? (
            <p className="list-empty">{t("history.noVersions")}</p>
          ) : (
            listed.length > 0 &&
            !matches.size && (
              <p className="list-empty">{t("history.noMatches")}</p>
            )
          )}
        </>
      }
      footer={
        <>
          <span className="status-dot" /> {t("history.footer")}
          {repo.demo && <span className="muted">{t("common.demo")}</span>}
        </>
      }
      main={
        filePath && !versions ? null : !commit ? (
          <div className="empty">
            <GitCommitHorizontal />
            <h2>{t("history.emptyTitle")}</h2>
            <p>{t("history.emptyText")}</p>
          </div>
        ) : (
          <>
            <div className="detail-header">
              <div className="eyebrow">{t("history.details")}</div>
              <h2>{commit.summary}</h2>
              <div className="metadata">
                <span className="avatar tiny">
                  {initials(commit.author.name)}
                </span>
                {commit.author.name}
                <span>· {timeAgo(commit.date)}</span>
                <code>{shortSha(commit.sha)}</code>
                <button
                  className="icon-button"
                  title={t("history.copySha")}
                  onClick={() =>
                    navigator.clipboard
                      .writeText(commit.sha)
                      .then(() => notify(t("common.shaCopied")))
                      .catch(() =>
                        notify(t("common.clipboardUnavailable"), "error"),
                      )
                  }
                >
                  <Copy size={13} />
                </button>
                <span>
                  {t("history.parent", { count: commit.parents.length })}{" "}
                  {commit.parents.map(shortSha).join(", ") || "—"}
                </span>
              </div>
              {commit.description && (
                <p className="commit-description">{commit.description}</p>
              )}
              {mode === "full" ? (
                <div className="detail-actions">
                  {undoButton}
                  {(
                    [
                      ["checkout", "history.checkout"],
                      ["cherry-pick", "history.cherryPick"],
                      ["revert", "history.revert"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      className="button"
                      key={id}
                      onClick={() => openOperation(id, { commit })}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
              ) : (
                undoButton && <div className="detail-actions">{undoButton}</div>
              )}
            </div>
            {files && (
              <CommitFiles
                key={commit.sha}
                files={files}
                selected={current?.path}
                onSelect={setPath}
              >
                <DiffView
                  file={current}
                  context={t("history.context")}
                  revisions={{ before: `${commit.sha}^`, after: commit.sha }}
                  actions={
                    current && (
                      <>
                        {!filePath && (
                          <button
                            className="text-button file-action"
                            title={t("history.fileHistory")}
                            onClick={() => {
                              setFilePath(current.path);
                              setQuery("");
                            }}
                          >
                            <HistoryIcon size={14} />
                            <span>{t("history.fileHistory")}</span>
                          </button>
                        )}
                        <button
                          className="text-button file-action"
                          disabled={merging}
                          title={
                            merging
                              ? t("top.syncMerging")
                              : t("history.restoreTitle", {
                                  name: fileName(current.path),
                                })
                          }
                          onClick={() => restoreFile(current, commit, files)}
                        >
                          <RotateCcw size={14} />
                          <span>{t("history.restore")}</span>
                        </button>
                      </>
                    )
                  }
                />
              </CommitFiles>
            )}
          </>
        )
      }
    />
  );
}
