import { cancel, isCancel, select } from "@clack/prompts";
import chalk from "chalk";
import { Command } from "commander";
import yoctoSpinner from "yocto-spinner";
import { db } from "../../../lib/db";
import { getStoredToken, isTokenExpired, requireAuth } from "../../../lib/token";
import { startChat } from "../../chat/chat";
import { startToolChat } from "../../chat/tool-chat";

export async function wakeupAction() {
  // Ensure user is authenticated before proceeding
  const token = await requireAuth();

  const spinner = yoctoSpinner({ text: "Fetching user info..." });
  spinner.start();

  let user = null;
  try {
    if (token.user?.email) {
      user = await db.user.findUnique({
        where: { email: token.user.email },
      });
    } else if (token.user?.id) {
      user = await db.user.findUnique({
        where: { id: token.user.id },
      });
    }
  } catch (error) {
    user = token.user || null;
  } finally {
    spinner.stop();
  }

  if (!user) {
    console.log(chalk.red("\n❌ User not found. Run metis login to sign in."));
    return;
  }

  const name = user.name || user.email || "Developer";
  console.log(chalk.bold.green(`\n👋 Welcome back, ${name}!\n`));

  const mode = await select({
    message: "Select an option to get started:",
    options: [
      {
        label: "💬 Chat with Metis",
        value: "chat",
        hint: "Conversational AI mode",
      },
      {
        label: "🛠️ Tool Calling",
        value: "tools",
        hint: "Web search, code execution, etc.",
      },
      {
        label: "🤖 Agentic Mode",
        value: "agentic",
        hint: "Coming soon",
      },
    ],
  });

  if (isCancel(mode)) {
    cancel("Session cancelled.");
    process.exit(0);
  }
  switch (mode) {
    case "chat":
      await startChat(undefined, "chat");
      break;
    case "tools":
      await startToolChat();
      break;
    case "agentic":
      console.log(chalk.yellow("\nℹ️  Agentic mode coming soon\n"));
      process.exit(0);
      break;
  }
}

export const wakeupCommand = new Command("wakeup")
  .description("Wake up Metis AI Assistant")
  .action(async () => {
    await wakeupAction();
  });
