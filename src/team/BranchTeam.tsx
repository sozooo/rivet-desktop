import { activityFor } from "../git/activity";
import { useI18n } from "../i18n/i18n";
import { membersOf } from "./members";
import { MemberAvatar, useMemberName } from "./People";
import type { Team } from "./useTeam";

/** The Branches view's card of who worked on the selected branch lately. */
export function BranchTeam({ team, branch }: { team: Team; branch: string }) {
  const { t, timeAgo } = useI18n();
  const name = useMemberName();
  const { activity, mine, picture } = team;
  if (!activity) return null;
  const members = membersOf(activityFor(activity, branch), mine);
  return (
    <div className="branch-card branch-team">
      <div className="branch-card-title branch-team-title">
        <strong>{t("branches.team")}</strong>
        <span>{t("team.window", { count: activity.days })}</span>
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
        <div className="card-note">
          {t("team.nobodyHere", { count: activity.days })}
        </div>
      )}
    </div>
  );
}
