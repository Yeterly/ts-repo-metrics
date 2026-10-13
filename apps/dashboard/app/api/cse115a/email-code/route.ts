import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKeyNode, supabaseProjectUrlNode } from "@/lib/supabase/projectEnv";
import { courseAllowedDomains, isAllowedCourseEmail } from "@/lib/courseUcscAuth";

export const runtime = "nodejs";

/** Emails a one-time sign-in code, only to an address on the course allow list. */
export async function POST(request: Request) {
  const url = supabaseProjectUrlNode();
  const key = supabaseAnonKeyNode();
  if (!url || !key) return NextResponse.json({ error: "Sign in is not configured." }, { status: 503 });
  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isAllowedCourseEmail(email)) {
    return NextResponse.json({ error: `Use your @${courseAllowedDomains().join(" or @")} email address.` }, { status: 400 });
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    const status = error.status === 429 ? 429 : 502;
    return NextResponse.json({ error: status === 429 ? "Too many codes requested. Wait a minute and try again." : "Could not send the code. Please try again." }, { status });
  }
  return NextResponse.json({ sent: true });
}
