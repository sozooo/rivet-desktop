import { useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  GitBranch,
  GitCommitHorizontal,
} from "lucide-react";
import { tooLarge } from "../../git/lfs";
import { fileName, selectionOf } from "../../git/paths";
import { useI18n } from "../../i18n/i18n";
import { initials, useStoredState } from "../../ui/hooks";
import type { RepoApi } from "../repoApi";
import { useLfsSetup } from "./LfsHint";

/**
 * Commit message and button. With nothing selected, the commit takes every
 * change; with a selection, only the selected parts.
 */
export function Composer({
  repo,
  selectedCount,
  total,
}: {
  repo: RepoApi;
  /** Rows in the Changes list with something selected. */
  selectedCount: number;
  /** Rows in the Changes list. */
  total: number;
}) {
  const { snapshot, act, repository } = repo;
  const { t, mode } = useI18n();
  const [draft, setDraft] = useStoredState(`rivet.draft.${repository.id}`, {
    summary: "",
    description: "",
  });
  const [collapsed, setCollapsed] = useStoredState(
    "rivet.composer.collapsed",
    false,
  );
  const count = selectedCount || total;
  // GitHub refuses files over 100 MB; committing one would make every sync fail.
  const included = selectedCount
    ? snapshot.files.filter((f) => selectionOf(f) !== "none")
    : snapshot.files;
  const large = included.filter(tooLarge);
  const [anyway, setAnyway] = useState(false);
  const blocked = large.length > 0 && !anyway;
  const lfs = useLfsSetup(repo);
  const ready = !!draft.summary.trim() && total > 0 && !blocked;
  // Simple mode asks for one line; details are a developer habit.
  const withDescription = mode === "full";

  async function submit() {
    if (!ready) return;
    const done = await act(
      (b) =>
        b.commit(
          withDescription ? draft : { ...draft, description: "" },
          selectedCount ? "staged" : "all",
        ),
      t("composer.done", { count }),
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
      aria-label={t("composer.summary")}
      maxLength={120}
      value={draft.summary}
      onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
      onKeyDown={onKeyDown}
      placeholder={t(
        collapsed ? "composer.summaryShort" : "composer.summaryPlaceholder",
      )}
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
          <strong>{t("composer.title")}</strong>
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <span>
          {!total
            ? t("composer.nothing")
            : selectedCount
              ? t("composer.selected", {
                  selected: selectedCount,
                  count: total,
                })
              : t("composer.all", { count: total })}
          {mode === "full" && (
            <>
              {" "}
              <span className="muted">{t("composer.on")}</span>{" "}
              <GitBranch size={12} />
              {snapshot.branches.current}
            </>
          )}
        </span>
      </div>
      {!collapsed && (
        <div className={`composer-fields ${withDescription ? "" : "single"}`}>
          {summaryInput()}
          {withDescription && (
            <textarea
              aria-label={t("composer.description")}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              onKeyDown={onKeyDown}
              placeholder={t("composer.descriptionPlaceholder")}
            />
          )}
        </div>
      )}
      {large.length > 0 && (
        <div className="card-warning composer-warning">
          <AlertTriangle />
          <span>
            {t("composer.tooLarge", {
              count: large.length,
              files: large.map((f) => fileName(f.path)).join(", "),
            })}
          </span>
          {snapshot.lfs.installed && (
            <button className="button" disabled={lfs.busy} onClick={lfs.setup}>
              {t("lfs.setup")}
            </button>
          )}
          {mode === "full" && !anyway && (
            <button className="text-button" onClick={() => setAnyway(true)}>
              {t("composer.commitAnyway")}
            </button>
          )}
        </div>
      )}
      <div className="composer-bottom">
        {collapsed ? (
          summaryInput("compact-title")
        ) : (
          <span className="composer-hint">
            <span className="avatar tiny">{initials(snapshot.user.name)}</span>
            {snapshot.user.name}
            <span className="muted">{t("composer.local")}</span>
          </span>
        )}
        <button
          className="button primary commit-submit"
          disabled={!ready}
          title={t(
            !total
              ? "composer.noChanges"
              : blocked
                ? "composer.tooLargeTitle"
                : !draft.summary.trim()
                  ? "composer.needSummary"
                  : "composer.shortcut",
          )}
          onClick={submit}
        >
          <GitCommitHorizontal size={16} />
          {!total
            ? t("composer.button")
            : selectedCount
              ? t("composer.buttonSelected", { count })
              : t("composer.buttonAll", { count })}
          <kbd>Ctrl ↵</kbd>
        </button>
      </div>
    </section>
  );
}
