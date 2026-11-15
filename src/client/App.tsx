import { useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router";
import type { Me } from "../shared/auth.ts";
import { signOut } from "./api.ts";
import { useMe, useSetMe } from "./me.ts";
import { SignInScreen } from "./screens/SignIn.tsx";
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
  if (me.isPending) {
    return (
      <Frame>
        <p className="muted">{t.loading}</p>
      </Frame>
    );
  }
  if (me.isError) {
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
        <Route index element={<Today me={me.data} />} />
        <Route path="verlauf" element={<Placeholder title={t.timeline.title} text={t.timeline.placeholder} />} />
        <Route path="einstellungen" element={<Settings me={me.data} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Frame>
  );
}

function Frame({ nav = false, children }: { nav?: boolean; children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo" aria-hidden="true">
          🤒
        </span>
        <span className="app-name">{t.appName}</span>
      </header>
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

function Today({ me }: { me: Me }) {
  return (
    <section className="screen">
      <h1>{t.today.greeting(me.user.name)}</h1>
      <p className="muted">{me.family.name}</p>
      <p className="muted">{t.today.placeholder}</p>
    </section>
  );
}

function Settings({ me }: { me: Me }) {
  const setMe = useSetMe();
  const [failed, setFailed] = useState(false);

  async function onSignOut() {
    try {
      await signOut();
      setMe(null);
    } catch {
      setFailed(true);
    }
  }

  return (
    <section className="screen">
      <h1>{t.settings.title}</h1>
      <p className="muted">{t.settings.signedInAs(me.user.name, me.family.name)}</p>
      <p className="muted">{t.settings.placeholder}</p>
      <button type="button" className="button" onClick={onSignOut}>
        {t.settings.signOut}
      </button>
      {failed && <p className="notice">{t.offlineOrError}</p>}
    </section>
  );
}

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <section className="screen">
      <h1>{title}</h1>
      <p className="muted">{text}</p>
    </section>
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
