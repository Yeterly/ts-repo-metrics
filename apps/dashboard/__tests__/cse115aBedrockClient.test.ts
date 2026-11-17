import type { ConverseCommandInput, ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { describe, expect, it } from "vitest";
import { bedrockChatClient, fromConverseOutput, toConverseInput } from "@/lib/cse115a/grader/bedrockClient";

const schema = { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false };
const params = {
  model: "eu.anthropic.claude-sonnet-5-5",
  messages: [
    { role: "system" as const, content: "You grade." },
    { role: "user" as const, content: "Grade this." },
  ],
  response_format: { type: "json_schema" as const, json_schema: { name: "cse115a_task_grade", strict: true, schema } },
};

describe("toConverseInput", () => {
  it("maps system and user messages and asks for native structured output", () => {
    const input = toConverseInput(params);
    expect(input.modelId).toBe("eu.anthropic.claude-sonnet-5-5");
    expect(input.system).toEqual([{ text: "You grade." }]);
    expect(input.messages).toEqual([{ role: "user", content: [{ text: "Grade this." }] }]);
    expect(input.toolConfig).toBeUndefined();
    expect(input.outputConfig?.textFormat?.type).toBe("json_schema");
    const structure = input.outputConfig?.textFormat?.structure as { jsonSchema: { name: string; schema: string } };
    expect(structure.jsonSchema.name).toBe("cse115a_task_grade");
    expect(JSON.parse(structure.jsonSchema.schema)).toEqual(schema);
    expect(input.inferenceConfig?.temperature).toBeUndefined();
  });

  it("passes a temperature through when one is given", () => {
    expect(toConverseInput({ ...params, temperature: 0 }).inferenceConfig?.temperature).toBe(0);
  });
});

describe("fromConverseOutput", () => {
  it("returns the text blocks as the JSON content", () => {
    const output = { output: { message: { role: "assistant", content: [{ text: '{"a":' }, { text: '"x"}' }] } }, stopReason: "end_turn" } as unknown as ConverseCommandOutput;
    const result = fromConverseOutput("m", output);
    expect(result.model).toBe("m");
    expect(JSON.parse(result.choices[0].message.content as string)).toEqual({ a: "x" });
  });

  it("reports an empty answer as a refusal", () => {
    const result = fromConverseOutput("m", { output: { message: { role: "assistant", content: [] } }, stopReason: "guardrail_intervened" } as unknown as ConverseCommandOutput);
    expect(result.choices[0].message.content).toBeNull();
    expect(result.choices[0].message.refusal).toContain("guardrail_intervened");
  });
});

describe("bedrockChatClient", () => {
  it("sends one Converse request per create call", async () => {
    const sent: ConverseCommandInput[] = [];
    const client = bedrockChatClient("eu-west-1", async (input) => {
      sent.push(input);
      return { output: { message: { role: "assistant", content: [{ text: '{"a":"y"}' }] } }, stopReason: "end_turn" } as unknown as ConverseCommandOutput;
    });
    const response = await client.chat.completions.create(params);
    expect(sent).toHaveLength(1);
    expect(response.choices[0].message.content).toBe('{"a":"y"}');
  });
});
