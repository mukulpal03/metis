import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  streamText,
  type FinishReason,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type ToolSet,
} from "ai";
import chalk from "chalk";
import { config } from "../../config";

export interface AIServiceResponse {
  content: string;
  finishReason: FinishReason;
  usage: LanguageModelUsage;
}

export class AIService {
  private model: LanguageModel;

  constructor() {
    if (!config.googleApiKey) {
      console.log(
        chalk.red(
          "\n❌ AI Configuration Error: GOOGLE_GENERATIVE_AI_API_KEY is not set in environment.\n",
        ),
      );
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set in env");
    }

    const google = createGoogleGenerativeAI({
      apiKey: config.googleApiKey,
    });

    this.model = google(config.model);
  }

  async sendMessage(
    messages: ModelMessage[],
    onChunk?: (chunk: string) => void,
    tools?: ToolSet,
    onToolCall: ((toolCall: unknown) => void) | null = null,
  ): Promise<AIServiceResponse> {
    try {
      const streamConfig = {
        model: this.model,
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

      const fullResult = result;

      return {
        content: fullResponse,
        finishReason: await fullResult.finishReason,
        usage: await fullResult.usage,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error || "Unknown AI error");

      console.log(
        chalk.red("\n❌ AI Response Error:") +
          " " +
          chalk.bold.white(errorMessage) +
          "\n",
      );

      throw error;
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
