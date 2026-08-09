import chalk from "chalk";
import boxen from "boxen";
import {
  text,
  isCancel,
  cancel,
  intro,
  outro,
  multiselect,
} from "@clack/prompts";
import yoctoSpinner from "yocto-spinner";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

import { AIService } from "../ai/service";
import { ChatService } from "../../services/chat";
import { db } from "../../lib/db";
import { getStoredToken, isTokenExpired } from "../../lib/token";
import {
  availableTools,
  getEnabledTools,
  enableTools,
  getEnabledToolNames,
  resetTools,
} from "../../config/tools";
import {
  displayMessage,
  displayMessages,
  saveMessage,
  updateConversationTitle,
} from "./chat";

marked.use(
  markedTerminal({
    code: chalk.cyan,
    blockquote: chalk.gray.italic,
    heading: chalk.green.bold,
    firstHeading: chalk.magenta.underline.bold,
    hr: chalk.reset,
    listitem: chalk.reset,
    list: chalk.reset,
    paragraph: chalk.reset,
    strong: chalk.bold,
    em: chalk.italic,
    codespan: chalk.yellow.bgBlack,
    del: chalk.dim.gray.strikethrough,
    link: chalk.blue.underline,
    href: chalk.blue.underline,
  }) as any,
);

const aiService = new AIService();
const chatService = new ChatService();

export async function startToolChat(conversationId?: string) {
  intro(
    chalk.bgHex("#89B4FA").hex("#11111B").bold(" METIS CLI ") +
      " " +
      chalk.bold.cyan("🛠️ AI Tool Calling Session"),
  );

  try {
    const user = await getUserFromToken();

    // Select tools for interactive session
    const toolsConfigured = await selectTools();
    if (!toolsConfigured) {
      return;
    }

    const conversation = await initConversation(
      user.id,
      conversationId,
      "tools",
    );
    await chatLoop(conversation);

    // Clean reset of tool state on session completion
    resetTools();

    outro(chalk.green("✨ Tool session ended"));
  } catch (error: unknown) {
    resetTools();
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error || "Unknown tool chat error");
    console.log(chalk.red(`\n❌ Error: ${errorMessage}\n`));
    process.exit(1);
  }
}

async function getUserFromToken(): Promise<any> {
  const spinner = yoctoSpinner({ text: "Authenticating session..." }).start();

  const token = await getStoredToken();
  const expired = await isTokenExpired(token);

  if (!token || expired) {
    spinner.error("Authentication failed");
    console.log(
      chalk.red(
        "\n❌ Not authenticated or your session has expired.\n   Run " +
          chalk.bold.white("metis login") +
          " to sign in.",
      ),
    );
    process.exit(1);
  }

  let user = token.user;
  if (
    !user?.email ||
    user.email === "N/A" ||
    user.name === "Authenticated User"
  ) {
    try {
      const dbUser = await db.user.findFirst();
      if (dbUser) {
        user = {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
        };
      }
    } catch (_) {}
  }

  if (!user?.id) {
    spinner.error("Authentication failed");
    console.log(chalk.red("\n❌ Failed to resolve user identity.\n"));
    process.exit(1);
  }

  spinner.success(
    `Authenticated as ${chalk.bold.hex("#89B4FA")(user.name || user.email)}`,
  );

  return user;
}

async function selectTools(): Promise<boolean> {
  const providerInfo = aiService.getProviderInfo();
  const currentProvider = providerInfo.providerName.toLowerCase();

  // Filter available tools by provider compatibility
  const compatibleTools = availableTools.filter(
    (tool) =>
      !tool.provider ||
      tool.provider === "all" ||
      tool.provider === currentProvider,
  );

  const toolOptions = compatibleTools.map((tool) => ({
    value: tool.id,
    label: tool.name,
    hint: `${tool.description} [${(tool.provider || "all").toUpperCase()}]`,
  }));

  if (toolOptions.length === 0) {
    console.log(
      chalk.yellow(
        `\n⚠️ No tools available for provider ${providerInfo.providerName.toUpperCase()}.\n`,
      ),
    );
    return false;
  }

  const selectedTools = (await multiselect({
    message: chalk.bold.hex("#89B4FA")(
      "Select tools to enable (Space to toggle, Enter to confirm):",
    ),
    options: toolOptions,
    required: false,
  })) as string[];

  if (isCancel(selectedTools)) {
    cancel(chalk.hex("#F9E2AF")("Tool selection cancelled"));
    resetTools();
    return false;
  }

  // Enable selected tools in state
  enableTools(selectedTools);

  if (selectedTools.length === 0) {
    console.log(
      chalk.hex("#F9E2AF")(
        "\n⚠️ No tools selected. Metis AI will proceed without tools.\n",
      ),
    );
  } else {
    const toolsBox = boxen(
      chalk.hex("#A6E3A1")(
        `✅ Enabled tools:\n${selectedTools
          .map((id) => {
            const tool = availableTools.find((t) => t.id === id);
            return `  • ${tool?.name || id}`;
          })
          .join("\n")}`,
      ),
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "#A6E3A1",
        title: chalk.bold.hex("#A6E3A1")("🛠️ Active Tools"),
        titleAlignment: "center",
      },
    );
    console.log(toolsBox);
  }

  return true;
}

async function initConversation(
  userId: string,
  conversationId?: string,
  mode: string = "tools",
): Promise<any> {
  const spinner = yoctoSpinner({
    text: "Initializing tool session...",
  }).start();

  try {
    const conversation = await chatService.getOrCreateConversation(
      userId,
      conversationId || null,
      mode,
    );

    if (conversationId && conversation.id === conversationId) {
      spinner.success(
        `Resumed conversation: ${chalk.bold.cyan(conversation.id)}`,
      );
    } else {
      spinner.success(
        `Started new conversation: ${chalk.bold.cyan(conversation.id)}`,
      );
    }

    const providerInfo = aiService.getProviderInfo();
    const enabledToolNames = getEnabledToolNames(providerInfo.providerName);
    const toolsDisplay =
      enabledToolNames.length > 0
        ? `\n${chalk.gray("Active Tools:")} ${chalk.hex("#A6E3A1")(enabledToolNames.join(", "))}`
        : `\n${chalk.gray("Active Tools:")} ${chalk.hex("#F9E2AF")("None")}`;

    const providerBadge = `${providerInfo.providerName.toUpperCase()} (${providerInfo.modelName})`;

    // Display conversation info box
    const conversationInfo = boxen(
      `${chalk.bold("Conversation")}: ${conversation.title}\n${chalk.gray("ID: " + conversation.id)}\n${chalk.gray("Mode: " + conversation.mode)}\n${chalk.gray("Provider: ")} ${chalk.bold.cyan(providerBadge)}${toolsDisplay}`,
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "cyan",
        title: "🛠️ Tool Calling Session",
        titleAlignment: "center",
      },
    );
    console.log(conversationInfo);

    // Display existing messages if any
    if (
      "messages" in conversation &&
      (conversation as any).messages?.length > 0
    ) {
      console.log(chalk.yellow("📜 Previous messages:\n"));
      displayMessages((conversation as any).messages);
    }

    return conversation;
  } catch (error) {
    spinner.error("Failed to initialize conversation");
    throw error;
  }
}

async function chatLoop(conversation: any): Promise<void> {
  const providerInfo = aiService.getProviderInfo();
  const enabledToolNames = getEnabledToolNames(providerInfo.providerName);
  const helpBox = boxen(
    `${chalk.hex("#A6ADC8")("• Type your message and press Enter")}\n${chalk.hex("#A6ADC8")("• Enabled tools:")} ${enabledToolNames.length > 0 ? chalk.hex("#A6E3A1")(enabledToolNames.join(", ")) : chalk.hex("#F9E2AF")("No tools")}\n${chalk.hex("#A6ADC8")('• Type "exit" or "menu" to return to main menu')}\n${chalk.hex("#A6ADC8")("• Press Ctrl+C to exit session")}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: "round",
      borderColor: "#6C7086",
      dimBorder: true,
    },
  );

  console.log(helpBox);

  while (true) {
    const userInput = await text({
      message: chalk.bold.hex("#A6E3A1")("💬 Your message"),
      placeholder: "Ask something or invoke a tool...",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "Message cannot be empty";
        }
      },
    });

    const isExitCommand =
      typeof userInput === "string" &&
      ["exit", "menu", "/menu", "back"].includes(userInput.trim().toLowerCase());

    if (isCancel(userInput) || isExitCommand) {
      const exitBox = boxen(
        chalk.bold.hex("#F9E2AF")("Tool session ended. Returning to menu... 👋"),
        {
          padding: 1,
          margin: 1,
          borderStyle: "round",
          borderColor: "#F9E2AF",
        },
      );
      console.log(exitBox);
      resetTools();
      break;
    }

    // Clear completed prompt line
    process.stdout.write("\x1b[1A\x1b[2K");

    displayMessage("user", userInput as string);

    const spinner = yoctoSpinner({
      text: chalk.hex("#89B4FA")("Metis AI is thinking and executing tools..."),
    }).start();

    await saveMessage(conversation.id, "user", userInput as string);

    const messages = await chatService.getMessages(conversation.id);

    try {
      const aiResponse = await getAIResponse(conversation.id, spinner);

      if (aiResponse) {
        saveMessage(conversation.id, "assistant", aiResponse).catch(() => {});
      }

      if (messages.length === 0 || messages.length === 1) {
        const title =
          (userInput as string).slice(0, 50) +
          ((userInput as string).length > 50 ? "..." : "");
        updateConversationTitle(
          conversation.id,
          title,
          conversation.userId,
        ).catch(() => {});
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(
        boxen(
          chalk.red.bold("⚠️ Tool Execution / AI Error\n\n") +
            chalk.white(errorMsg),
          {
            padding: 1,
            margin: { top: 1, bottom: 1 },
            borderStyle: "round",
            borderColor: "red",
            title: "❌ Error",
          },
        ),
      );
    }
  }
}

async function getAIResponse(conversationId: string, spinner: any) {
  const dbMessages = await chatService.getMessages(conversationId);
  const aiMessages = chatService.formatMessagesForAI(dbMessages);

  const providerInfo = aiService.getProviderInfo();
  const activeTools = getEnabledTools(providerInfo.providerName);

  let fullResponse = "";
  let isFirstChunk = true;
  const executedToolNames: string[] = [];

  try {
    const result = await aiService.sendMessage(
      aiMessages,
      (chunk) => {
        if (isFirstChunk) {
          spinner.stop();
          console.log();
          if (executedToolNames.length > 0) {
            console.log(
              chalk.gray(
                `⚡ Used tools: ${Array.from(new Set(executedToolNames)).join(", ")}`,
              ),
            );
          }
          console.log(chalk.bold.hex("#89B4FA")("🤖 Metis AI"));
          console.log(chalk.hex("#45475A")("─".repeat(50)));
          isFirstChunk = false;
        }
        fullResponse += chunk;
        process.stdout.write(chalk.hex("#CDD6F4")(chunk));
      },
      activeTools,
      (toolCall: any) => {
        const rawName = toolCall.toolName || toolCall.name || "tool";
        executedToolNames.push(rawName);

        let actionLabel = "executing tool";
        if (rawName.toLowerCase().includes("search")) {
          actionLabel = "searching the web";
        } else if (rawName.toLowerCase().includes("code")) {
          actionLabel = "running code sandbox";
        } else if (rawName.toLowerCase().includes("maps")) {
          actionLabel = "querying map data";
        } else if (rawName.toLowerCase().includes("url")) {
          actionLabel = "fetching URL content";
        }

        spinner.text = chalk.hex("#89B4FA")(
          `🔍 Metis AI is ${actionLabel} (${rawName})...`,
        );
      },
    );

    if (isFirstChunk) spinner.stop();
    console.log("\n" + chalk.hex("#45475A")("─".repeat(50)) + "\n");

    return result.content;
  } catch (error) {
    spinner.error("Failed to get AI response");
    throw error;
  }
}
