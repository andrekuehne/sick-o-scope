import { useMutation } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { renderSVG } from "uqr";
import { type FamilyUsers, USER_NAME_MAX_LENGTH, UserName } from "../../shared/users.ts";
import { createSignInLink } from "../api.ts";
import { dateTime } from "../dates.ts";
import { useOnline } from "../online.ts";
import { t } from "../strings.ts";

/**
 * Gerät hinzufügen, as a bottom sheet: pick an existing User (a new phone) or name a new
 * one, then hand over the Sign-in link by sharing it or as a QR code to scan.
 * The link's URL exists only here; closing the sheet forgets it.
 */
export function AddDeviceSheet({
  familyId,
  users,
  onClose,
}: {
  familyId: string;
  users: FamilyUsers["users"];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Which User the link is for; null for a new User, named below.
  const [forUserId, setForUserId] = useState<string | null>(users.find((u) => u.isMe)?.id ?? null);
  const [newName, setNewName] = useState("");
  const newUserName = UserName.safeParse(newName);
  const ready = forUserId !== null || newUserName.success;
  const create = useMutation({
    mutationFn: () => createSignInLink(familyId, forUserId !== null ? { forUserId } : { newUserName: newName }),
  });
  const linkFor = forUserId !== null ? (users.find((u) => u.id === forUserId)?.name ?? "") : newName.trim();
  const close = () => dialog.current?.close();
  const online = useOnline();

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    // Escape and Android's back gesture close a modal dialog.
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose}>
      <div className="sheet-body">
        <h2 id={titleId} className="sheet-title">
          {create.data ? t.addDevice.linkFor(linkFor) : t.addDevice.title}
        </h2>
        {create.data ? (
          <>
            <LinkHandover url={create.data.url} expiresAt={create.data.expiresAt} name={linkFor} />
            <div className="sheet-actions">
              <button type="button" className="button" onClick={close}>
                {t.addDevice.done}
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (ready) create.mutate();
            }}
          >
            <fieldset className="field">
              <legend>{t.addDevice.forWhom}</legend>
              {[...users.map((u) => ({ id: u.id, label: u.name })), { id: null, label: t.addDevice.newUser }].map(
                (option) => (
                  <label key={option.id ?? "new"} className="radio-row">
                    <input
                      type="radio"
                      name="for-whom"
                      checked={forUserId === option.id}
                      onChange={() => setForUserId(option.id)}
                    />
                    {option.label}
                  </label>
                ),
              )}
            </fieldset>
            {forUserId === null && (
              <label className="field">
                <span>{t.addDevice.newUserName}</span>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={USER_NAME_MAX_LENGTH}
                  autoFocus
                />
              </label>
            )}
            <div className="sheet-actions">
              {create.isError && <p className="notice sheet-hint">{t.offlineOrError}</p>}
              <button type="submit" className="button primary" disabled={create.isPending || !ready || !online}>
                {t.addDevice.create}
              </button>
              <button type="button" className="button" onClick={close}>
                {t.sheet.cancel}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

/** The link as a QR code, plus Share (Android's share sheet) or, where there is none, Copy. */
function LinkHandover({ url, expiresAt, name }: { url: string; expiresAt: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === "function";
  const qrCode = `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(url, { border: 2 }))}`;

  return (
    <div className="link-handover">
      <p>{t.addDevice.howTo}</p>
      <img className="qr-code" src={qrCode} alt={t.addDevice.qrCode} />
      <p className="muted">{t.addDevice.validUntil(dateTime(expiresAt))}</p>
      <input className="link-text" readOnly value={url} aria-label={t.addDevice.link} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="button primary"
        onClick={async () => {
          if (canShare) {
            // Closing the share sheet without choosing an app rejects; that's fine.
            await navigator.share({ text: t.addDevice.shareText(name), url }).catch(() => {});
          } else {
            // Without clipboard access, the link above can still be selected and copied by hand.
            setCopied(await navigator.clipboard.writeText(url).then(() => true, () => false));
          }
        }}
      >
        {canShare ? t.addDevice.share : copied ? t.addDevice.copied : t.addDevice.copy}
      </button>
    </div>
  );
}
