import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type ConverseCommandInput,
  type ConverseCommandOutput,
  type Message,
  type SystemContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import type { ChatClient } from "./llmGrader";

// Lets the grader run on Amazon Bedrock (for example Claude) behind the same ChatClient
// interface it uses for OpenAI. An OpenAI `response_format: json_schema` request maps to
// Bedrock's native structured output (Converse `outputConfig.textFormat`), so the reply text
// is JSON that matches the schema and gradeWithLlm parses it exactly as an OpenAI reply.
// (Forcing a tool call is not an option: current Claude models reject a forced tool_choice.)
// Credentials come from the default AWS chain (the ECS task role in production).

type Converse = (input: ConverseCommandInput) => Promise<ConverseCommandOutput>;

export const BEDROCK_MAX_TOKENS = 8_000;

export function bedrockChatClient(region: string, send?: Converse): ChatClient {
  const converse: Converse =
    send ??
    (() => {
      const client = new BedrockRuntimeClient({ region });
      return (input) => client.send(new ConverseCommand(input));
    })();

  return {
    chat: {
      completions: {
        async create(params: ChatCompletionCreateParamsNonStreaming) {
          const output = await converse(toConverseInput(params));
          return fromConverseOutput(params.model, output);
        },
      },
    },
  };
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : ""))
      .join("");
  }
  return "";
}

export function toConverseInput(params: ChatCompletionCreateParamsNonStreaming): ConverseCommandInput {
  const system: SystemContentBlock[] = [];
  const messages: Message[] = [];
  for (const message of params.messages) {
    const text = textOf((message as { content?: unknown }).content);
    if (message.role === "system" || message.role === "developer") system.push({ text });
    else if (message.role === "user" || message.role === "assistant") messages.push({ role: message.role, content: [{ text }] });
  }

  const input: ConverseCommandInput = {
    modelId: params.model,
    messages,
    ...(system.length ? { system } : {}),
    inferenceConfig: {
      maxTokens: BEDROCK_MAX_TOKENS,
      ...(typeof params.temperature === "number" ? { temperature: params.temperature } : {}),
    },
  };

  const format = params.response_format;
  if (format?.type === "json_schema") {
    input.outputConfig = {
      textFormat: {
        type: "json_schema",
        structure: { jsonSchema: { name: format.json_schema.name, schema: JSON.stringify(format.json_schema.schema ?? {}) } },
      },
    };
  }
  return input;
}

export function fromConverseOutput(model: string, output: ConverseCommandOutput) {
  const blocks: ContentBlock[] = output.output?.message?.content ?? [];
  const content = blocks.map((block) => block.text ?? "").join("") || null;
  const refusal = !content && output.stopReason ? `Bedrock stopped with reason "${output.stopReason}".` : null;
  return { model, choices: [{ message: { content, refusal } }] };
}
