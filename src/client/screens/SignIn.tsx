import { useState } from "react";
import { useNavigate } from "react-router";
import { type SignInResult, signIn } from "../api.ts";
import { useSetMe } from "../me.ts";
import { t } from "../strings.ts";

/**
 * Where a Sign-in link lands (`/anmelden#<token>`). Nothing happens until the
 * Anmelden button is tapped, so opening or previewing the link never uses it up.
 */
export function SignInScreen() {
  const navigate = useNavigate();
  const setMe = useSetMe();
  const [token] = useState(() => window.location.hash.slice(1));
  const [state, setState] = useState<"idle" | "busy" | "error" | SignInResult>("idle");

  async function onSignIn() {
    setState("busy");
    try {
      const result = await signIn(token);
      if (result.ok) {
        setMe(result.me);
        navigate("/", { replace: true });
      } else {
        setState(result);
      }
    } catch {
      setState("error");
    }
  }

  const failure = typeof state === "object" && !state.ok ? state.reason : token ? null : "unknown";

  return (
    <section className="screen centered">
      <h1>{t.signIn.title}</h1>
      {failure ? (
        <>
          <p className="notice">{t.signIn.failed[failure]}</p>
          <p className="muted">{t.askForNewLink}</p>
        </>
      ) : (
        <>
          <p className="muted">{t.signIn.text}</p>
          <button type="button" className="button primary" onClick={onSignIn} disabled={state === "busy"}>
            {state === "busy" ? t.signIn.busy : t.signIn.button}
          </button>
          {state === "error" && <p className="notice">{t.offlineOrError}</p>}
        </>
      )}
    </section>
  );
}
