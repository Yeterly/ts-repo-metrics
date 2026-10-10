import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TestingMetricsTab } from "@/components/results/rq/TestingMetricsTab";
import { TooltipProvider } from "@/components/ui/tooltip";
import { COMMIT_HABITS_SCOPE_TEAM } from "@/lib/commitHabitsScopeMetrics";
import type { RepoReport } from "@/lib/reportTypes";

// The risk profile reads only these fields; `scope` is "pr" when only a pull request's files were analyzed.
function report(scope?: "pr"): RepoReport {
  return {
    source: { type: "git", url: "https://github.com/example/team-project", commit: "abc123", branch: "main", scope },
    complexity: { average: 0, max: 0, highComplexityFunctions: 0 },
    smells: { longFunctions: 0, deepNesting: 0, longParameterLists: 0, emptyCatchBlocks: 0, consoleLogs: 0 },
    profile: { sourceLOC: 100, testLOC: 10 },
  } as unknown as RepoReport;
}

/** Visible text of the verification half of "Your risk profile", up to the score formula. */
function verificationText(r: RepoReport): string {
  const html = renderToStaticMarkup(
    createElement(
      TooltipProvider,
      null,
      createElement(TestingMetricsTab, { report: r, scopeId: COMMIT_HABITS_SCOPE_TEAM, onScopeIdChange: () => {} }),
    ),
  );
  const text = html.replace(/<[^>]+>/g, "");
  return text.slice(text.indexOf("Verification score"), text.indexOf("Score is 5×"));
}

describe("Verification footnote scope", () => {
  it("says the files come from the pull request on a PR report (#259)", () => {
    const text = verificationText(report("pr"));
    expect(text).toContain("(files in this PR)");
    expect(text).not.toContain("repo snapshot");
  });

  it("keeps 'repo snapshot' on a whole-repo report", () => {
    const text = verificationText(report());
    expect(text).toContain("(repo snapshot)");
    expect(text).not.toContain("files in this PR");
  });
});