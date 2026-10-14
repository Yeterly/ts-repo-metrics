import { describe, expect, it } from "vitest";
import { coursePagePath } from "@/lib/cse115a/coursePath";

describe("coursePagePath", () => {
  it("maps course-only site paths back to app/cse115a", () => {
    expect(coursePagePath("/", true)).toBe("/cse115a");
    expect(coursePagePath("/dashboard", true)).toBe("/cse115a/dashboard");
    expect(coursePagePath("/instructor/submissions/abc", true)).toBe("/cse115a/instructor/submissions/abc");
    expect(coursePagePath("/assignments/1/tasks/2/metrics", true)).toBe("/cse115a/assignments/1/tasks/2/metrics");
  });

  it("leaves other paths alone", () => {
    expect(coursePagePath("/cse115a/dashboard", true)).toBe("/cse115a/dashboard");
    expect(coursePagePath("/privacy", true)).toBe("/privacy");
    expect(coursePagePath("/dashboards", true)).toBe("/dashboards");
    expect(coursePagePath("/dashboard", false)).toBe("/dashboard");
    expect(coursePagePath("/", false)).toBe("/");
  });
});
