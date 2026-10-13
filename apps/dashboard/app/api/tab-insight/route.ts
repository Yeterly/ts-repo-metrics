export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { CommitHabitsInsightPayload, TabInsightId } from "@/lib/tabInsights/types";
import { RESULTS_TAB } from "@/lib/resultsNavigation";
import { COURSE_NAME } from "@/lib/courseUcscAuth";

const MAX_FACTS_CHARS = 40_000;

/** Aligned with COMMIT_HABITS_TAB_INSIGHT_SYSTEM output caps */
const INTRO_MAX = 400;
const MOMENTUM_LEAD_MAX = 200;
const MOMENTUM_BULLET_MAX = 150;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateCommitHabitsInsightPayload(raw: unknown): CommitHabitsInsightPayload | null {
  if (!isRecord(raw)) return null;
  const intro = raw.intro;
  const momentumLead = raw.momentumLead;
  const momentumBullets = raw.momentumBullets;
  if (typeof intro !== "string" || intro.length < 20 || intro.length > INTRO_MAX) return null;
  if (
    typeof momentumLead !== "string" ||
    momentumLead.length < 10 ||
    momentumLead.length > MOMENTUM_LEAD_MAX
  )
    return null;
  if (!Array.isArray(momentumBullets) || momentumBullets.length !== 3) return null;
  if (
    !momentumBullets.every(
      (b) => typeof b === "string" && b.length > 5 && b.length <= MOMENTUM_BULLET_MAX,
    )
  )
    return null;
  return {
    intro: intro.trim(),
    momentumLead: momentumLead.trim(),
    momentumBullets: momentumBullets.map((s) => s.trim()),
  };
}

const COMMIT_HABITS_TAB_INSIGHT_SYSTEM = `You write short coaching copy for the "Commit Habits" tab of a ${COURSE_NAME} course dashboard.

FACTS IN USER MESSAGE (JSON keys — use only what appears; do not assume missing keys):
- tabId, commitSha, repoUrl
- scopeMode ("team" or "contributor"), scopeLabel (who the metrics describe)
- totalCommits, commitsPerWeek, avgLinesPerCommit, medianCommitSize
- pctOver500Loc (percent of commits over 500 LOC), burstRatio, entropyStdDevMs, entropyMeanMs (mean ms between commits)
- overallCommitHabitsScore (0–100), overallTier (strong/good/needs_work/critical), headline
- worstDriver: { id, label, score, advice }; drivers: array of { id, label, score }
- topChurnFiles (paths); recentWindowEmpty (true if history has commits but none in recent cadence window); contributorCount; gitMode

RULES:
1. Use ONLY facts in that JSON. Do not invent metrics, filenames, dates, or commit messages.
2. Encouraging coach voice with growth mindset. No shame or judgment.
3. When scopeMode is "contributor", speak to that person (scopeLabel) using their totals and cadence; do not imply those numbers are whole-repo unless facts show contributorCount === 1 and you state that carefully.
4. If totalCommits < 10, acknowledge early-stage work and suggest gentle next steps (still grounded in facts).
5. If recentWindowEmpty is true, acknowledge the gap and encourage restarting steady habits without judgment.
6. Focus on specific, actionable next steps, not vague advice.
7. Mention overallCommitHabitsScore or overallTier at most once, only if it adds context.
8. In momentumBullets, the FIRST bullet must address worstDriver.label using worstDriver.advice as guidance (rephrase in your words).

OUTPUT FORMAT:
Return ONLY a raw JSON object (no markdown code fences). Keys exactly:
- "intro": string, 2–5 sentences (max ${INTRO_MAX} characters)
- "momentumLead": string, 1–3 sentences (max ${MOMENTUM_LEAD_MAX} characters)
- "momentumBullets": array of exactly 3 strings (each max ${MOMENTUM_BULLET_MAX} characters)

Shape example (replace content with facts-driven copy, not this placeholder text):
{"intro":"…","momentumLead":"…","momentumBullets":["…","…","…"]}`;

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

  const tabId = body.tabId as TabInsightId | undefined;
  const facts = body.facts;

  if (tabId !== RESULTS_TAB.commitHabits) {
    return NextResponse.json({ error: "Unsupported tabId." }, { status: 400 });
  }
  if (!isRecord(facts)) {
    return NextResponse.json({ error: "facts must be an object." }, { status: 400 });
  }

  const factsStr = JSON.stringify(facts);
  if (factsStr.length > MAX_FACTS_CHARS) {
    return NextResponse.json({ error: "facts too large." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 720,
      messages: [
        { role: "system", content: COMMIT_HABITS_TAB_INSIGHT_SYSTEM },
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

    const validated = validateCommitHabitsInsightPayload(parsed);
    if (!validated) {
      return NextResponse.json({ error: "Model JSON failed validation." }, { status: 502 });
    }

    return NextResponse.json(validated);
  } catch (err) {
    console.error("[tab-insight]", err);
    return NextResponse.json({ error: "Tab insight generation failed." }, { status: 502 });
  }
}
