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

function listFromEnv(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
}

/** Email domains whose verified Google accounts may sign in (`CSE115A_ALLOWED_EMAIL_DOMAINS`, default `ucsc.edu`). */
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

export function verifiedUcscGoogleEmail(user: User | null, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!user) return null;
  for (const identity of user.identities ?? []) {
    if (identity.provider !== "google") continue;
    const email = identity.identity_data?.email;
    if (typeof email !== "string" || !isAllowedCourseEmail(email, env)) continue;
    if (identity.identity_data?.email_verified !== true) continue;
    return email.toLowerCase();
  }
  return null;
}
