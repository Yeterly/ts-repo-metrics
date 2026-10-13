import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { courseAllowedDomains, courseGoogleHostedDomain, isCourseAdminEmail, microsoftTenantOf, verifiedUcscGoogleEmail } from "@/lib/courseUcscAuth";

function user(provider: string, email: string, emailVerified: boolean): User {
  return {
    identities: [{ provider, identity_data: { email, email_verified: emailVerified } }],
  } as unknown as User;
}

describe("CSE 115A UCSC Google identity", () => {
  it("accepts a verified UCSC Google identity", () => {
    expect(verifiedUcscGoogleEmail(user("google", "Student@UCSC.EDU", true)))
      .toBe("student@ucsc.edu");
  });

  it("rejects an unverified address and a lookalike domain", () => {
    expect(verifiedUcscGoogleEmail(user("google", "student@ucsc.edu", false))).toBeNull();
    expect(verifiedUcscGoogleEmail(user("google", "student@ucsc.edu.evil.com", true))).toBeNull();
  });

  it("does not accept a GitHub profile email as Google authentication", () => {
    expect(verifiedUcscGoogleEmail(user("github", "student@ucsc.edu", true))).toBeNull();
  });
});

describe("CSE 115A allow list from the environment", () => {
  const env = {
    CSE115A_ALLOWED_EMAIL_DOMAINS: "stu.istinye.edu.tr",
    CSE115A_ADMIN_EMAILS: "Admin@Example.com, other@yeterly.com",
  } as unknown as NodeJS.ProcessEnv;

  it("accepts the configured domain and drops the default", () => {
    expect(verifiedUcscGoogleEmail(user("google", "Ogrenci@STU.istinye.edu.tr", true), env)).toBe("ogrenci@stu.istinye.edu.tr");
    expect(verifiedUcscGoogleEmail(user("google", "student@ucsc.edu", true), env)).toBeNull();
  });

  it("rejects subdomains and lookalikes of the configured domain", () => {
    expect(verifiedUcscGoogleEmail(user("google", "a@x.stu.istinye.edu.tr", true), env)).toBeNull();
    expect(verifiedUcscGoogleEmail(user("google", "a@stu.istinye.edu.tr.evil.com", true), env)).toBeNull();
    expect(verifiedUcscGoogleEmail(user("google", "a@istinye.edu.tr", true), env)).toBeNull();
  });

  it("accepts listed admins from any domain, case-insensitively", () => {
    expect(verifiedUcscGoogleEmail(user("google", "admin@example.com", true), env)).toBe("admin@example.com");
    expect(isCourseAdminEmail("OTHER@yeterly.com", env)).toBe(true);
    expect(isCourseAdminEmail("someone@yeterly.com", env)).toBe(false);
    expect(verifiedUcscGoogleEmail(user("google", "admin@example.com", false), env)).toBeNull();
  });

  it("gives the Google hint only for a single domain", () => {
    expect(courseGoogleHostedDomain(env)).toBe("stu.istinye.edu.tr");
    expect(courseGoogleHostedDomain({ CSE115A_ALLOWED_EMAIL_DOMAINS: "a.edu,b.edu" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(courseAllowedDomains({} as NodeJS.ProcessEnv)).toEqual(["ucsc.edu"]);
  });
});

describe("Microsoft (Entra ID) sign-in", () => {
  const tenant = "0f3a9c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b";
  const env = {
    CSE115A_ALLOWED_EMAIL_DOMAINS: "stu.istinye.edu.tr",
    CSE115A_ADMIN_EMAILS: "admin@example.com",
    CSE115A_MICROSOFT_TENANT_ID: tenant.toUpperCase(),
  } as unknown as NodeJS.ProcessEnv;
  function azure(email: string, data: Record<string, unknown>): User {
    return { identities: [{ provider: "azure", identity_data: { email, ...data } }] } as unknown as User;
  }

  it("accepts a student from the configured tenant without an email_verified flag", () => {
    expect(verifiedUcscGoogleEmail(azure("Ogrenci@stu.istinye.edu.tr", { custom_claims: { tid: tenant } }), env)).toBe("ogrenci@stu.istinye.edu.tr");
    expect(verifiedUcscGoogleEmail(azure("ogrenci@stu.istinye.edu.tr", { iss: `https://login.microsoftonline.com/${tenant}/v2.0` }), env)).toBe("ogrenci@stu.istinye.edu.tr");
  });

  it("rejects another tenant, a missing tenant, or no tenant configured", () => {
    const other = "11111111-2222-3333-4444-555555555555";
    expect(verifiedUcscGoogleEmail(azure("ogrenci@stu.istinye.edu.tr", { custom_claims: { tid: other } }), env)).toBeNull();
    expect(verifiedUcscGoogleEmail(azure("ogrenci@stu.istinye.edu.tr", {}), env)).toBeNull();
    const noTenant = { CSE115A_ALLOWED_EMAIL_DOMAINS: "stu.istinye.edu.tr" } as unknown as NodeJS.ProcessEnv;
    expect(verifiedUcscGoogleEmail(azure("ogrenci@stu.istinye.edu.tr", { custom_claims: { tid: tenant } }), noTenant)).toBeNull();
  });

  it("still applies the email allow list to Microsoft accounts", () => {
    expect(verifiedUcscGoogleEmail(azure("someone@istinye.edu.tr", { custom_claims: { tid: tenant } }), env)).toBeNull();
  });

  it("reads the tenant from a tid claim or the issuer URL", () => {
    expect(microsoftTenantOf({ tid: tenant })).toBe(tenant);
    expect(microsoftTenantOf({ iss: `https://sts.windows.net/${tenant}/` })).toBe(tenant);
    expect(microsoftTenantOf({ iss: "https://evil.example/" + tenant })).toBeNull();
  });
});
