import type { GitHubUser } from "../github/api";
import { useI18n } from "../i18n/i18n";
import { Avatar } from "../ui/Avatar";
import type { Member } from "./members";

/** A person's GitHub account by author email, or null for initials. */
export type Picture = (email: string) => GitHubUser | null;

/** "Jamie Chen", or "Alex Morgan (you)". */
export function useMemberName() {
  const { t } = useI18n();
  return (member: Member) =>
    member.you ? t("team.youName", { name: member.name }) : member.name;
}

/** "Jamie Chen, Sam Rivera and you", in the interface's language. */
export function useNameList() {
  const { t, language } = useI18n();
  return (members: Member[]) =>
    new Intl.ListFormat(language, { type: "conjunction" }).format(
      members.map((m) => (m.you ? t("team.you") : m.name)),
    );
}

/** "Jamie Chen (you): 3 versions, 2 hours ago", for a picture's tooltip. */
export function useMemberTitle() {
  const { t, timeAgo } = useI18n();
  const name = useMemberName();
  return (member: Member) =>
    t("team.person", {
      name: name(member),
      versions: t("team.versions", { count: member.commits }),
      time: timeAgo(member.last),
    });
}

export function MemberAvatar({
  member,
  picture,
  title,
}: {
  member: Member;
  picture: Picture;
  title?: string;
}) {
  const account = picture(member.email);
  return (
    <Avatar
      name={member.name}
      url={account?.avatarUrl}
      seed={member.key}
      title={title}
      className={member.you ? "you" : undefined}
    />
  );
}

/** Overlapping pictures, at most `max`, then "+N" for the rest. */
export function PeopleStack({
  members,
  picture,
  max = 4,
  titles = true,
}: {
  members: Member[];
  picture: Picture;
  max?: number;
  /** Each picture says who it is on hover; off where the whole row already does. */
  titles?: boolean;
}) {
  const title = useMemberTitle();
  const names = useNameList();
  const shown = members.slice(0, max);
  const rest = members.slice(max);
  return (
    <span className="people">
      {shown.map((member) => (
        <MemberAvatar
          key={member.key}
          member={member}
          picture={picture}
          title={titles ? title(member) : undefined}
        />
      ))}
      {rest.length > 0 && (
        <span
          className="avatar people-more"
          title={titles ? names(rest) : undefined}
        >
          +{rest.length}
        </span>
      )}
    </span>
  );
}
