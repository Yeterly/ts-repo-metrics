"use client";

import { useCoursePathname } from "@/components/cse115a/CourseSiteContext";

export function HideOnCse115aLanding({ children }: { children: React.ReactNode }) {
  const pathname = useCoursePathname();
  if (pathname === "/cse115a" || pathname.startsWith("/cse115a/")) return null;
  return children;
}
