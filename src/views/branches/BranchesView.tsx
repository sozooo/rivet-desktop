import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  GitBranch,
  GitCommitHorizontal,
  Globe,
  Tag,
} from "lucide-react";
import { shortSha } from "../../git/paths";
import { useI18n } from "../../i18n/i18n";
import { useAsync } from "../../ui/hooks";
import { Panes } from "../../ui/Panes";
import type { RepoApi } from "../repoApi";

export function BranchesView({
  repo,
  phase,
  onHistory,
}: {
  repo: RepoApi;
  phase: string;
  onHistory: () => void;
}) {
  const { snapshot, backend, openOperation } = repo;
  const { branches, commits } = snapshot;
  const { t, timeAgo } = useI18n();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState(branches.current);
  const isCurrent = target === branches.current;
  const isLocal = branches.local.includes(target);
  // A server branch gets a local copy; a tag would leave no branch to work on.
  const canSwitch = isLocal || branches.remote.includes(target);
  const divergence = useAsync(
    () => backend.compareBranch(target, "main"),
    [target],
  );
  const groups = [
    { label: t("branches.local"), items: branches.local, Icon: GitBranch },
    { label: t("branches.remote"), items: branches.remote, Icon: Globe },
    { label: t("branches.tags"), items: branches.tags, Icon: Tag },
  ];
  const q = query.toLowerCase();

  return (
    <Panes
      title={t("branches.title")}
      phase={phase}
      search={{
        value: query,
        onChange: setQuery,
        placeholder: t("branches.search"),
      }}
      sidebar={groups.map(({ label, items, Icon }) => (
        <section key={label}>
          <div className="group-heading">
            <span>{label}</span>
            <span>{items.length}</span>
          </div>
          {items
            .filter((b) => b.toLowerCase().includes(q))
            .map((b) => (
              <button
                key={b}
                className={`object-row ${target === b ? "selected" : ""}`}
                onClick={() => setTarget(b)}
              >
                <Icon size={16} />
                <span>{b}</span>
                {b === branches.current && (
                  <Check size={14} aria-label={t("branches.current")} />
                )}
              </button>
            ))}
        </section>
      ))}
      footer={
        <>
          <span className="status-dot" /> {t("history.footer")}
          {repo.demo && <span className="muted">{t("common.demo")}</span>}
        </>
      }
      main={
        <div className="branch-workspace">
          <div className="eyebrow">{t("branches.overview")}</div>
          <div className="branch-heading">
            <div className="branch-symbol">
              <GitBranch size={25} />
            </div>
            <div>
              <h2>{target}</h2>
              <p>
                {isCurrent ? (
                  <>
                    <span className="status-dot" />
                    {t("branches.youAreHere")}
                  </>
                ) : (
                  t(isLocal ? "branches.localBranch" : "branches.remoteOrTag")
                )}
              </p>
            </div>
          </div>
          <div className="branch-actions">
            {isCurrent ? (
              <button
                className="button"
                onClick={() => openOperation("new-branch")}
              >
                <GitBranch size={14} />
                {t("branches.newFromHere")}
              </button>
            ) : (
              <>
                <button
                  className="button primary"
                  disabled={!canSwitch}
                  title={canSwitch ? undefined : t("branches.notTag")}
                  onClick={() => openOperation("switch-branch", { target })}
                >
                  <GitBranch size={14} />
                  {t("branches.switch")}
                </button>
                <button
                  className="button"
                  onClick={() => openOperation("merge", { target })}
                >
                  {t("branches.merge", { branch: branches.current })}
                </button>
                <button
                  className="button"
                  onClick={() => openOperation("rebase", { target })}
                >
                  {t("branches.rebase", { branch: branches.current })}
                </button>
              </>
            )}
          </div>
          <div className="branch-card">
            <div className="branch-card-title">
              <strong>{t("branches.compared")}</strong>
              <span className="tag">origin</span>
            </div>
            <div className="divergence">
              <div>
                <ArrowUp />
                <strong>{divergence?.ahead ?? "–"}</strong>
                <span>
                  {t("branches.ahead", { count: divergence?.ahead ?? 0 })}
                </span>
              </div>
              <div>
                <ArrowDown />
                <strong>{divergence?.behind ?? "–"}</strong>
                <span>
                  {t("branches.behind", { count: divergence?.behind ?? 0 })}
                </span>
              </div>
            </div>
            <div className="branch-diagram precise-diagram">
              <svg
                viewBox="0 0 560 100"
                role="img"
                aria-label={t("branches.diagram", { branch: target })}
              >
                <path className="main-track" d="M20 25H132" />
                <path className="feature-track" d="M20 25V47Q20 70 44 70H188" />
                {[20, 76, 132].map((cx) => (
                  <circle
                    className="main-node"
                    key={cx}
                    cx={cx}
                    cy="25"
                    r="4"
                  />
                ))}
                {[76, 132, 188].map((cx) => (
                  <circle
                    className="feature-node"
                    key={cx}
                    cx={cx}
                    cy="70"
                    r="4"
                  />
                ))}
                <text x="240" y="29">
                  main
                </text>
                <text className="feature-label" x="240" y="74">
                  {target.length > 43 ? target.slice(0, 40) + "…" : target}
                </text>
              </svg>
            </div>
            <div className="card-note">{t("branches.note")}</div>
          </div>
          <div className="recent-heading">
            <h3>{t("branches.recent")}</h3>
            <button className="text-button" onClick={onHistory}>
              {t("branches.viewHistory")} <ArrowRight size={14} />
            </button>
          </div>
          {commits.slice(0, 3).map((c) => (
            <div className="recent-commit" key={c.sha}>
              <GitCommitHorizontal />
              <div>
                <strong>{c.summary}</strong>
                <small>
                  {c.author.name} · {timeAgo(c.date)}
                </small>
              </div>
              <code>{shortSha(c.sha)}</code>
            </div>
          ))}
        </div>
      }
    />
  );
}
