"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createUserSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isBrowserSupabaseConfigured } from "@/lib/supabase/browserConfigured";
import { buildOAuthCallbackUrl, getOAuthRedirectOrigin, stashOAuthNextPath, stashOAuthProvider } from "@/lib/oauthRedirectOrigin";

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

/** Course sign-in: Microsoft for students (university tenant), with an emailed code as the fallback. */
export function UcscGoogleButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const [busy, setBusy] = useState(false);
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

  async function begin() {
    if (availability?.microsoftEnabled !== true) {
      setError("Microsoft sign in has not been enabled yet.");
      return;
    }
    if (!isBrowserSupabaseConfigured()) {
      setError("Sign in is not configured for this preview.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createUserSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      stashOAuthNextPath("/cse115a/dashboard");
      stashOAuthProvider("azure");
      const hint = availability?.hostedDomain;
      const options = {
        redirectTo: buildOAuthCallbackUrl(getOAuthRedirectOrigin()),
        scopes: "email openid profile",
        queryParams: { prompt: "select_account", ...(hint ? { domain_hint: hint } : {}) } as Record<string, string>,
      };
      const result = user?.identities?.some((identity) => identity.provider === "azure")
        ? await supabase.auth.signInWithOAuth({ provider: "azure", options })
        : user
          ? await supabase.auth.linkIdentity({ provider: "azure", options })
          : await supabase.auth.signInWithOAuth({ provider: "azure", options });
      if (result.error) setError(result.error.message);
    } catch {
      setError("Could not start Microsoft sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const statusClass = fullWidth ? "text-sm text-slate-600" : "text-sm text-muted-foreground";
  const width = fullWidth ? "flex w-full" : "inline-flex";
  return (
    <div className={fullWidth ? "space-y-3" : "space-y-3 text-center"}>
      <button type="button" onClick={() => void begin()} disabled={busy || availability?.microsoftEnabled !== true} className={`${width} items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50`}>
        <MicrosoftMark />
        {busy ? "Opening Microsoft…" : "Continue with Microsoft"}
      </button>
      {availability?.emailEnabled === true ? <EmailCodeSignIn fullWidth={fullWidth} domain={availability.hostedDomain} /> : null}
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
      // The server checks the allow list before Supabase sends anything.
      const response = await fetch("/api/cse115a/email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) setError(body.error ?? "Could not send the code. Please try again.");
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
