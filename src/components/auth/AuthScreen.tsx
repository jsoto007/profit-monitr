"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { CheckIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import { SITE } from "@/data/site";
import { firstName, passwordScore, PRICE, PROMOS, SELLS, VENUE_TYPES } from "@/lib/util";
import { EMPTY_SIGNUP, validateStep, type Errors, type SignupFields } from "@/lib/validation";
import "./auth.css";

type Mode = "signup" | "login";
type Done = { firstName: string; venueName: string; firstLink: string; firstBrief: string };
type FieldErrors = Errors & { form?: string };

const STEPS = ["Your account", "Your venue", "Pilot terms"];
const PLAN = ["Works on top of Posh, Eventbrite, Resy, OpenTable or your site", "Unlimited tracked links & codes", "Ticket-order imports & one-click export", "The weekly brief, every Monday"];
const STRENGTH = ["", "Weak", "Fair", "Good", "Strong"];
const PROGRESS = ["0%", "33%", "66%", "100%", "100%"];
const TITLES: Record<Mode, string> = { signup: "Create your account — Profit Monitr", login: "Log in — Profit Monitr" };
/** Which step owns a field, so a server-side error can send the form back to it. */
const STEP_OF: Record<string, number> = { name: 1, email: 1, password: 1, venue: 2, city: 2, sells: 2, agree: 3 };
/** Long enough that the "Creating your account…" state reads as work, not a flash. */
const MIN_SUBMIT_MS = 700;

async function post<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string; fields?: Record<string, string> } }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: { error: "You appear to be offline. Check your connection and try again." } as T & { error?: string } };
  }
}

export function AuthScreen({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState(1);
  const [f, setF] = useState<SignupFields>(EMPTY_SIGNUP);
  const [err, setErr] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [shown, setShown] = useState(0);
  const [lf, setLf] = useState({ email: "", password: "" });
  const [lErr, setLErr] = useState("");
  const reveal = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => clearInterval(reveal.current), []);

  const switchMode = () => {
    const next: Mode = mode === "signup" ? "login" : "signup";
    setMode(next);
    setErr({});
    setLErr("");
    // Same screen, two addresses: keep the form state, update the URL and title.
    window.history.replaceState(null, "", `/${next}`);
    document.title = TITLES[next];
  };

  const onField = (e: ChangeEvent<HTMLInputElement>) => {
    const t = e.target;
    const val: string | boolean = t.type === "checkbox" ? t.checked : t.value;
    setF((s) => ({ ...s, [t.name]: val }));
    setErr((s) => ({ ...s, [t.name]: "", form: "" }));
  };
  const toggle = (key: "sells" | "promos", item: string) => {
    setF((s) => ({ ...s, [key]: s[key].includes(item) ? s[key].filter((x) => x !== item) : [...s[key], item] }));
    setErr((s) => ({ ...s, sells: "" }));
  };
  const back = () => {
    setStep((s) => Math.max(1, s - 1));
    setErr({});
  };

  const next = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errors = validateStep(step, f);
    if (Object.keys(errors).length) return setErr(errors);

    if (step === 1) {
      setBusy(true);
      const r = await post<{ exists?: boolean }>("/api/auth/check-email", { email: f.email });
      setBusy(false);
      if (r.data.exists) return setErr({ email: "An account with this email already exists. Log in instead." });
    }
    if (step < 3) {
      setStep(step + 1);
      setErr({});
      window.scrollTo(0, 0);
      return;
    }

    setBusy(true);
    const started = Date.now();
    // No card, no charge: the pilot is free and only the consent is sent.
    const r = await post<Done>("/api/auth/signup", {
      name: f.name, email: f.email, password: f.password,
      venue: f.venue, vtype: f.vtype, city: f.city, website: f.website, sells: f.sells, promos: f.promos,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      agree: f.agree,
    });
    await new Promise((res) => setTimeout(res, Math.max(0, MIN_SUBMIT_MS - (Date.now() - started))));
    setBusy(false);

    if (!r.ok) {
      const fields = r.data.fields ?? {};
      const first = Object.keys(fields).map((k) => STEP_OF[k]).filter(Boolean).sort()[0];
      if (first) setStep(first);
      return setErr(Object.keys(fields).length ? fields : { form: r.data.error || "Something went wrong. Please try again." });
    }

    setDone({ firstName: r.data.firstName, venueName: r.data.venueName, firstLink: r.data.firstLink, firstBrief: r.data.firstBrief });
    setStep(4);
    window.scrollTo(0, 0);
    let i = 0;
    reveal.current = setInterval(() => {
      i++;
      setShown(i);
      if (i >= 4) clearInterval(reveal.current);
    }, 550);
  };

  const login = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await post("/api/auth/login", lf);
    if (!r.ok) {
      setBusy(false);
      return setLErr(r.data.error || "We couldn’t find that email and password.");
    }
    router.push("/app");
    router.refresh();
  };

  const isSignup = mode === "signup";
  const score = passwordScore(f.password);
  const input = (name: keyof SignupFields, label: React.ReactNode, props: React.InputHTMLAttributes<HTMLInputElement> = {}, tight = false) => (
    <label className="field">
      <span>{label}</span>
      <input name={name} value={f[name] as string} onChange={onField} className={`input${tight ? " input-tight" : ""}${err[name] ? " is-error" : ""}`} aria-invalid={!!err[name]} aria-describedby={`${name}-err`} {...props} />
      <span id={`${name}-err`} className="field-error" role="alert">{err[name]}</span>
    </label>
  );

  return (
    <div className="frame au-frame">
      <aside className="au-side on-dark">
        <Link href="/" aria-label="Profit Monitr — home"><Logo reverse /></Link>
        {isSignup ? (
          <>
            <div>
              <h1>Start filling the room.</h1>
              <p className="au-side-sub">Three quick steps. Your tracked links are ready the moment you&apos;re in — nothing to migrate.</p>
            </div>
            <ol className="au-steps">
              {STEPS.map((label, i) => {
                const n = i + 1;
                const state = step > n ? " is-done" : step === n ? " is-current" : "";
                return (
                  <li key={label} className={`au-step${state}`} aria-current={step === n ? "step" : undefined}>
                    <span className="au-step-n">{step > n ? "✓" : n}</span>
                    {label}
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <div>
            <h1>Your Monday brief is waiting.</h1>
            <p className="au-side-sub">Log in to see what happened, why, and what to do next.</p>
          </div>
        )}
        <div className="au-plan">
          <div className="au-plan-head">
            <span className="au-plan-label">Free pilot</span>
            <span className="au-plan-price">{PRICE}<span> /mo after</span></span>
          </div>
          <ul className="au-plan-list">
            {PLAN.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
      </aside>

      <main className="au-main">
        <div className="au-top">
          <Link href="/" className="au-top-logo" aria-label="Profit Monitr — home"><Logo size={28} /></Link>
          <div className="au-switch">
            <span>{isSignup ? "Already have an account?" : "New to Profit Monitr?"}</span>
            <button type="button" className="btn btn-secondary btn-toggle" onClick={switchMode}>{isSignup ? "Log in" : "Create account"}</button>
          </div>
        </div>

        <div className="au-col">
          {isSignup && step < 4 && (
            <>
              <div className="au-progress" role="progressbar" aria-label="Sign-up progress" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step}>
                <div style={{ width: PROGRESS[step] }} />
              </div>
              <form onSubmit={next} noValidate>
                {step === 1 && (
                  <div className="au-stack">
                    <div>
                      <div className="kicker">STEP 1 OF 3</div>
                      <h2 className="au-title">Create your account</h2>
                    </div>
                    {input("name", "Full name", { autoComplete: "name", placeholder: "Alex Rivera" })}
                    {input("email", "Work email", { type: "email", autoComplete: "email", placeholder: "you@yourvenue.com" })}
                    <label className="field">
                      <span>Password</span>
                      <input type="password" name="password" autoComplete="new-password" value={f.password} onChange={onField} placeholder="At least 8 characters" className={`input${err.password ? " is-error" : ""}`} aria-invalid={!!err.password} aria-describedby="password-err" />
                      <span className="au-meter" data-score={score}>
                        {[1, 2, 3, 4].map((n) => <i key={n} className={score >= n ? "on" : undefined} />)}
                        <span aria-live="polite">{STRENGTH[score]}</span>
                      </span>
                      <span id="password-err" className="field-error" role="alert">{err.password}</span>
                    </label>
                    <button type="submit" className="btn" style={{ justifySelf: "start" }} disabled={busy}>Continue →</button>
                  </div>
                )}

                {step === 2 && (
                  <div className="au-stack">
                    <div>
                      <div className="kicker">STEP 2 OF 3</div>
                      <h2 className="au-title">Tell us about your venue</h2>
                    </div>
                    {input("venue", "Venue name", { placeholder: "The Copper Room" })}
                    <div className="au-group" role="radiogroup" aria-labelledby="vtype-label">
                      <span id="vtype-label" className="au-group-label">Venue type</span>
                      <div className="au-chips">
                        {VENUE_TYPES.map((t) => (
                          <button key={t} type="button" role="radio" aria-checked={f.vtype === t} className="chip" onClick={() => setF((s) => ({ ...s, vtype: t }))}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div className="au-two">
                      {input("city", "City", { placeholder: "Brooklyn, NY" })}
                      {input("website", <>Current website <span className="optional">(optional)</span></>, { placeholder: "yourvenue.com" })}
                    </div>
                    <div className="au-group" role="group" aria-labelledby="sells-label">
                      <span id="sells-label" className="au-group-label">What do you sell?</span>
                      <div className="au-chips">
                        {SELLS.map((t) => (
                          <button key={t} type="button" aria-pressed={f.sells.includes(t)} className="chip" onClick={() => toggle("sells", t)}>{t}</button>
                        ))}
                      </div>
                      <span className="field-error" role="alert">{err.sells}</span>
                    </div>
                    <div className="au-group" role="group" aria-labelledby="promos-label">
                      <span id="promos-label" className="au-group-label">Where do you promote today?</span>
                      <div className="au-chips">
                        {PROMOS.map((t) => (
                          <button key={t} type="button" aria-pressed={f.promos.includes(t)} className="chip" onClick={() => toggle("promos", t)}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div className="au-buttons">
                      <button type="button" className="btn btn-secondary" onClick={back}>Back</button>
                      <button type="submit" className="btn">Continue →</button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="au-stack">
                    <div>
                      <div className="kicker">STEP 3 OF 3</div>
                      <h2 className="au-title">Your free pilot</h2>
                      <p className="au-note">No card today. {SITE.pilotLine}</p>
                    </div>
                    <ul className="au-pilot-list">
                      <li>Your tracked links and promo codes point at the booking page you already use.</li>
                      <li>Your data stays yours: export it any time, and we delete it when you ask.</li>
                      <li>Nothing is charged, now or later, without a separate agreement with you.</li>
                    </ul>
                    <div className="au-due">
                      <span>Due today</span>
                      <span>$0</span>
                    </div>
                    <label className="au-consent">
                      <input type="checkbox" name="agree" checked={f.agree} onChange={onField} />
                      <span>I agree to the <Link href="/pilot-terms" target="_blank">pilot terms</Link> and the <Link href="/privacy" target="_blank">privacy notice</Link>.</span>
                    </label>
                    <div className="field-error au-consent-error" role="alert">{err.agree || err.form}</div>
                    <div className="au-buttons">
                      <button type="button" className="btn btn-secondary" onClick={back} disabled={busy}>Back</button>
                      {busy ? (
                        <button type="button" className="btn btn-busy" disabled><span className="spinner" />Creating your account…</button>
                      ) : (
                        <button type="submit" className="btn">Start my pilot →</button>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </>
          )}

          {isSignup && step === 4 && done && (
            <div className="au-done">
              <div className="au-done-badge"><CheckIcon size={30} stroke={3} /></div>
              <div>
                <h2>You&apos;re in, {firstName(done.firstName)}.</h2>
                <p className="au-done-sub">We&apos;re setting up {done.venueName} right now.</p>
              </div>
              <div className="au-done-rows">
                {["Account created", "Your tracked links and promo codes are ready", `First tracked link: ${done.firstLink}`, `First weekly brief scheduled for ${done.firstBrief}`].map((row, i) => (
                  <div key={i} className={`au-done-row${shown > i ? " is-on" : ""}`}>
                    <CheckIcon stroke={3} />
                    <span>{row}</span>
                  </div>
                ))}
              </div>
              <Link href="/app" className={`au-done-go${shown >= 4 ? " is-on" : ""}`} tabIndex={shown >= 4 ? 0 : -1} aria-hidden={shown < 4}>Go to your dashboard →</Link>
            </div>
          )}

          {!isSignup && (
            <form onSubmit={login} noValidate className="au-login">
              <h2 className="au-title">Log in</h2>
              <label className="field">
                <span>Email</span>
                <input type="email" name="email" autoComplete="email" value={lf.email} onChange={(e) => { setLf((s) => ({ ...s, email: e.target.value })); setLErr(""); }} placeholder="you@yourvenue.com" className="input" />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" name="password" autoComplete="current-password" value={lf.password} onChange={(e) => { setLf((s) => ({ ...s, password: e.target.value })); setLErr(""); }} className="input" />
              </label>
              <div className="field-error" role="alert">{lErr}</div>
              <button type="submit" className="btn" style={{ justifySelf: "start" }} disabled={busy}>Log in →</button>
            </form>
          )}
          {!isSignup && (
            // A POST, not a link: it signs the visitor into the shared, read-only demo venue.
            <form action="/api/auth/demo" method="post" className="au-demo">
              <span>Just looking?</span>
              <button type="submit" className="btn btn-secondary btn-toggle">Explore the demo venue</button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
