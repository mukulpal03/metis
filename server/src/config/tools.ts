import chalk from "chalk";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  provider?: "google" | "openai" | "all";
  getTool: () => any;
  enabled: boolean;
}

export const availableTools: ToolConfig[] = [
  // ===================== GOOGLE (Gemini) TOOLS =====================
  {
    id: "google_search",
    name: "Google Search",
    description:
      "Access the latest information using Google Search. Useful for current events, news, and real-time information",
    provider: "google",
    getTool: () => (google.tools as any).googleSearch({}),
    enabled: false,
  },
  {
    id: "google_code_execution",
    name: "Google Code Execution",
    description:
      "Execute Python code in a sandboxed environment provided by Google Gemini to perform complex calculations, data processing, and logic execution",
    provider: "google",
    getTool: () => (google.tools as any).codeExecution({}),
    enabled: false,
  },
  {
    id: "google_url_context",
    name: "Google URL Context",
    description:
      "Let Gemini directly fetch and analyze content from specific URLs referenced in the prompt (up to 20 URLs per request)",
    provider: "google",
    getTool: () => (google.tools as any).urlContext({}),
    enabled: false,
  },
  {
    id: "google_file_search",
    name: "Google File Search",
    description:
      "Retrieve context from your own documents indexed in a Google File Search store, for grounded answers over private data",
    provider: "google",
    getTool: () =>
      (google.tools as any).fileSearch({
        fileSearchStoreNames: [
          "projects/YOUR_PROJECT/locations/us/fileSearchStores/YOUR_STORE",
        ],
      }),
    enabled: false,
  },
  {
    id: "google_maps",
    name: "Google Maps Grounding",
    description:
      "Give Gemini access to Google Maps data for location-aware responses like finding nearby places",
    provider: "google",
    getTool: () => (google.tools as any).googleMaps({}),
    enabled: false,
  },

  // ===================== OPENAI TOOLS =====================
  {
    id: "openai_web_search",
    name: "OpenAI Web Search",
    description:
      "Search the web for up-to-date information and real-time answers using OpenAI search capabilities",
    provider: "openai",
    getTool: () => (openai.tools as any).webSearch({}),
    enabled: false,
  },
  {
    id: "openai_code_interpreter",
    name: "OpenAI Code Interpreter",
    description:
      "Execute Python code in an isolated sandbox environment to solve analytical problems and process data",
    provider: "openai",
    getTool: () => (openai.tools as any).codeInterpreter({}),
    enabled: false,
  },
];

/**
 * Helper to get a dictionary of active/enabled tools for Vercel AI SDK streamText.
 */
export function getEnabledTools(
  provider?: string,
): Record<string, any> | undefined {
  const tools: Record<string, any> = {};

  try {
    const targetProvider = provider?.toLowerCase();

    for (const toolConfig of availableTools) {
      if (toolConfig.enabled) {
        // Filter by provider if specified
        if (
          targetProvider &&
          toolConfig.provider &&
          toolConfig.provider !== "all" &&
          toolConfig.provider !== targetProvider
        ) {
          continue;
        }

        // Instantiate the tool when needed
        tools[toolConfig.id] = toolConfig.getTool();
      }
    }

    // Debug logging
    if (Object.keys(tools).length > 0) {
      console.log(
        chalk.gray(
          `[DEBUG] Enabled tools (${provider || "all"}): ${Object.keys(tools).join(", ")}`,
        ),
      );
    } else {
      console.log(
        chalk.yellow(
          `[DEBUG] No tools enabled for provider: ${provider || "all"}`,
        ),
      );
    }

    return Object.keys(tools).length > 0 ? tools : undefined;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(
      chalk.red("[ERROR] Failed to initialize tools:"),
      errorMessage,
    );
    console.error(
      chalk.yellow(
        "Make sure you have @ai-sdk/google and @ai-sdk/openai installed with valid configurations.",
      ),
    );
    return undefined;
  }
}