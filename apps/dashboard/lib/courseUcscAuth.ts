import type { User } from "@supabase/supabase-js";

export const CSE115A_FALL_COURSE_IDS = new Set([
  "CSE115A-Fall26",
  "CSE115A-Fall26-S01",
  "CSE115A-Fall26-S02",
]);

const DEFAULT_ALLOWED_DOMAINS = ["ucsc.edu"];

// Names shown to users. NEXT_PUBLIC_* so client components see the same value; set them in .env.local to override.
/** University name shown in sign-in copy and errors. */
export const COURSE_UNIVERSITY = process.env.NEXT_PUBLIC_COURSE_UNIVERSITY?.trim() || "Istinye University";
/** Full course name for page copy. */
export const COURSE_NAME = process.env.NEXT_PUBLIC_COURSE_NAME?.trim() || "Job191 - Dream Data Labs AI Augmented Software Engineering";
/** Short course name for headers and tab titles. */
export const COURSE_SHORT_NAME = process.env.NEXT_PUBLIC_COURSE_SHORT_NAME?.trim() || "Job191";
/** Student instructions (sprint task specifications) linked from the app. */
export const COURSE_INSTRUCTIONS_URL = process.env.NEXT_PUBLIC_COURSE_INSTRUCTIONS_URL?.trim()
  || "https://github.com/Yeterly/ts-repo-metrics/blob/feat/cse115a-g05fb9/docs/job191-sprint-task-specifications.md";

function listFromEnv(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
}

/** Email domains whose accounts may sign in (`CSE115A_ALLOWED_EMAIL_DOMAINS`, default `ucsc.edu`). */
export function courseAllowedDomains(env: NodeJS.ProcessEnv = process.env): string[] {
  const domains = listFromEnv(env.CSE115A_ALLOWED_EMAIL_DOMAINS);
  return domains.length ? domains : DEFAULT_ALLOWED_DOMAINS;
}

/** Emails that may sign in from any domain and are instructors on every course (`CSE115A_ADMIN_EMAILS`). */
export function courseAdminEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  return listFromEnv(env.CSE115A_ADMIN_EMAILS);
}

export function isCourseAdminEmail(email: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return courseAdminEmails(env).includes(email.trim().toLowerCase());
}

/** True for an exact allowed-domain address or a listed admin. Subdomains and lookalikes do not match. */
export function isAllowedCourseEmail(email: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(normalized)) return false;
  if (isCourseAdminEmail(normalized, env)) return true;
  return courseAllowedDomains(env).includes(normalized.slice(normalized.indexOf("@") + 1));
}

/** The Google `hd` hint, only when exactly one domain is allowed. */
export function courseGoogleHostedDomain(env: NodeJS.ProcessEnv = process.env): string | null {
  const domains = courseAllowedDomains(env);
  return domains.length === 1 ? domains[0] : null;
}

/** The Istinye (or other) Microsoft Entra tenant whose accounts may sign in (`CSE115A_MICROSOFT_TENANT_ID`). */
export function courseMicrosoftTenantId(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.CSE115A_MICROSOFT_TENANT_ID?.trim().toLowerCase() || null;
}

type IdentityData = Record<string, unknown> & { custom_claims?: Record<string, unknown> };

/** The Entra tenant an `azure` identity came from: the `tid` claim, or the tenant in the issuer URL. */
export function microsoftTenantOf(data: IdentityData | undefined): string | null {
  if (!data) return null;
  const tid = data.custom_claims?.tid ?? data.tid;
  if (typeof tid === "string" && tid) return tid.toLowerCase();
  const iss = typeof data.iss === "string" ? data.iss : "";
  const match = /^https:\/\/(?:login\.microsoftonline\.com|sts\.windows\.net)\/([0-9a-f-]{36})\b/i.exec(iss);
  return match ? match[1].toLowerCase() : null;
}

/**
 * The email of a signed-in user the course allows, lowercased, or null.
 * Google: the address must be verified. Microsoft (`azure`): Entra does not mark emails verified,
 * so the identity must come from the configured tenant instead; with no tenant configured, Microsoft is refused.
 * Email code (`email`): the user proved the inbox by entering the emailed code, so the account email must be confirmed.
 */
export function verifiedUcscGoogleEmail(user: User | null, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!user) return null;
  const tenant = courseMicrosoftTenantId(env);
  for (const identity of user.identities ?? []) {
    const data = identity.identity_data as IdentityData | undefined;
    const email = data?.email;
    if (typeof email !== "string" || !isAllowedCourseEmail(email, env)) continue;
    if (identity.provider === "google" && data?.email_verified === true) return email.toLowerCase();
    if (identity.provider === "azure" && tenant && microsoftTenantOf(data) === tenant) return email.toLowerCase();
    if (identity.provider === "email" && user.email_confirmed_at && user.email?.toLowerCase() === email.toLowerCase()) return email.toLowerCase();
  }
  return null;
}
