import { useCallback, useRef, useState } from "react";
import { Cloud, GitBranch, Users } from "lucide-react";
import type { ActiveBranch } from "../git/activity";
import { localName } from "../git/branches";
import { useI18n } from "../i18n/i18n";
import { useDismiss } from "../ui/hooks";
import type { RepoApi } from "../views/repoApi";
import { membersOf, summarize } from "./members";
import { PeopleStack, useNameList } from "./People";
import { useTeam } from "./useTeam";

/** Faces in the toolbar before "+N". */
const TOOLBAR_FACES = 4;
/** Faces per branch in the list. */
const ROW_FACES = 3;

/**
 * Who has recently worked on the current branch, as faces beside the search,
 * and how many work elsewhere. A click lists every active branch with its
 * people; picking one switches to it. Stays away when nobody but me worked.
 */
export function Team({ repo }: { repo: RepoApi }) {
  const { t, mode, timeAgo } = useI18n();
  const { activity, mine, picture } = useTeam(repo);
  const names = useNameList();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  if (!activity) return null;
  const { current, local } = repo.snapshot.branches;
  const team = summarize(activity, current, mine);
  if (!team.anyone) return null;
  const { here, elsewhere } = team;
  const days = activity.days;

  const oneBranch = team.elsewhereBranches === 1;
  const elsewhereText = !elsewhere.length
    ? null
    : here.length
      ? t(oneBranch ? "team.moreElsewhere.one" : "team.moreElsewhere", {
          count: elsewhere.length,
        })
      : t(oneBranch ? "team.onlyElsewhere.one" : "team.onlyElsewhere", {
          count: elsewhere.length,
        });
  const title = t("team.title", { branch: current, count: days });
  // As the branch menu names them: simple mode drops the server's name.
  const onServer = (branch: ActiveBranch) =>
    !branch.refs.some((ref) => local.includes(ref));
  const label = (branch: ActiveBranch) =>
    mode === "full" || !onServer(branch) ? branch.name : localName(branch.name);

  function row(branch: ActiveBranch, isCurrent: boolean) {
    const members = membersOf(branch, mine);
    const content = (
      <>
        {onServer(branch) ? <Cloud /> : <GitBranch />}
        <span className="team-branch-text">
          <span className="team-branch-name">
            <span>{label(branch)}</span>
            {isCurrent && <span className="tag">{t("team.youAreHere")}</span>}
          </span>
          <span className="team-branch-who">{names(members)}</span>
          <span className="team-branch-meta">
            {timeAgo(branch.last)} ·{" "}
            {t("team.versions", { count: branch.commits })}
          </span>
        </span>
        <PeopleStack members={members} picture={picture} max={ROW_FACES} />
      </>
    );
    return isCurrent ? (
      <div key={branch.name} className="team-branch current">
        {content}
      </div>
    ) : (
      <button
        key={branch.name}
        className="team-branch"
        disabled={!!repo.switchBlocked}
        title={t("team.switchTo", { branch: label(branch) })}
        onClick={() => {
          close();
          repo.switchBranch(branch.name);
        }}
      >
        {content}
      </button>
    );
  }

  const others = team.branches.filter((b) => b !== team.branch);
  return (
    <div className="team" ref={ref}>
      <button
        className="team-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={title}
        title={title}
        onClick={() => setOpen(!open)}
      >
        {here.length ? (
          <PeopleStack members={here} picture={picture} max={TOOLBAR_FACES} />
        ) : (
          <Users />
        )}
        {elsewhereText && (
          <span className="team-elsewhere">{elsewhereText}</span>
        )}
      </button>
      {open && (
        <div
          className="dropdown team-menu"
          role="dialog"
          aria-label={t("team.heading")}
          data-tauri-drag-region="false"
        >
          <div className="team-menu-head">
            <strong>{t("team.heading")}</strong>
            <span>{t("team.window", { count: days })}</span>
          </div>
          {repo.switchBlocked && (
            <p className="branch-menu-note">{repo.switchBlocked}</p>
          )}
          <div className="team-branches">
            <small>{t("team.thisBranch")}</small>
            {team.branch ? (
              row(team.branch, true)
            ) : (
              <div className="team-branch current">
                <GitBranch />
                <span className="team-branch-text">
                  <span className="team-branch-name">
                    <span>{current}</span>
                    <span className="tag">{t("team.youAreHere")}</span>
                  </span>
                  <span className="team-branch-meta">
                    {t("team.nobodyHere", { count: days })}
                  </span>
                </span>
              </div>
            )}
            {others.length > 0 && <small>{t("team.otherBranches")}</small>}
            {others.map((branch) => row(branch, false))}
          </div>
        </div>
      )}
    </div>
  );
}
