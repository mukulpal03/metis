import {
  streamText,
  type FinishReason,
  type LanguageModelUsage,
  type ModelMessage,
  type ToolSet,
} from "ai";
import chalk from "chalk";
import { ProviderFactory, type ResolvedModel } from "./providers";

export interface AIServiceResponse {
  content: string;
  finishReason: FinishReason;
  usage: LanguageModelUsage;
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
    _onToolCall: ((toolCall: unknown) => void) | null = null,
  ): Promise<AIServiceResponse> {
    try {
      const systemPrompt = `You are Metis, an intelligent AI-powered developer assistant. You are currently powered by ${this.resolvedModel.providerName.toUpperCase()} (${this.resolvedModel.modelName}).`;

      const streamConfig = {
        model: this.resolvedModel.model,
        system: systemPrompt,
        messages: messages,
        ...(tools ? { tools } : {}),
      };

      const result = streamText(streamConfig as any);

      let fullResponse = "";

      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      return {
        content: fullResponse,
        finishReason: await result.finishReason,
        usage: await result.usage,
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

  async getMessage(
    messages: ModelMessage[],
    tools?: ToolSet,
  ): Promise<string> {
    let fullResponse = "";
    await this.sendMessage(
      messages,
      (chunk) => {
        fullResponse += chunk;
      },
      tools,
    );
    return fullResponse;
  }
}
