// Course pages live in app/cse115a. On the course-only site (CSE115A_SITE=true) they are served
// without that prefix: next.config rewrites /dashboard to /cse115a/dashboard and / to /cse115a.
// Code that recognizes course pages by path must map the browser's path back first.

/** First path segments under app/cse115a that the course-only site serves at the root. */
export const COURSE_SECTIONS = ["assignments", "dashboard", "instructor", "preview", "signin", "signup"];

/** The app/cse115a path that serves this browser path; other paths are returned unchanged. */
export function coursePagePath(pathname: string, courseSite: boolean): string {
  if (!courseSite || pathname === "/cse115a" || pathname.startsWith("/cse115a/")) return pathname;
  if (pathname === "/") return "/cse115a";
  return COURSE_SECTIONS.includes(pathname.split("/")[1] ?? "") ? `/cse115a${pathname}` : pathname;
}
