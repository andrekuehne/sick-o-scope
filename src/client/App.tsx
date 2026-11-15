import { Link, NavLink, Route, Routes } from "react-router";
import { t } from "./strings";

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo" aria-hidden="true">
          🤒
        </span>
        <span className="app-name">{t.appName}</span>
      </header>
      <main className="app-main">
        <Routes>
          <Route index element={<Placeholder title={t.today.title} text={t.today.placeholder} />} />
          <Route path="verlauf" element={<Placeholder title={t.timeline.title} text={t.timeline.placeholder} />} />
          <Route
            path="einstellungen"
            element={<Placeholder title={t.settings.title} text={t.settings.placeholder} />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <nav className="app-nav" aria-label={t.nav.label}>
        <NavItem to="/" icon="📋" label={t.nav.today} />
        <NavItem to="/verlauf" icon="📈" label={t.nav.timeline} />
        <NavItem to="/einstellungen" icon="⚙️" label={t.nav.settings} />
      </nav>
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
