import { createClient } from "@supabase/supabase-js";

const [slug, rawEmail, role = "instructor"] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!slug || !email || !url || !serviceKey || !["instructor", "ta"].includes(role)) {
  console.error("Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node apps/dashboard/scripts/addCourseStaff.mjs COURSE_SLUG EMAIL [instructor|ta]");
  process.exit(1);
}
// Same allow list as lib/courseUcscAuth.ts.
const envList = (value) => (value ?? "").split(",").map((item) => item.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
const domains = envList(process.env.CSE115A_ALLOWED_EMAIL_DOMAINS);
const allowedDomains = domains.length ? domains : ["ucsc.edu"];
const admins = envList(process.env.CSE115A_ADMIN_EMAILS);
if (!/^[^@\s]+@[^@\s]+$/.test(email) || !(admins.includes(email) || allowedDomains.includes(email.slice(email.indexOf("@") + 1)))) {
  console.error(`Staff sign in with Google, so the email must end in @${allowedDomains.join(", @")} or be in CSE115A_ADMIN_EMAILS.`);
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const { data: course, error: courseError } = await db.from("cse_courses")
  .select("id,title,term").eq("slug", slug).maybeSingle();
if (courseError || !course) {
  console.error("Course not found. Apply the course migration or check the slug.");
  process.exit(1);
}
const { error } = await db.from("cse_course_roles").upsert({ course_id: course.id, email, role }, { onConflict: "course_id,email" });
if (error) {
  console.error("Could not add staff:", error.message);
  process.exit(1);
}
console.log(`${email} is now ${role === "ta" ? "a TA" : "an instructor"} for ${course.title} · ${course.term}.`);
