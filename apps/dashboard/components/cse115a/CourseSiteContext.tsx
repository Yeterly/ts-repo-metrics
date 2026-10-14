"use client";

import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { coursePagePath } from "@/lib/cse115a/coursePath";

const CourseSiteContext = createContext(false);

/** Tells client components whether this deployment is the course-only site (CSE115A_SITE=true). */
export function CourseSiteProvider({ courseSite, children }: { courseSite: boolean; children: React.ReactNode }) {
  return <CourseSiteContext.Provider value={courseSite}>{children}</CourseSiteContext.Provider>;
}

/** The current page's app/cse115a path, so /dashboard on the course-only site reads as /cse115a/dashboard. */
export function useCoursePathname(): string {
  return coursePagePath(usePathname(), useContext(CourseSiteContext));
}
