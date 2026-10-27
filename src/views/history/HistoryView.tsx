import { useMemo, useState } from "react";
import { Copy, GitCommitHorizontal } from "lucide-react";
import { CommitFiles } from "../../diff/CommitFiles";
import { DiffView } from "../../diff/DiffView";
import { layoutGraph, type GraphRow } from "../../git/graph";
import { initials, timeAgo, useAsync } from "../../ui/hooks";
import { Panes } from "../../ui/Panes";
import { useNotify } from "../../ui/Toast";
import type { RepoApi } from "../repoApi";

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

export function HistoryView({ repo, phase }: { repo: RepoApi; phase: string }) {
  const { snapshot, backend, openOperation } = repo;
  const { commits, branches } = snapshot;
  const notify = useNotify();
  const [query, setQuery] = useState("");
  const [sha, setSha] = useState<string>();
  const [path, setPath] = useState<string>();
  const graph = useMemo(() => layoutGraph(commits), [commits]);

  const commit = commits.find((c) => c.sha === sha) ?? commits[0];
  const files = useAsync(
    () => (commit ? backend.commitFiles(commit.sha) : Promise.resolve([])),
    [commit?.sha],
  );
  const current = files?.find((f) => f.path === path) ?? files?.[0];
  const q = query.toLowerCase();
  const matches = new Set(
    commits.filter(
      (c) =>
        c.summary.toLowerCase().includes(q) ||
        c.author.name.toLowerCase().includes(q) ||
        c.sha.startsWith(q),
    ),
  );

  return (
    <Panes
      title="History"
      phase={phase}
      search={{
        value: query,
        onChange: setQuery,
        placeholder: "Search history…",
      }}
      sidebar={
        <>
          <div className="group-heading">
            <span>ALL COMMITS</span>
            <span>{commits.length}</span>
          </div>
          {commits.map((c, i) =>
            !matches.has(c) ? null : (
              <button
                className={`commit-row ${commit?.sha === c.sha ? "selected" : ""}`}
                key={c.sha}
                onClick={() => {
                  setSha(c.sha);
                  setPath(undefined);
                }}
              >
                {/* A filtered list has gaps, so the graph only makes sense unfiltered. */}
                {!query && (
                  <GraphCell row={graph.rows[i]} lanes={graph.width} />
                )}
                <div className="commit-text">
                  <strong title={c.summary}>{c.summary}</strong>
                  <small>
                    {c.author.name} · {timeAgo(c.date)}
                  </small>
                  {(i === 0 || c.refs?.length) && (
                    <span className="commit-refs">
                      {i === 0 && (
                        <span className="branch-chip">{branches.current}</span>
                      )}
                      {c.refs?.map((ref) => (
                        <span className="tag" key={ref}>
                          {ref}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </button>
            ),
          )}
          {!matches.size && <p className="list-empty">No matching commits.</p>}
        </>
      }
      footer={
        <>
          <span className="status-dot" /> Local repository
          <span className="muted">Demo</span>
        </>
      }
      main={
        !commit ? (
          <div className="empty">
            <GitCommitHorizontal />
            <h2>No commits yet</h2>
            <p>Your first commit will appear here.</p>
          </div>
        ) : (
          <>
            <div className="detail-header">
              <div className="eyebrow">COMMIT DETAILS</div>
              <h2>{commit.summary}</h2>
              <div className="metadata">
                <span className="avatar tiny">
                  {initials(commit.author.name)}
                </span>
                {commit.author.name}
                <span>· {timeAgo(commit.date)}</span>
                <code>{commit.sha}</code>
                <button
                  className="icon-button"
                  title="Copy SHA"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(commit.sha)
                      .then(() => notify("SHA copied"))
                      .catch(() => notify("Clipboard unavailable", "error"))
                  }
                >
                  <Copy size={13} />
                </button>
                <span>
                  {commit.parents.length > 1 ? "Parents" : "Parent"}{" "}
                  {commit.parents.join(", ") || "—"}
                </span>
              </div>
              {commit.description && (
                <p className="commit-description">{commit.description}</p>
              )}
              <div className="detail-actions">
                {(["checkout", "cherry-pick", "revert"] as const).map((id) => (
                  <button
                    className="button"
                    key={id}
                    onClick={() => openOperation(id, { commit })}
                  >
                    {
                      {
                        checkout: "Check out",
                        "cherry-pick": "Cherry-pick",
                        revert: "Revert",
                      }[id]
                    }
                    …
                  </button>
                ))}
              </div>
            </div>
            {files && (
              <CommitFiles
                key={commit.sha}
                files={files}
                selected={current?.path}
                onSelect={setPath}
              >
                <DiffView file={current} context="Commit → Parent" />
              </CommitFiles>
            )}
          </>
        )
      }
    />
  );
}
