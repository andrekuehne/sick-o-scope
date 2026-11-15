import { useEffect, useId, useRef, useState } from "react";
import { type CheckIn, CheckInState, NOTE_MAX_LENGTH, type Severity } from "../../shared/check-ins.ts";
import { SYMPTOM_GROUPS, type SymptomKey } from "../../shared/symptoms.ts";
import type { WriteCallbacks } from "../check-ins.ts";
import { t } from "../strings.ts";

const SEVERITIES = [1, 2, 3, 4, 5] as const satisfies readonly Severity[];
const STATUSES = [
  { status: "healthy", emoji: "🙂", label: t.sheet.healthy },
  { status: "sick", emoji: "🤒", label: t.sheet.sick },
] as const satisfies readonly { status: CheckIn["status"]; emoji: string; label: string }[];

/**
 * The editor for one Member's day, as a bottom sheet: Healthy or Sick, the Symptom Badges,
 * the Severity and a note. Saving replaces the whole day; Delete turns it back into a Gap.
 * Everything is a tap target, and the actions sit at the bottom, within reach of a thumb.
 */
export function CheckInSheet({
  title,
  checkIn,
  startAs,
  busy,
  onSave,
  onDelete,
  onSkip,
  onClose,
}: {
  title: string;
  /** The day's current Check-in; null for a Gap. */
  checkIn: CheckIn | null;
  /** What a Gap starts as, e.g. Sick when opened from "Krank…". */
  startAs: CheckIn["status"];
  busy: boolean;
  /** Both take callbacks for when the write is done (and the screen refreshed) or failed. */
  onSave: (state: CheckInState, done: WriteCallbacks) => void;
  onDelete: (done: WriteCallbacks) => void;
  /** When walking through several days: go on to the next one without saving this one. */
  onSkip?: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const noteId = useId();

  const [status, setStatus] = useState(checkIn?.status ?? startAs);
  // Symptoms and Severity survive a detour to Healthy, in case of a mis-tap.
  const [symptoms, setSymptoms] = useState<SymptomKey[]>(checkIn?.status === "sick" ? checkIn.symptoms : []);
  const [severity, setSeverity] = useState<Severity | null>(checkIn?.status === "sick" ? checkIn.severity : null);
  const [note, setNote] = useState(checkIn?.note ?? "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  // The same shared schema the API checks, so the sheet can't send what the server refuses.
  const parsed = CheckInState.safeParse(
    status === "healthy" ? { status, note } : { status, severity: severity ?? undefined, symptoms, note },
  );
  const done: WriteCallbacks = { onSuccess: onClose, onError: () => setFailed(true) };
  const toggle = (key: SymptomKey) =>
    setSymptoms((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  return (
    // Escape and Android's back gesture close a modal dialog; that only cancels.
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose}>
      <form
        className="sheet-body"
        onSubmit={(event) => {
          event.preventDefault();
          if (!parsed.success) return;
          setFailed(false);
          onSave(parsed.data, done);
        }}
      >
        <h2 id={titleId} className="sheet-title">
          {title}
        </h2>

        <fieldset className="field">
          <legend>{t.sheet.status}</legend>
          <div className="segmented">
            {STATUSES.map((option) => (
              <button
                key={option.status}
                type="button"
                className="choice status-choice"
                aria-pressed={status === option.status}
                onClick={() => setStatus(option.status)}
              >
                <span aria-hidden="true">{option.emoji}</span> {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        {status === "sick" && (
          <>
            <fieldset className="field">
              <legend>{t.sheet.severity}</legend>
              <div className="severity-choices">
                {SEVERITIES.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className="choice severity-choice"
                    data-severity={level}
                    aria-pressed={severity === level}
                    onClick={() => setSeverity(level)}
                  >
                    <span className="severity-level">{level}</span> {t.severity[level]}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="field">
              <legend>{t.sheet.symptoms}</legend>
              <span className="muted field-hint">{t.sheet.symptomsHint}</span>
              {SYMPTOM_GROUPS.map((group) => (
                <div key={group.name} className="symptom-group">
                  <h3 className="symptom-group-name">{group.name}</h3>
                  <div className="badge-grid">
                    {group.symptoms.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        className="choice badge-choice"
                        aria-pressed={symptoms.includes(s.key)}
                        aria-label={s.name}
                        onClick={() => toggle(s.key)}
                      >
                        <span className="badge-emoji" aria-hidden="true">
                          {s.badge}
                        </span>
                        <span className="badge-name" aria-hidden="true">
                          {s.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
          </>
        )}

        <div className="field">
          <label htmlFor={noteId}>{t.sheet.note}</label>
          <textarea
            id={noteId}
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            rows={2}
            placeholder={t.sheet.notePlaceholder}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="sheet-actions">
          {status === "sick" && severity === null && <p className="muted sheet-hint">{t.sheet.pickSeverity}</p>}
          {failed && <p className="notice sheet-hint">{t.offlineOrError}</p>}
          <button type="submit" className="button primary" disabled={busy || !parsed.success}>
            {t.sheet.save}
          </button>
          {checkIn && (
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => {
                setFailed(false);
                onDelete(done);
              }}
            >
              {t.sheet.deleteCheckIn}
            </button>
          )}
          {onSkip && (
            <button type="button" className="button" disabled={busy} onClick={onSkip}>
              {t.sheet.skip}
            </button>
          )}
          <button type="button" className="button" onClick={() => dialog.current?.close()}>
            {t.sheet.cancel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
