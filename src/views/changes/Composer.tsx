import type { KeyboardEvent } from "react";
import {
  ChevronDown,
  ChevronUp,
  GitBranch,
  GitCommitHorizontal,
} from "lucide-react";
import { initials, useStoredState } from "../../ui/hooks";
import type { RepoApi } from "../repoApi";

const files = (n: number) => `${n} ${n === 1 ? "file" : "files"}`;

/**
 * Commit message and button. With nothing selected, the commit takes every
 * change; with a selection, only the selected parts.
 */
export function Composer({
  repo,
  selectedCount,
}: {
  repo: RepoApi;
  selectedCount: number;
}) {
  const { snapshot, act, repository } = repo;
  const total = snapshot.files.length;
  const [draft, setDraft] = useStoredState(`rivet.draft.${repository.id}`, {
    summary: "",
    description: "",
  });
  const [collapsed, setCollapsed] = useStoredState(
    "rivet.composer.collapsed",
    false,
  );
  const count = selectedCount || total;
  const ready = !!draft.summary.trim() && total > 0;

  async function submit() {
    if (!ready) return;
    const done = await act(
      (b) => b.commit(draft, selectedCount ? "staged" : "all"),
      `Committed ${files(count)}.`,
    );
    if (done) setDraft({ summary: "", description: "" });
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };
  const summaryInput = (className?: string) => (
    <input
      className={className}
      aria-label="Commit summary"
      maxLength={120}
      value={draft.summary}
      onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
      onKeyDown={onKeyDown}
      placeholder={
        collapsed ? "Commit summary…" : "A short, meaningful summary…"
      }
    />
  );

  return (
    <section className={`composer ${collapsed ? "collapsed" : ""}`}>
      <div className="composer-heading">
        <button
          className="text-button"
          onClick={() => setCollapsed(!collapsed)}
        >
          <GitCommitHorizontal size={17} />
          <strong>Commit changes</strong>
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <span>
          {!total ? (
            "Nothing to commit"
          ) : selectedCount ? (
            <>
              <b>{selectedCount}</b> of {files(total)} selected
            </>
          ) : (
            <>
              Nothing selected, so all <b>{total}</b> will be committed
            </>
          )}{" "}
          <span className="muted">on</span> <GitBranch size={12} />
          {snapshot.branches.current}
        </span>
      </div>
      {!collapsed && (
        <div className="composer-fields">
          {summaryInput()}
          <textarea
            aria-label="Commit description"
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            onKeyDown={onKeyDown}
            placeholder="Add a description (optional)"
          />
        </div>
      )}
      <div className="composer-bottom">
        {collapsed ? (
          summaryInput("compact-title")
        ) : (
          <span className="composer-hint">
            <span className="avatar tiny">{initials(snapshot.user.name)}</span>
            {snapshot.user.name}
            <span className="muted">· Local commit</span>
          </span>
        )}
        <button
          className="button primary commit-submit"
          disabled={!ready}
          title={
            !total
              ? "There are no changes to commit"
              : !draft.summary.trim()
                ? "Write a summary first"
                : "Commit (Ctrl+Enter)"
          }
          onClick={submit}
        >
          <GitCommitHorizontal size={16} />
          {!total
            ? "Commit"
            : selectedCount
              ? `Commit ${files(count)}`
              : `Commit all ${files(count)}`}
          <kbd>Ctrl ↵</kbd>
        </button>
      </div>
    </section>
  );
}
