"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createUserSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isBrowserSupabaseConfigured } from "@/lib/supabase/browserConfigured";
import { buildOAuthCallbackUrl, getOAuthRedirectOrigin, stashOAuthNextPath, stashOAuthProvider } from "@/lib/oauthRedirectOrigin";

type Provider = "azure" | "google";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5 shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l6.3 5.3C37.4 38.3 44 34 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 21 21" aria-hidden="true" className="size-5 shrink-0">
      <path fill="#F25022" d="M1 1h9v9H1z" />
      <path fill="#7FBA00" d="M11 1h9v9h-9z" />
      <path fill="#00A4EF" d="M1 11h9v9H1z" />
      <path fill="#FFB900" d="M11 11h9v9h-9z" />
    </svg>
  );
}

type Availability = { googleEnabled: boolean | null; microsoftEnabled: boolean | null; emailEnabled: boolean | null; hostedDomain: string | null };

/** Course sign-in: Microsoft for students (university tenant), an emailed code as the fallback, Google for staff on other domains. */
export function UcscGoogleButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityError, setAvailabilityError] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/cse115a/auth-availability")
      .then((response) => response.json())
      .then((body: Partial<Availability>) => {
        if (!active) return;
        setAvailability({
          googleEnabled: body.googleEnabled ?? null,
          microsoftEnabled: body.microsoftEnabled ?? null,
          emailEnabled: body.emailEnabled ?? null,
          hostedDomain: body.hostedDomain ?? null,
        });
      })
      .catch(() => { if (active) setAvailabilityError(true); });
    return () => { active = false; };
  }, []);

  async function begin(provider: Provider) {
    const enabled = provider === "azure" ? availability?.microsoftEnabled : availability?.googleEnabled;
    const name = provider === "azure" ? "Microsoft" : "Google";
    if (enabled !== true) {
      setError(`${name} sign in has not been enabled yet.`);
      return;
    }
    if (!isBrowserSupabaseConfigured()) {
      setError("Sign in is not configured for this preview.");
      return;
    }
    setBusy(provider);
    setError(null);
    try {
      const supabase = createUserSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      stashOAuthNextPath("/cse115a/dashboard");
      stashOAuthProvider(provider);
      const hint = availability?.hostedDomain;
      const options = provider === "azure"
        ? {
          redirectTo: buildOAuthCallbackUrl(getOAuthRedirectOrigin()),
          scopes: "email openid profile",
          queryParams: { prompt: "select_account", ...(hint ? { domain_hint: hint } : {}) } as Record<string, string>,
        }
        : {
          redirectTo: buildOAuthCallbackUrl(getOAuthRedirectOrigin()),
          queryParams: { prompt: "select_account" } as Record<string, string>,
        };
      const result = user?.identities?.some((identity) => identity.provider === provider)
        ? await supabase.auth.signInWithOAuth({ provider, options })
        : user
          ? await supabase.auth.linkIdentity({ provider, options })
          : await supabase.auth.signInWithOAuth({ provider, options });
      if (result.error) setError(result.error.message);
    } catch {
      setError(`Could not start ${name} sign in. Please try again.`);
    } finally {
      setBusy(null);
    }
  }

  const statusClass = fullWidth ? "text-sm text-slate-600" : "text-sm text-muted-foreground";
  const width = fullWidth ? "flex w-full" : "inline-flex";
  return (
    <div className={fullWidth ? "space-y-3" : "space-y-3 text-center"}>
      <button type="button" onClick={() => void begin("azure")} disabled={busy !== null || availability?.microsoftEnabled !== true} className={`${width} items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50`}>
        <MicrosoftMark />
        {busy === "azure" ? "Opening Microsoft…" : "Continue with Microsoft"}
      </button>
      {availability?.emailEnabled === true ? <EmailCodeSignIn fullWidth={fullWidth} domain={availability.hostedDomain} /> : null}
      <div>
        <button type="button" onClick={() => void begin("google")} disabled={busy !== null || availability?.googleEnabled !== true} className={`${width} items-center justify-center gap-2 px-3 py-1 text-sm text-slate-600 underline-offset-4 hover:underline disabled:opacity-50`}>
          <GoogleMark />
          {busy === "google" ? "Opening Google…" : "Course staff: continue with Google"}
        </button>
      </div>
      {availability === null ? <p className={statusClass}>{availabilityError ? "Could not check sign in availability. Refresh and try again." : "Checking sign in availability…"}</p> : null}
      {availability?.microsoftEnabled === false ? <p className={fullWidth ? "text-sm text-amber-800" : "text-sm text-amber-700 dark:text-amber-300"}>Microsoft sign in needs to be enabled in Supabase, with the university tenant set in CSE115A_MICROSOFT_TENANT_ID, before students can continue.</p> : null}
      {error ? <p role="alert" className={fullWidth ? "text-sm text-red-700" : "text-sm text-red-600 dark:text-red-400"}>{error}</p> : null}
    </div>
  );
}

/** Sign in with a one-time code emailed to the student's university address. */
function EmailCodeSignIn({ fullWidth, domain }: { fullWidth: boolean; domain: string | null }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(address)) {
      setError("Enter your university email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: sendError } = await createUserSupabaseBrowserClient().auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
      if (sendError) setError(sendError.message);
      else setSentTo(address);
    } catch {
      setError("Could not send the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await createUserSupabaseBrowserClient().auth.verifyOtp({ email: sentTo, token: code.trim(), type: "email" });
      if (verifyError) {
        setError(verifyError.message);
        setBusy(false);
        return;
      }
      window.location.assign("/cse115a/dashboard");
    } catch {
      setError("Could not check the code. Please try again.");
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
  const button = `${fullWidth ? "flex w-full" : "inline-flex"} items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50`;
  return (
    <div className="space-y-2 border-t border-slate-200 pt-3 text-left">
      {sentTo === null ? (
        <form onSubmit={(event) => void send(event)} className="space-y-2">
          <label htmlFor="course-email" className="block text-sm text-slate-600">Or get a sign-in code by email</label>
          <input id="course-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={domain ? `you@${domain}` : "you@university.edu"} className={input} />
          <button type="submit" disabled={busy || !email.trim()} className={button}>{busy ? "Sending…" : "Email me a code"}</button>
        </form>
      ) : (
        <form onSubmit={(event) => void verify(event)} className="space-y-2">
          <label htmlFor="course-code" className="block text-sm text-slate-600">Enter the code we sent to {sentTo}. Check your junk folder if it does not arrive.</label>
          <input id="course-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} className={input} />
          <button type="submit" disabled={busy || !code.trim()} className={button}>{busy ? "Checking…" : "Sign in"}</button>
          <button type="button" onClick={() => { setSentTo(null); setCode(""); setError(null); }} className="text-sm text-slate-600 underline-offset-4 hover:underline">Use a different email</button>
        </form>
      )}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
