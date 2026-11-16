import { Link } from "react-router";
import type { Season } from "../../shared/history.ts";
import type { Member } from "../../shared/members.ts";
import { personPath } from "../season-choice.ts";
import { t } from "../strings.ts";
import { MemberAvatar } from "./MemberAvatar.tsx";

/** A Member's avatar that opens their Person screen, on the given Season (the current one when left out). */
export function MemberAvatarLink({ member, season }: { member: Member; season?: Season }) {
  return (
    <Link to={personPath(member.id, season)} className="avatar-link" aria-label={t.person.open(member.name)} title={t.person.open(member.name)}>
      <MemberAvatar member={member} />
    </Link>
  );
}
