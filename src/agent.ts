// src/agent.ts
import {
  Agent,
  AgentConfig,
  AgentContext,
  AgentRunOptions,
  ChatTool,
  Message,
  ToolDefinition,
} from "./types.js";

function toChatTools(
  tools: ToolDefinition[] | undefined,
): ChatTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.schema.name,
      description: t.schema.description,
      parameters: t.schema.parameters,
    },
  }));
}

function buildInitialMessages<I>(
  config: AgentConfig<I, any>,
  input: I,
): Message[] {
  const msgs: Message[] = [];
  if (config.systemPrompt) {
    msgs.push({ role: "system", content: config.systemPrompt });
  }

  const value = config.inputSchema ? config.inputSchema.parse(input) : input;

  if (config.buildInputMessages) {
    msgs.push(...config.buildInputMessages(value));
  } else {
    msgs.push({
      role: "user",
      content: typeof value === "string" ? value : JSON.stringify(value),
    });
  }

  return msgs;
}

async function runToolCalls(
  tools: ToolDefinition[],
  toolCalls: any[],
  ctx: AgentContext,
): Promise<Message[]> {
  const toolMessages: Message[] = [];

  for (const toolCall of toolCalls) {
    const toolCallId = toolCall.id;
    const name = toolCall.function?.name;
    const argsJson = toolCall.function?.arguments ?? "{}";

    const def = tools.find((t) => t.schema.name === name);
    if (!def) {
      ctx.logger?.({
        type: "tool_result",
        data: {
          name,
          error: "Tool not found",
        },
      });

      toolMessages.push({
        role: "tool",
        name,
        toolCallId,
        content: JSON.stringify({ error: "Tool not found" }),
      });
      continue;
    }

    let args: any;
    try {
      args = JSON.parse(argsJson);
    } catch (err) {
      ctx.logger?.({
        type: "tool_result",
        data: { name, error: "Invalid JSON arguments", raw: argsJson },
      });

      toolMessages.push({
        role: "tool",
        name,
        toolCallId,
        content: JSON.stringify({ error: "Invalid arguments JSON" }),
      });
      continue;
    }

    ctx.logger?.({ type: "tool_call", data: { name, args } });

    const result = await def.handler(args, ctx);

    ctx.logger?.({ type: "tool_result", data: { name, result } });

    toolMessages.push({
      role: "tool",
      name,
      toolCallId,
      content: JSON.stringify(result ?? {}),
    });
  }

  return toolMessages;
}

export function createAgent<I = unknown, O = unknown>(
  config: AgentConfig<I, O>,
): Agent<I, O> {
  async function run(input: I, options: AgentRunOptions = {}): Promise<O> {
    const { stream = false, maxToolIterations = 4, metadata } = options;
    if (stream) {
      // For now, only non-streaming is implemented
      // You can add a `runStream` method later that uses provider.chatStream
      throw new Error("Streaming not implemented yet in createAgent.run");
    }

    const ctx: AgentContext = {
      runId: crypto.randomUUID(),
      metadata,
      logger: metadata?.logger ?? undefined,
    };

    let messages = buildInitialMessages(config, input);
    const tools = config.tools ?? [];
    const chatTools = toChatTools(tools);

    for (let i = 0; i < maxToolIterations; i += 1) {
      ctx.logger?.({
        type: "model_call",
        data: { iteration: i, messages, tools: !!chatTools },
      });

      const res = await config.model.provider.chat({
        model: config.model.model,
        messages,
        tools: chatTools,
        stream: false,
        temperature: config.model.temperature,
        maxTokens: config.model.maxTokens,
        metadata,
      });

      const assistantMsg = res.message;
      const toolCalls = assistantMsg.tool_calls;
      const finishReason = res.finishReason;

      // Add assistant message to history (with tool calls if present)
      messages.push({
        role: "assistant",
        content: assistantMsg.content ?? null,
        tool_calls: toolCalls,
      });

      ctx.logger?.({
        type: "model_call",
        data: {
          iteration: i,
          finishReason,
          hasToolCalls: !!toolCalls?.length,
          toolCallsCount: toolCalls?.length || 0,
        },
      });

      if (toolCalls && toolCalls.length > 0 && finishReason === "tool_calls") {
        // Execute tools and append tool messages
        const toolMessages = await runToolCalls(tools, toolCalls, ctx);
        messages.push(...toolMessages);
        // Loop again with updated messages
        continue;
      }

      // No tool calls – assume we're done
      const rawContent = assistantMsg.content ?? "";

      const parsed = config.outputSchema
        ? config.outputSchema.parse(
            (() => {
              try {
                return JSON.parse(rawContent);
              } catch (parseError) {
                // Try to extract JSON from markdown code blocks
                const jsonMatch = rawContent.match(
                  /```(?:json)?\s*\n?([\s\S]*?)\n?```/,
                );
                if (jsonMatch?.[1]) {
                  try {
                    return JSON.parse(jsonMatch[1]);
                  } catch {
                    // Fall through to error
                  }
                }

                // If we have an output schema but can't parse JSON, throw a helpful error
                ctx.logger?.({
                  type: "final",
                  data: {
                    content: rawContent,
                    error: "Failed to parse JSON",
                    parseError: parseError instanceof Error ? parseError.message : String(parseError),
                  },
                });

                throw new Error(
                  `Failed to parse structured output as JSON. Raw content: ${rawContent.substring(0, 200)}${rawContent.length > 200 ? "..." : ""}`,
                );
              }
            })(),
          )
        : (rawContent as unknown as O);

      ctx.logger?.({ type: "final", data: { content: rawContent } });

      return parsed as O;
    }

    throw new Error("Agent exceeded maxToolIterations without finishing");
  }

  return { run };
}
