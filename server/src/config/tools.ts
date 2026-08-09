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

  // ===================== OPENAI TOOLS =====================
  {
    id: "openai_web_search",
    name: "OpenAI Web Search",
    description:
      "Search the web for up-to-date information and real-time answers using OpenAI web search capabilities",
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
    return undefined;
  }
}

/**
 * Toggle a tool's enabled state by ID.
 */
export function toggleTool(toolId: string, targetProvider?: string): boolean {
  const tool = availableTools.find((t) => t.id === toolId);
  if (tool) {
    if (
      targetProvider &&
      tool.provider &&
      tool.provider !== "all" &&
      tool.provider !== targetProvider.toLowerCase()
    ) {
      console.log(
        chalk.yellow(
          `[DEBUG] Tool ${toolId} (${tool.provider}) is not compatible with active provider ${targetProvider}`,
        ),
      );
    }
    tool.enabled = !tool.enabled;
    console.log(
      chalk.gray(`[DEBUG] Tool ${toolId} toggled to ${tool.enabled}`),
    );
    return tool.enabled;
  }
  console.log(chalk.red(`[DEBUG] Tool ${toolId} not found`));
  return false;
}

/**
 * Enable a list of tool IDs (disables any tools not in the provided array)
 */
export function enableTools(toolIds: string[]): void {
  console.log(chalk.gray("[DEBUG] enableTools called with:"), toolIds);

  availableTools.forEach((tool) => {
    const wasEnabled = tool.enabled;
    tool.enabled = toolIds.includes(tool.id);

    if (tool.enabled !== wasEnabled) {
      console.log(
        chalk.gray(`[DEBUG] ${tool.id}: ${wasEnabled} → ${tool.enabled}`),
      );
    }
  });

  const enabledCount = availableTools.filter((t) => t.enabled).length;
  console.log(
    chalk.gray(
      `[DEBUG] Total tools enabled: ${enabledCount}/${availableTools.length}`,
    ),
  );
}

/**
 * Get all enabled tool names (optionally filtered by provider)
 */
export function getEnabledToolNames(provider?: string): string[] {
  const targetProvider = provider?.toLowerCase();
  const names = availableTools
    .filter((t) => {
      if (!t.enabled) return false;
      if (
        targetProvider &&
        t.provider &&
        t.provider !== "all" &&
        t.provider !== targetProvider
      ) {
        return false;
      }
      return true;
    })
    .map((t) => t.name);

  console.log(
    chalk.gray(
      `[DEBUG] getEnabledToolNames (${provider || "all"}) returning:`,
    ),
    names,
  );
  return names;
}

/**
 * Reset all tools (disable all)
 */
export function resetTools(): void {
  availableTools.forEach((tool) => {
    tool.enabled = false;
  });
  console.log(chalk.gray("[DEBUG] All tools have been reset (disabled)"));
}
