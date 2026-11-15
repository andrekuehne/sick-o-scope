import { useIsFetching, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Me } from "../../shared/auth.ts";
import type { Member, MemberInput } from "../../shared/members.ts";
import { MemberAvatar } from "../components/MemberAvatar.tsx";
import { UsersSettings } from "../components/UsersSettings.tsx";
import { addMember, exportCsvUrl, reorderMembers, setMemberArchived, signOut, updateMember } from "../api.ts";
import { MEMBER_COLOURS, MEMBER_EMOJIS, firstUnused } from "../member-options.ts";
import { ME_KEY, useSetMe } from "../me.ts";
import { forgetOfflineData } from "../offline-data.ts";
import { useOnline } from "../online.ts";
import { t } from "../strings.ts";

export function SettingsScreen({ me }: { me: Me }) {
  return (
    <section className="screen">
      <h1>{t.settings.title}</h1>
      <p className="muted">{t.settings.signedInAs(me.user.name, me.family.name)}</p>
      <MembersSettings me={me} />
      <UsersSettings me={me} />
      <h2>{t.settings.exportTitle}</h2>
      <p className="muted">{t.settings.exportIntro}</p>
      {/* A plain download: the browser sends the session cookie, the Worker sends the file. */}
      <a className="button link-button" href={exportCsvUrl(me.family.id)} download>
        📄 {t.settings.exportCsv}
      </a>
      <SignOutButton />
    </section>
  );
}

type Editing = { kind: "new" } | { kind: "edit"; member: Member } | null;

function MembersSettings({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const familyId = me.family.id;
  const active = me.members.filter((m) => !m.archived);
  const archived = me.members.filter((m) => m.archived);
  const [editing, setEditing] = useState<Editing>(null);

  // Every change re-reads /api/me, which carries the Members.
  const refreshMembers = () => queryClient.invalidateQueries({ queryKey: ME_KEY });

  /** Reordering and (un)archiving. One at a time: each builds on the list the last one produced. */
  const listChange = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: refreshMembers,
  });

  const saveMember = useMutation({
    mutationFn: ({ target, input }: { target: Editing; input: MemberInput }) =>
      target?.kind === "edit" ? updateMember(familyId, target.member.id, input) : addMember(familyId, input),
    onSuccess: async () => {
      await refreshMembers();
      setEditing(null);
    },
  });

  // While anything is being saved, the list on screen may be about to change: hold further taps.
  // Offline, nothing can be saved at all.
  const refreshing = useIsFetching({ queryKey: ME_KEY }) > 0;
  const online = useOnline();
  const busy = listChange.isPending || saveMember.isPending || refreshing || !online;

  function move(index: number, by: -1 | 1) {
    const ids = active.map((m) => m.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(index + by, 0, moved);
    listChange.mutate(() => reorderMembers(familyId, ids));
  }

  return (
    <>
      <h2>{t.members.title}</h2>
      <p className="muted">{t.members.intro}</p>
      {active.length === 0 && <p className="notice">{t.members.none}</p>}

      <ul className="member-list">
        {active.map((member, index) => (
          <li key={member.id} className="member-row">
            <MemberAvatar member={member} />
            <span className="member-name">{member.name}</span>
            <span className="member-actions">
              <IconButton
                label={t.members.moveUp(member.name)}
                disabled={busy || index === 0}
                onClick={() => move(index, -1)}
              >
                ⬆️
              </IconButton>
              <IconButton
                label={t.members.moveDown(member.name)}
                disabled={busy || index === active.length - 1}
                onClick={() => move(index, 1)}
              >
                ⬇️
              </IconButton>
              <IconButton label={t.members.edit(member.name)} onClick={() => setEditing({ kind: "edit", member })}>
                ✏️
              </IconButton>
              <IconButton
                label={t.members.archive(member.name)}
                disabled={busy}
                onClick={() => listChange.mutate(() => setMemberArchived(familyId, member.id, true))}
              >
                📦
              </IconButton>
            </span>
          </li>
        ))}
      </ul>

      {editing ? (
        <MemberForm
          key={editing.kind === "edit" ? editing.member.id : "new"}
          title={editing.kind === "edit" ? t.members.form.editTitle(editing.member.name) : t.members.form.addTitle}
          initial={
            editing.kind === "edit"
              ? editing.member
              : {
                  name: "",
                  emoji: firstUnused(MEMBER_EMOJIS, me.members.map((m) => m.emoji)),
                  colour: firstUnused(MEMBER_COLOURS, me.members.map((m) => m.colour)),
                }
          }
          busy={busy}
          onSave={(input) => saveMember.mutate({ target: editing, input })}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" className="button primary" onClick={() => setEditing({ kind: "new" })}>
          ➕ {t.members.add}
        </button>
      )}
      {(listChange.isError || saveMember.isError) && <p className="notice">{t.offlineOrError}</p>}

      {archived.length > 0 && (
        <>
          <h3>{t.members.archivedTitle}</h3>
          <p className="muted">{t.members.archivedIntro}</p>
          <ul className="member-list">
            {archived.map((member) => (
              <li key={member.id} className="member-row archived">
                <MemberAvatar member={member} />
                <span className="member-name">{member.name}</span>
                <button
                  type="button"
                  className="button small"
                  aria-label={t.members.unarchiveLabel(member.name)}
                  disabled={busy}
                  onClick={() => listChange.mutate(() => setMemberArchived(familyId, member.id, false))}
                >
                  {t.members.unarchive}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function MemberForm({
  title,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  title: string;
  initial: MemberInput;
  busy: boolean;
  onSave: (input: MemberInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [colour, setColour] = useState(initial.colour);
  // A Member's current look stays choosable even when it isn't one of the presets.
  const emojis = MEMBER_EMOJIS.includes(initial.emoji) ? MEMBER_EMOJIS : [initial.emoji, ...MEMBER_EMOJIS];
  const colours = MEMBER_COLOURS.includes(initial.colour) ? MEMBER_COLOURS : [initial.colour, ...MEMBER_COLOURS];

  return (
    <form
      className="card member-form"
      aria-label={title}
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onSave({ name: name.trim(), emoji, colour });
      }}
    >
      <h3>{title}</h3>
      <label className="field">
        <span>{t.members.form.name}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus />
      </label>

      <fieldset className="field">
        <legend>{t.members.form.emoji}</legend>
        <div className="choice-grid">
          {emojis.map((option) => (
            <button
              key={option}
              type="button"
              className="choice emoji-choice"
              aria-pressed={option === emoji}
              aria-label={option}
              onClick={() => setEmoji(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>{t.members.form.colour}</legend>
        <div className="choice-grid">
          {colours.map((option) => (
            <button
              key={option}
              type="button"
              className="choice colour-choice"
              aria-pressed={option === colour}
              aria-label={t.members.colourNames[option] ?? option}
              style={{ background: option }}
              onClick={() => setColour(option)}
            />
          ))}
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="button primary" disabled={busy || !name.trim()}>
          {t.members.form.save}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          {t.members.form.cancel}
        </button>
      </div>
    </form>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function SignOutButton() {
  const queryClient = useQueryClient();
  const setMe = useSetMe();
  const online = useOnline();
  const [failed, setFailed] = useState(false);

  async function onSignOut() {
    try {
      await signOut();
      forgetOfflineData(queryClient);
      setMe(null);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="sign-out">
      <button type="button" className="button" disabled={!online} onClick={onSignOut}>
        {t.settings.signOut}
      </button>
      {failed && <p className="notice">{t.offlineOrError}</p>}
    </div>
  );
}
