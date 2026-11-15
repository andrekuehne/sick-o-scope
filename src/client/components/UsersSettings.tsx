import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Me } from "../../shared/auth.ts";
import { fetchFamilyUsers, removeUser, signOutFamilyDevice } from "../api.ts";
import { daysAgo, useLocalToday } from "../dates.ts";
import { ME_KEY } from "../me.ts";
import { useOnline } from "../online.ts";
import { t } from "../strings.ts";
import { AddDeviceSheet } from "./AddDeviceSheet.tsx";

/**
 * Geräte & Zugang: every User of the Family with their Devices. Any User can sign out any
 * Device, remove a User (which signs out all their Devices) or add a Device.
 */
export function UsersSettings({ me }: { me: Me }) {
  const familyId = me.family.id;
  const today = useLocalToday();
  const queryClient = useQueryClient();
  const usersKey = ["users", familyId];
  const users = useQuery({ queryKey: usersKey, queryFn: () => fetchFamilyUsers(familyId) });
  const [adding, setAdding] = useState(false);

  // After a change, this Device may itself be signed out: re-reading /api/me then shows that.
  const refresh = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: usersKey }), queryClient.invalidateQueries({ queryKey: ME_KEY })]);
  const change = useMutation({ mutationFn: (run: () => Promise<void>) => run(), onSuccess: refresh });
  const online = useOnline();
  const busy = change.isPending || users.isFetching || !online;

  return (
    <>
      <h2>{t.users.title}</h2>
      <p className="muted">{t.users.intro}</p>
      {users.isPending && <p className="muted">{t.loading}</p>}

      <ul className="user-list">
        {users.data?.map((user) => (
          <li key={user.id} className="card user-card" aria-label={user.name}>
            <div className="user-head">
              <span className="user-name">{user.isMe ? t.users.you(user.name) : user.name}</span>
              {users.data.length > 1 && (
                <button
                  type="button"
                  className="button small"
                  aria-label={t.users.removeLabel(user.name)}
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(t.users.confirmRemove(user.name))) change.mutate(() => removeUser(familyId, user.id));
                  }}
                >
                  {t.users.remove}
                </button>
              )}
            </div>
            {user.devices.length === 0 && <p className="muted device-none">{t.users.noDevices}</p>}
            <ul className="device-list">
              {user.devices.map((device) => (
                <li key={device.id} className="device-row">
                  <span className="device-icon" aria-hidden="true">
                    📱
                  </span>
                  <span className="device-text">
                    <span className="device-label">
                      {device.label}
                      {device.isThisDevice && <span className="device-tag">{t.users.thisDevice}</span>}
                    </span>
                    <span className="muted device-seen">
                      {/* The server notes use at most once a day; this Device is in use right now. */}
                      {t.users.lastActive(daysAgo(device.isThisDevice ? new Date().toISOString() : device.lastSeenAt, today))}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="button small"
                    aria-label={t.users.signOutDeviceLabel(device.label, user.name)}
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(t.users.confirmSignOutDevice(device.label, user.name))) {
                        change.mutate(() => signOutFamilyDevice(familyId, device.id));
                      }
                    }}
                  >
                    {t.users.signOutDevice}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <button type="button" className="button primary" disabled={!users.data || !online} onClick={() => setAdding(true)}>
        📲 {t.users.addDevice}
      </button>
      {(change.isError || users.isError) && <p className="notice">{t.offlineOrError}</p>}

      {adding && users.data && (
        <AddDeviceSheet
          familyId={familyId}
          users={users.data}
          onClose={() => {
            setAdding(false);
            void refresh();
          }}
        />
      )}
    </>
  );
}
