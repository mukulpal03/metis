import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import chalk from "chalk";
import { config } from "../../config";

export type AIProviderType = "google" | "gemini" | "openai" | "auto";

export interface ResolvedModel {
  model: LanguageModel;
  providerName: "google" | "openai";
  modelName: string;
  apiKey: string;
}

export class ProviderFactory {
  /**
   * Resolves the LanguageModel instance based on configured provider & model settings.
   */
  static getModel(
    customProvider?: string,
    customModel?: string,
  ): ResolvedModel {
    const rawProvider = (
      customProvider ||
      config.provider ||
      "auto"
    ).toLowerCase() as AIProviderType;

    const requestedModel = customModel || config.model;

    // Determine exact target provider
    let targetProvider: "google" | "openai" = "google";

    if (rawProvider === "openai") {
      targetProvider = "openai";
    } else if (rawProvider === "google" || rawProvider === "gemini") {
      targetProvider = "google";
    } else {
      // Auto-detect based on model prefix or available API keys
      if (requestedModel) {
        const lowerModel = requestedModel.toLowerCase();
        if (
          lowerModel.startsWith("gpt-") ||
          lowerModel.startsWith("o1") ||
          lowerModel.startsWith("o3")
        ) {
          targetProvider = "openai";
        } else if (lowerModel.startsWith("gemini-")) {
          targetProvider = "google";
        }
      } else {
        if (config.openaiApiKey && !config.googleApiKey) {
          targetProvider = "openai";
        } else {
          targetProvider = "google";
        }
      }
    }

    if (targetProvider === "openai") {
      if (!config.openaiApiKey) {
        console.log(
          chalk.red(
            "\n❌ AI Configuration Error: OPENAI_API_KEY is not set in environment.\n",
          ) +
            chalk.yellow(
              "   Set OPENAI_API_KEY in server/.env or switch to Google Gemini using AI_PROVIDER=google\n",
            ),
        );
        throw new Error("OPENAI_API_KEY is not set in env");
      }

      const modelName = requestedModel || "gpt-4o-mini";
      const openai = createOpenAI({ apiKey: config.openaiApiKey });

      const model =
        typeof openai.responses === "function"
          ? openai.responses(modelName as any)
          : openai(modelName);

      return {
        model,
        providerName: "openai",
        modelName,
        apiKey: config.openaiApiKey,
      };
    } else {
      if (!config.googleApiKey) {
        console.log(
          chalk.red(
            "\n❌ AI Configuration Error: GOOGLE_GENERATIVE_AI_API_KEY is not set in environment.\n",
          ) +
            chalk.yellow(
              "   Set GOOGLE_GENERATIVE_AI_API_KEY in server/.env or switch to OpenAI using AI_PROVIDER=openai\n",
            ),
        );
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set in env");
      }

      const modelName = requestedModel || "gemini-2.5-flash";
      const google = createGoogleGenerativeAI({ apiKey: config.googleApiKey });

      return {
        model: google(modelName),
        providerName: "google",
        modelName,
        apiKey: config.googleApiKey,
      };
    }
  }

  /**
   * Helper to format raw API errors into clean user-facing guidance.
   */
  static formatError(error: unknown, activeProvider: string): string {
    const rawMessage =
      error instanceof Error ? error.message : String(error || "Unknown AI error");

    const isQuotaOrRateLimit =
      rawMessage.includes("429") ||
      rawMessage.toLowerCase().includes("quota") ||
      rawMessage.toLowerCase().includes("rate limit") ||
      rawMessage.toLowerCase().includes("resource_exhausted");

    if (isQuotaOrRateLimit) {
      const currentProv = activeProvider.toUpperCase();
      const altProv = activeProvider === "google" ? "OpenAI" : "Google Gemini";
      const altEnvVar = activeProvider === "google" ? "AI_PROVIDER=openai" : "AI_PROVIDER=google";
      const altKeyVar = activeProvider === "google" ? "OPENAI_API_KEY" : "GOOGLE_GENERATIVE_AI_API_KEY";

      return (
        `${currentProv} API Rate Limit / Quota Exceeded.\n` +
        `   • Message: ${rawMessage}\n` +
        `   💡 Tip: To manually switch to ${altProv}, set ${altEnvVar} and configure ${altKeyVar} in server/.env.`
      );
    }

    return rawMessage;
  }
}
