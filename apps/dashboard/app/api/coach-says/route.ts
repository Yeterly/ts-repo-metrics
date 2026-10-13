export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { CoachSaysFacts } from "@/lib/coachSays/coachSaysFacts";
import { footerLabelForCoachTab } from "@/lib/coachSays/coachSaysFacts";
import type { CoachSaysPayload, CoachSaysPriorityTab } from "@/lib/coachSays/coachSaysTypes";
import { RESULTS_TAB } from "@/lib/resultsNavigation";
import type { CommitHabitsTier } from "@/lib/commitHabitsScore";
import { COURSE_NAME } from "@/lib/courseUcscAuth";

const MAX_FACTS_CHARS = 48_000;

const STRENGTH_MIN = 24;
const STRENGTH_MAX = 520;
const OPPORTUNITY_MIN = 32;
const OPPORTUNITY_MAX = 780;
const POINTER_MIN = 24;
const POINTER_MAX = 380;

const PRIORITY_TABS: readonly CoachSaysPriorityTab[] = [
  RESULTS_TAB.commitHabits,
  RESULTS_TAB.testing,
  RESULTS_TAB.codeQuality,
  RESULTS_TAB.reactComponents,
  RESULTS_TAB.codeComplexity,
  RESULTS_TAB.aiUsage,
] as const;

const TAB_SET = new Set<string>(PRIORITY_TABS);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isCoachPriorityTab(s: string): s is CoachSaysPriorityTab {
  return TAB_SET.has(s);
}

/** Enough structure-check to safely stringify into the model prompt. */
function validateCoachFactsPayload(v: unknown): CoachSaysFacts | null {
  if (!isRecord(v)) return null;

  const tabsRaw = v.allowedPriorityTabs;
  if (!Array.isArray(tabsRaw) || tabsRaw.length === 0) return null;
  const allowedPriorityTabs: CoachSaysPriorityTab[] = [];
  for (const t of tabsRaw) {
    if (typeof t !== "string" || !isCoachPriorityTab(t)) return null;
    allowedPriorityTabs.push(t);
  }

  if (typeof v.commitSha !== "string" || typeof v.repoUrl !== "string") return null;
  if (typeof v.reactUiScope !== "boolean") return null;

  if (!isRecord(v.commitHabits)) return null;
  if (
    typeof v.commitHabits.score !== "number" ||
    typeof v.commitHabits.tier !== "string" ||
    typeof v.commitHabits.headline !== "string" ||
    typeof v.commitHabits.totalCommits !== "number" ||
    typeof v.commitHabits.commitsPerWeek !== "number" ||
    typeof v.commitHabits.worstDriverLabel !== "string" ||
    typeof v.commitHabits.worstDriverScore !== "number"
  )
    return null;

  if (!isRecord(v.testing)) return null;
  if (
    typeof v.testing.score !== "number" ||
    typeof v.testing.pctCommitsTouchingTests !== "number" ||
    typeof v.testing.testFiles !== "number" ||
    typeof v.testing.testLocRatio !== "number"
  )
    return null;

  if (!isRecord(v.codeQuality)) return null;
  if (
    typeof v.codeQuality.score !== "number" ||
    typeof v.codeQuality.highComplexityFunctions !== "number" ||
    typeof v.codeQuality.maxComplexity !== "number" ||
    typeof v.codeQuality.duplicationPct !== "number"
  )
    return null;

  if (!isRecord(v.react)) return null;
  if (
    typeof v.react.enabled !== "boolean" ||
    typeof v.react.componentsAnalyzed !== "number" ||
    typeof v.react.jsxDepthExceededCount !== "number" ||
    typeof v.react.lackOfCohesionCount !== "number"
  )
    return null;
  if (v.react.score !== null && typeof v.react.score !== "number") return null;

  let phase2: CoachSaysFacts["phase2"] = null;
  if ("phase2" in v) {
    if (v.phase2 === null) {
      phase2 = null;
    } else if (
      isRecord(v.phase2) &&
      typeof v.phase2.miNormMean === "number" &&
      typeof v.phase2.functionsWithPhase2 === "number"
    ) {
      phase2 = {
        miNormMean: v.phase2.miNormMean,
        functionsWithPhase2: v.phase2.functionsWithPhase2,
      };
    } else {
      return null;
    }
  }

  let phase3: CoachSaysFacts["phase3"] = null;
  if ("phase3" in v) {
    if (v.phase3 === null) {
      phase3 = null;
    } else if (
      isRecord(v.phase3) &&
      typeof v.phase3.silentFailureCount === "number" &&
      (v.phase3.sfd === null || typeof v.phase3.sfd === "number")
    ) {
      phase3 = {
        silentFailureCount: v.phase3.silentFailureCount,
        sfd: v.phase3.sfd as number | null,
      };
    } else {
      return null;
    }
  }

  const testCov = v.testing.testCoverageClassification;
  if (testCov !== null && typeof testCov !== "string") return null;

  const maintScore = v.codeQuality.maintainabilityScore;
  if (maintScore !== null && typeof maintScore !== "number") return null;
  const maintCls = v.codeQuality.maintainabilityClassification;
  if (maintCls !== null && typeof maintCls !== "string") return null;

  return {
    commitSha: v.commitSha,
    repoUrl: v.repoUrl,
    reactUiScope: v.reactUiScope,
    allowedPriorityTabs,
    commitHabits: {
      score: v.commitHabits.score,
      tier: v.commitHabits.tier as CommitHabitsTier,
      headline: v.commitHabits.headline,
      totalCommits: v.commitHabits.totalCommits,
      commitsPerWeek: v.commitHabits.commitsPerWeek,
      worstDriverLabel: v.commitHabits.worstDriverLabel,
      worstDriverScore: v.commitHabits.worstDriverScore,
    },
    testing: {
      score: v.testing.score,
      pctCommitsTouchingTests: v.testing.pctCommitsTouchingTests,
      testFiles: v.testing.testFiles,
      testLocRatio: v.testing.testLocRatio,
      testCoverageClassification: testCov as string | null,
    },
    codeQuality: {
      score: v.codeQuality.score,
      maintainabilityScore: maintScore as number | null,
      maintainabilityClassification: maintCls as string | null,
      highComplexityFunctions: v.codeQuality.highComplexityFunctions,
      maxComplexity: v.codeQuality.maxComplexity,
      duplicationPct: v.codeQuality.duplicationPct,
    },
    react: {
      enabled: v.react.enabled,
      componentsAnalyzed: v.react.componentsAnalyzed,
      jsxDepthExceededCount: v.react.jsxDepthExceededCount,
      lackOfCohesionCount: v.react.lackOfCohesionCount,
      score: v.react.score as number | null,
    },
    phase2,
    phase3,
  };
}

function validateModelCoachPayload(
  raw: unknown,
  allowed: Set<CoachSaysPriorityTab>,
): Omit<CoachSaysPayload, "footerLabel"> | null {
  if (!isRecord(raw)) return null;
  const strengthText = raw.strengthText;
  const opportunityText = raw.opportunityText;
  const pointerText = raw.pointerText;
  const priorityTab = raw.priorityTab;

  if (
    typeof strengthText !== "string" ||
    strengthText.length < STRENGTH_MIN ||
    strengthText.length > STRENGTH_MAX
  )
    return null;
  if (
    typeof opportunityText !== "string" ||
    opportunityText.length < OPPORTUNITY_MIN ||
    opportunityText.length > OPPORTUNITY_MAX
  )
    return null;
  if (
    typeof pointerText !== "string" ||
    pointerText.length < POINTER_MIN ||
    pointerText.length > POINTER_MAX
  )
    return null;
  if (typeof priorityTab !== "string" || !isCoachPriorityTab(priorityTab)) return null;
  if (!allowed.has(priorityTab)) return null;

  return {
    strengthText: strengthText.trim(),
    opportunityText: opportunityText.trim(),
    pointerText: pointerText.trim(),
    priorityTab,
  };
}

const COACH_SYSTEM = `You write the global “YOUR COACH SAYS” coaching card for a ${COURSE_NAME} course dashboard. The repository metrics snapshot is JSON in the user message.

Tab ids (for priorityTab): commit-habits | testing | code-quality | react-components | code-complexity | ai-usage — use only values listed in allowedPriorityTabs.

FACTS (authoritative — JSON keys):
- commitSha, repoUrl, reactUiScope
- allowedPriorityTabs: array of tab ids you MAY assign to priorityTab (pick exactly one)
- commitHabits: score (0–100), tier, headline, totalCommits, commitsPerWeek, worstDriverLabel, worstDriverScore
- testing: score (0–100 heuristic), pctCommitsTouchingTests, testFiles, testLocRatio, testCoverageClassification
- codeQuality: score (0–100 heuristic), maintainabilityScore, maintainabilityClassification, highComplexityFunctions, maxComplexity, duplicationPct
- react: enabled, componentsAnalyzed, jsxDepthExceededCount, lackOfCohesionCount, score (number or null if not applicable)
- phase2 (Code Complexity — per-function lexical snapshot): null or { miNormMean, functionsWithPhase2 }
- phase3: null or { silentFailureCount, sfd }

RULES:
1. Use ONLY values present in that JSON. Do not invent filenames, dates, scores, or metrics not in the payload.
2. Encouraging coach voice with growth mindset. No shame or judgment.
3. strengthText: 2–4 sentences. Lead with genuine strengths. Prefer phases whose tier in the JSON is strong or good (commitHabits.tier, and comparable testing/codeQuality scores). Never use negative framing here — no “you have no problems in X,” no apologies, no “weak” or “bad.” Lead with confident, specific positives.
4. opportunityText: 3–5 sentences on the single biggest improvement opportunity. Frame as forward-looking upside (“where you can make the highest-impact improvement”) — not failure or criticism. Do not open with “your score is critically low.”
5. pointerText: 1–2 sentences. Name the human-readable tab (e.g. Testing, Code Quality) that matches priorityTab; tell the student to open that tab below. Do not use research codes (no “rq1”). Example tone: “Your highest-impact improvement this quarter is Testing. Head to the Testing tab below to see exactly what to do and how to improve your score.”
6. priorityTab MUST be copied verbatim from allowedPriorityTabs — choose where the student should focus next (often the weakest area, justified with facts).

OUTPUT:
Return ONLY raw JSON (no markdown fences). Keys exactly:
- "strengthText": string
- "opportunityText": string
- "pointerText": string
- "priorityTab": string (one of allowedPriorityTabs)`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI assistant is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const factsRaw = body.facts;
  const facts = validateCoachFactsPayload(factsRaw);
  if (!facts) {
    return NextResponse.json({ error: "Invalid facts payload." }, { status: 400 });
  }

  const factsStr = JSON.stringify(facts);
  if (factsStr.length > MAX_FACTS_CHARS) {
    return NextResponse.json({ error: "facts too large." }, { status: 400 });
  }

  const allowed = new Set(facts.allowedPriorityTabs);

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 900,
      messages: [
        { role: "system", content: COACH_SYSTEM },
        {
          role: "user",
          content: `Facts JSON (authoritative):\n${factsStr}`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return NextResponse.json({ error: "Empty model response." }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ error: "Model returned invalid JSON." }, { status: 502 });
    }

    const validated = validateModelCoachPayload(parsed, allowed);
    if (!validated) {
      return NextResponse.json({ error: "Model JSON failed validation." }, { status: 502 });
    }

    const out: CoachSaysPayload = {
      ...validated,
      footerLabel: footerLabelForCoachTab(validated.priorityTab),
    };

    return NextResponse.json(out);
  } catch (err) {
    console.error("[coach-says]", err);
    return NextResponse.json({ error: "Coach message generation failed." }, { status: 502 });
  }
}
