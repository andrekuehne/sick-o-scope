import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, NavLink, Route, Routes } from "react-router";
import { useMe } from "./me.ts";
import { forgetOfflineData } from "./offline-data.ts";
import { useOnline } from "./online.ts";
import { SettingsScreen } from "./screens/Settings.tsx";
import { SignInScreen } from "./screens/SignIn.tsx";
import { TimelineScreen } from "./screens/Timeline.tsx";
import { TodayScreen } from "./screens/Today.tsx";
import { t } from "./strings.ts";

export function App() {
  return (
    <Routes>
      {/* Reachable without being signed in: that's where Sign-in links land. */}
      <Route path="anmelden" element={<Frame><SignInScreen /></Frame>} />
      <Route path="*" element={<SignedInApp />} />
    </Routes>
  );
}

/** Everything else needs a signed-in Device. */
function SignedInApp() {
  const me = useMe();
  const online = useOnline();
  useForgetDataWhenSignedOut(me.data === null);
  if (me.isPending) {
    // Opened offline with nothing kept from before: there's nothing to show yet.
    if (!online) {
      return (
        <Frame>
          <p className="notice">{t.offlineNothingLoaded}</p>
        </Frame>
      );
    }
    return (
      <Frame>
        <p className="muted">{t.loading}</p>
      </Frame>
    );
  }
  // A failed refresh keeps showing what was loaded before (for example offline).
  if (me.data === undefined) {
    return (
      <Frame>
        <p className="notice">{t.offlineOrError}</p>
      </Frame>
    );
  }
  if (!me.data) {
    return (
      <Frame>
        <section className="screen centered">
          <h1>{t.signedOut.title}</h1>
          <p className="muted">{t.askForNewLink}</p>
        </section>
      </Frame>
    );
  }
  return (
    <Frame nav>
      <Routes>
        <Route index element={<TodayScreen me={me.data} />} />
        <Route path="verlauf" element={<TimelineScreen me={me.data} />} />
        <Route path="einstellungen" element={<SettingsScreen me={me.data} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Frame>
  );
}

/** Once this Device is signed out (here or from another Device), the Family's data it kept is dropped. */
function useForgetDataWhenSignedOut(signedOut: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (signedOut) forgetOfflineData(queryClient);
  }, [signedOut, queryClient]);
}

function Frame({ nav = false, children }: { nav?: boolean; children: React.ReactNode }) {
  const online = useOnline();
  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo" aria-hidden="true">
          🤒
        </span>
        <span className="app-name">{t.appName}</span>
      </header>
      {!online && (
        <p className="offline-banner" role="status">
          {t.offline}
        </p>
      )}
      <main className="app-main">{children}</main>
      {nav && (
        <nav className="app-nav" aria-label={t.nav.label}>
          <NavItem to="/" icon="📋" label={t.nav.today} />
          <NavItem to="/verlauf" icon="📈" label={t.nav.timeline} />
          <NavItem to="/einstellungen" icon="⚙️" label={t.nav.settings} />
        </nav>
      )}
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink to={to} end className="app-nav-item">
      <span className="app-nav-icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </NavLink>
  );
}

function NotFound() {
  return (
    <section className="screen">
      <h1>{t.notFound.title}</h1>
      <p className="muted">{t.notFound.text}</p>
      <Link to="/">{t.notFound.back}</Link>
    </section>
  );
}
