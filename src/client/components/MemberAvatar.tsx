import type { Member } from "../../shared/members.ts";

/** A Member's emoji avatar, ringed in their colour. */
export function MemberAvatar({ member }: { member: Pick<Member, "emoji" | "colour"> }) {
  return (
    <span className="member-avatar" style={{ borderColor: member.colour }} aria-hidden="true">
      {member.emoji}
    </span>
  );
}
