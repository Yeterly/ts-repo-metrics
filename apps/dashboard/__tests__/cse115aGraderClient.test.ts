import type OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { graderClient } from "@/lib/cse115a/jobs/worker";

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe("graderClient", () => {
  it("uses the Azure AI Foundry v1 endpoint when AZURE_OPENAI_ENDPOINT is set", () => {
    const client = graderClient(env({ AZURE_OPENAI_ENDPOINT: "https://job191-foundry.openai.azure.com/", AZURE_OPENAI_API_KEY: "k" })) as OpenAI;
    expect(client.baseURL).toBe("https://job191-foundry.openai.azure.com/openai/v1/");
  });

  it("refuses an Azure endpoint without a key", () => {
    expect(() => graderClient(env({ AZURE_OPENAI_ENDPOINT: "https://x.openai.azure.com" }))).toThrow("AZURE_OPENAI_API_KEY");
  });

  it("falls back to OpenAI", () => {
    expect((graderClient(env({ OPENAI_API_KEY: "k" })) as OpenAI).baseURL).toBe("https://api.openai.com/v1");
    expect(() => graderClient(env({}))).toThrow("OPENAI_API_KEY");
  });

  it("uses Bedrock when CSE115A_GRADER_PROVIDER=bedrock, ahead of any Azure or OpenAI settings", () => {
    const client = graderClient(
      env({ CSE115A_GRADER_PROVIDER: "bedrock", AWS_REGION: "eu-west-1", CSE115A_GRADER_MODEL: "eu.anthropic.claude-sonnet-5-5", AZURE_OPENAI_ENDPOINT: "https://x" }),
    );
    expect(typeof client.chat.completions.create).toBe("function");
    expect((client as OpenAI).baseURL).toBeUndefined();
  });

  it("refuses Bedrock without a region or a model", () => {
    expect(() => graderClient(env({ CSE115A_GRADER_PROVIDER: "bedrock", CSE115A_GRADER_MODEL: "m" }))).toThrow("AWS_REGION");
    expect(() => graderClient(env({ CSE115A_GRADER_PROVIDER: "bedrock", AWS_REGION: "eu-west-1" }))).toThrow("CSE115A_GRADER_MODEL");
  });
});
