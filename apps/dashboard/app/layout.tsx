import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CourseSiteProvider } from "@/components/cse115a/CourseSiteContext";
import { SiteFooter } from "@/components/SiteFooter";
import { Cse115aMain } from "@/components/cse115a/Cse115aMain";
import { Cse115aFooter } from "@/components/cse115a/Cse115aFooter";
import { HideOnCse115aLanding } from "@/components/cse115a/HideOnCse115aLanding";
import "./globals.css";
import { COURSE_NAME, COURSE_SHORT_NAME } from "@/lib/courseUcscAuth";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateMetadata(): Metadata {
  return process.env.CSE115A_SITE === "true"
    ? {
        title: `${COURSE_SHORT_NAME} Repo Metrics`,
        description: `Analyze your merged ${COURSE_NAME} sprint task pull requests.`,
      }
    : {
        title: "Repo Metrics Dashboard",
        description:
          "Analyze GitHub repositories — TypeScript, Python, and more — with code and git metrics",
      };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cse115aSite = process.env.CSE115A_SITE === "true";
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} font-sans antialiased min-h-screen flex flex-col`}
      >
        <CourseSiteProvider courseSite={cse115aSite}>
          <ThemeProvider>
            <HideOnCse115aLanding>
              <Header />
            </HideOnCse115aLanding>
            {cse115aSite ? (
              <Cse115aMain><TooltipProvider>{children}</TooltipProvider></Cse115aMain>
            ) : (
              <main className="flex-1 flex flex-col items-center justify-start py-6 px-4 sm:px-6 min-h-[calc(100vh-4rem)] bg-background">
                <TooltipProvider>{children}</TooltipProvider>
              </main>
            )}
            {cse115aSite ? null : (
              <HideOnCse115aLanding>
                <SiteFooter />
              </HideOnCse115aLanding>
            )}
            <Cse115aFooter />
            <Toaster richColors position="top-center" />
          </ThemeProvider>
        </CourseSiteProvider>
      </body>
    </html>
  );
}
