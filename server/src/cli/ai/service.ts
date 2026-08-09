import {
  streamText,
  type FinishReason,
  type LanguageModelUsage,
  type ModelMessage,
  type ToolSet,
} from "ai";
import chalk from "chalk";
import { ProviderFactory, type ResolvedModel } from "./providers";

import { getEnabledTools } from "../../config/tools";

export interface AIServiceResponse {
  content: string;
  finishReason: FinishReason;
  usage: LanguageModelUsage;
  toolCalls?: any[];
  toolResults?: any[];
  steps?: any[];
}

export class AIService {
  private resolvedModel: ResolvedModel;

  constructor(provider?: string, model?: string) {
    this.resolvedModel = ProviderFactory.getModel(provider, model);
  }

  public getProviderInfo(): { providerName: string; modelName: string } {
    return {
      providerName: this.resolvedModel.providerName,
      modelName: this.resolvedModel.modelName,
    };
  }

  async sendMessage(
    messages: ModelMessage[],
    onChunk?: (chunk: string) => void,
    tools?: ToolSet,
    onToolCall: ((toolCall: unknown) => void) | null = null,
  ): Promise<AIServiceResponse> {
    try {
      const systemPrompt = `You are Metis, an intelligent AI-powered developer assistant. You are currently powered by ${this.resolvedModel.providerName.toUpperCase()} (${this.resolvedModel.modelName}).`;

      const streamConfig: Record<string, any> = {
        model: this.resolvedModel.model,
        system: systemPrompt,
        messages: messages,
      };

      const activeTools = tools || getEnabledTools(this.resolvedModel.providerName);

      if (activeTools && Object.keys(activeTools).length > 0) {
        streamConfig.tools = activeTools;
        streamConfig.maxSteps = 5; // Allow up to 5 tool call steps
      }

      const result = streamText(streamConfig as any);

      let fullResponse = "";

      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      const toolCalls = [];
      const toolResults = [];

      const steps = await result.steps;

      if (steps && Array.isArray(steps)) {
        for (const step of steps) {
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const toolCall of step.toolCalls) {
              toolCalls.push(toolCall);

              if (onToolCall) {
                onToolCall(toolCall);
              }
            }
          }

          if (step.toolResults && step.toolResults.length > 0) {
            toolResults.push(...step.toolResults);
          }
        }
      }

      return {
        content: fullResponse,
        finishReason: await result.finishReason,
        usage: await result.usage,
        toolCalls,
        toolResults,
        steps: steps || [],
      };
    } catch (error: unknown) {
      const formattedMessage = ProviderFactory.formatError(
        error,
        this.resolvedModel.providerName,
      );

      console.log(
        chalk.red("\n❌ AI Response Error:") +
          "\n" +
          chalk.bold.yellow(formattedMessage) +
          "\n",
      );

      throw new Error(formattedMessage);
    }
  }

  async getMessage(messages: ModelMessage[], tools?: ToolSet): Promise<string> {
    const result = await this.sendMessage(messages, undefined, tools);
    return result.content;
  }
}
