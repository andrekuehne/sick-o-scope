import { Link } from "react-router";
import { t } from "../strings.ts";

/** Shown instead of a screen's content while the Family has no Members yet. */
export function NoMembersNotice() {
  return (
    <p className="notice">
      {t.noMembers} <Link to="/einstellungen">{t.toSettings}</Link>
    </p>
  );
}
