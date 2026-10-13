import { describe, expect, it } from "vitest";
import { graderClient } from "@/lib/cse115a/jobs/worker";

describe("graderClient", () => {
  it("uses the Azure AI Foundry v1 endpoint when AZURE_OPENAI_ENDPOINT is set", () => {
    const client = graderClient({ AZURE_OPENAI_ENDPOINT: "https://job191-foundry.openai.azure.com/", AZURE_OPENAI_API_KEY: "k" } as unknown as NodeJS.ProcessEnv);
    expect(client.baseURL).toBe("https://job191-foundry.openai.azure.com/openai/v1/");
  });

  it("refuses an Azure endpoint without a key", () => {
    expect(() => graderClient({ AZURE_OPENAI_ENDPOINT: "https://x.openai.azure.com" } as unknown as NodeJS.ProcessEnv)).toThrow("AZURE_OPENAI_API_KEY");
  });

  it("falls back to OpenAI", () => {
    expect(graderClient({ OPENAI_API_KEY: "k" } as unknown as NodeJS.ProcessEnv).baseURL).toBe("https://api.openai.com/v1");
    expect(() => graderClient({} as NodeJS.ProcessEnv)).toThrow("OPENAI_API_KEY");
  });
});
