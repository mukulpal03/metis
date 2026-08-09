import chalk from "chalk";
import boxen from "boxen";
import { text, isCancel, cancel, intro, outro } from "@clack/prompts";
import yoctoSpinner from "yocto-spinner";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

import { generateObject } from "ai";
import { z } from "zod";
import { AIService } from "../ai/service";
import { ChatService } from "../../services/chat";
import { db } from "../../lib/db";
import { getStoredToken, isTokenExpired } from "../../lib/token";
import { generateApplication } from "../../config/agent";
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

export async function startAgentChat(conversationId?: string) {
  intro(
    chalk.bgHex("#89B4FA").hex("#11111B").bold(" METIS CLI ") +
      " " +
      chalk.bold.cyan("🤖 Autonomous Coding Agent Session"),
  );

  try {
    const user = await getUserFromToken();
    const conversation = await initConversation(
      user.id,
      conversationId,
      "agentic",
    );
    await agentLoop(conversation);

    outro(chalk.green("✨ Coding Agent session ended"));
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error || "Unknown coding agent error");
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

async function initConversation(
  userId: string,
  conversationId?: string,
  mode: string = "agentic",
): Promise<any> {
  const spinner = yoctoSpinner({
    text: "Initializing Coding Agent...",
  }).start();

  let conversation: any;

  try {
    conversation = await chatService.getOrCreateConversation(
      userId,
      conversationId || null,
      mode,
    );

    if (conversationId && conversation.id === conversationId) {
      spinner.success(
        `Resumed agent session: ${chalk.bold.cyan(conversation.id)}`,
      );
    } else {
      spinner.success(
        `Started new agent session: ${chalk.bold.cyan(conversation.id)}`,
      );
    }
  } catch (_dbError) {
    spinner.warning(
      chalk.yellow("Running in local session mode (Database offline/timeout)"),
    );
    conversation = {
      id: `local-${Date.now()}`,
      title: "Local Agent Session",
      mode: mode,
      userId: userId,
      messages: [],
    };
  }

  const { providerName, modelName } = aiService.getProviderInfo();
  const providerBadge = `${providerName.toUpperCase()} (${modelName})`;

  const conversationInfo = boxen(
    `${chalk.bold("Conversation")}: ${conversation.title}\n${chalk.gray("ID: " + conversation.id)}\n${chalk.gray("Mode: " + conversation.mode)}\n${chalk.gray("Provider: ")} ${chalk.bold.cyan(providerBadge)}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      title: "🤖 Coding Agent Session",
      titleAlignment: "center",
    },
  );
  console.log(conversationInfo);

  if (
    "messages" in conversation &&
    (conversation as any).messages?.length > 0
  ) {
    console.log(chalk.yellow("📜 Previous agent tasks:\n"));
    displayMessages((conversation as any).messages);
  }

  return conversation;
}

async function agentLoop(conversation: any): Promise<void> {
  const helpBox = boxen(
    `${chalk.hex("#A6ADC8")("• Tell Metis what application or feature to code")}\n${chalk.hex("#A6ADC8")("• Metis will generate files, setup directory, and output instructions")}\n${chalk.hex("#A6ADC8")('• Type "exit" or "menu" to return to main menu')}\n${chalk.hex("#A6ADC8")("• Press Ctrl+C to exit session")}`,
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
      message: chalk.bold.hex("#A6E3A1")("⚡ What should I build for you?"),
      placeholder: "e.g., Create a React Todo app or Express REST API...",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "Prompt cannot be empty";
        }
      },
    });

    const isExitCommand =
      typeof userInput === "string" &&
      ["exit", "menu", "/menu", "back"].includes(
        userInput.trim().toLowerCase(),
      );

    if (isCancel(userInput) || isExitCommand) {
      const exitBox = boxen(
        chalk.bold.hex("#F9E2AF")(
          "Agent session ended. Returning to menu... 👋",
        ),
        {
          padding: 1,
          margin: 1,
          borderStyle: "round",
          borderColor: "#F9E2AF",
        },
      );
      console.log(exitBox);
      break;
    }

    // Clear completed prompt line
    process.stdout.write("\x1b[1A\x1b[2K");

    displayMessage("user", userInput as string);

    saveMessage(conversation.id, "user", userInput as string).catch(() => {});
    let messages: any[] = [];
    try {
      messages = await chatService.getMessages(conversation.id);
    } catch (_) {}

    const intent = await classifyUserIntent(userInput as string, aiService);

    if (!intent.isBuildRequest) {
      const reply =
        intent.responseMessage ||
        `Hello! 👋 I am your **Metis Autonomous Coding Agent**.\n\n` +
          `Tell me what application or feature you'd like to build, and I will generate the complete source code and project files for you!`;

      displayMessage("assistant", reply);
      saveMessage(conversation.id, "assistant", reply).catch(() => {});
      continue;
    }

    try {
      // Execute autonomous application generation
      const result = await generateApplication(
        userInput as string,
        aiService,
        process.cwd(),
      );

      const responseSummary =
        `Generated Application: **${result.folderName}**\n\n` +
        `Location: \`${result.appDir}\`\n\n` +
        `Files (${result.files.length}):\n` +
        result.files.map((f) => `- \`${f}\``).join("\n") +
        (result.commands.length > 0
          ? `\n\nNext Steps:\n\`\`\`bash\n${result.commands.join("\n")}\n\`\`\``
          : "");

      // Save assistant response
      saveMessage(conversation.id, "assistant", responseSummary).catch(
        () => {},
      );

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
          chalk.red.bold("⚠️ Agent Coding Execution Error\n\n") +
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

async function classifyUserIntent(
  userInput: string,
  aiService: AIService,
): Promise<{ isBuildRequest: boolean; responseMessage: string }> {
  try {
    const languageModel = aiService.getLanguageModel();
    const result = await generateObject({
      model: languageModel,
      schema: z.object({
        isBuildRequest: z
          .boolean()
          .describe(
            "True if the user is asking to build, create, code, develop, or generate an application, feature, script, or project. False if general greeting, general question, or non-build chat.",
          ),
        responseMessage: z
          .string()
          .describe(
            "If isBuildRequest is false, provide a helpful conversational answer or greeting as a Coding Agent. If isBuildRequest is true, leave empty string.",
          ),
      }),
      prompt: `Analyze this user input: "${userInput}". Is this a request to build/code an application or project?`,
    });

    return {
      isBuildRequest: Boolean(result.object?.isBuildRequest),
      responseMessage: result.object?.responseMessage || "",
    };
  } catch (_err) {
    return { isBuildRequest: true, responseMessage: "" };
  }
}
