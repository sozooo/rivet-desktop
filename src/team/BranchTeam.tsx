import { activityFor } from "../git/activity";
import { useI18n } from "../i18n/i18n";
import { membersOf } from "./members";
import { MemberAvatar, useMemberName } from "./People";
import type { Team } from "./useTeam";

/**
 * The Branches view's card of who worked on the selected branch over the last
 * year: whose branch it is, with those from long ago faded.
 */
export function BranchTeam({ team, branch }: { team: Team; branch: string }) {
  const { t, timeAgo } = useI18n();
  const name = useMemberName();
  const { history, mine, picture } = team;
  if (!history) return null;
  const members = membersOf(activityFor(history, branch), mine);
  return (
    <div className="branch-card branch-team">
      <div className="branch-card-title branch-team-title">
        <strong>{t("branches.team")}</strong>
        <span>{t("team.history")}</span>
      </div>
      {members.length ? (
        <div className="branch-team-list">
          {members.map((member) => (
            <div className="branch-team-person" key={member.key}>
              <MemberAvatar member={member} picture={picture} />
              <div>
                <strong>{name(member)}</strong>
                <small>
                  {t("team.versions", { count: member.commits })} ·{" "}
                  {timeAgo(member.last)}
                </small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-note">{t("team.nobodyInHistory")}</div>
      )}
    </div>
  );
}
