"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useCoursePathname } from "@/components/cse115a/CourseSiteContext";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Course pages are designed for the light theme only.
  const cse115a = useCoursePathname().startsWith("/cse115a");
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      forcedTheme={cse115a ? "light" : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}
