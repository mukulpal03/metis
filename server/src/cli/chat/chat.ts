import chalk from "chalk";
import boxen from "boxen";
import { text, isCancel, cancel, intro, outro } from "@clack/prompts";
import yoctoSpinner from "yocto-spinner";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

import { AIService } from "../ai/service";
import { ChatService } from "../../services/chat";
import { db } from "../../lib/db";
import { getStoredToken, isTokenExpired } from "../../lib/token";

marked.use(
  markedTerminal({
    // Styling options for terminal output
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

export async function startChat(
  conversationId?: string,
  mode: string = "chat",
) {
  intro(
    chalk.bgHex("#89B4FA").hex("#11111B").bold(" METIS CLI ") +
      " " +
      chalk.bold.cyan("💬 AI Chat Session"),
  );

  try {
    const user = await getUserFromToken();
    const conversation = await initConversation(user.id, conversationId, mode);
    await chatLoop(conversation);

    outro(chalk.green("✨ Thanks For Chatting"));
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error || "Unknown chat error");
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
  mode: string = "chat",
): Promise<any> {
  const spinner = yoctoSpinner({ text: "Initializing conversation..." }).start();
  
  try {
    const conversation = await chatService.getOrCreateConversation(
      userId,
      conversationId || null,
      mode,
    );
    
    if (conversationId && conversation.id === conversationId) {
      spinner.success(`Resumed conversation: ${chalk.bold.cyan(conversation.id)}`);
    } else {
      spinner.success(`Started new conversation: ${chalk.bold.cyan(conversation.id)}`);
    }
    // Display conversation info in a box
    const conversationInfo = boxen(
      `${chalk.bold("Conversation")}: ${conversation.title}\n${chalk.gray("ID: " + conversation.id)}\n${chalk.gray("Mode: " + conversation.mode)}`,
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "cyan",
        title: "💬 Chat Session",
        titleAlignment: "center",
      }
    );
    console.log(conversationInfo);

    // Display existing messages if any
    if ('messages' in conversation && (conversation as any).messages?.length > 0) {
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
  const helpBox = boxen(
    `${chalk.hex("#A6ADC8")('• Type your message and press Enter')}\n${chalk.hex("#A6ADC8")('• Markdown formatting is supported in responses')}\n${chalk.hex("#A6ADC8")('• Type "exit" to end conversation')}\n${chalk.hex("#A6ADC8")('• Press Ctrl+C to quit anytime')}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: "round",
      borderColor: "#6C7086",
      dimBorder: true,
    }
  );
  
  console.log(helpBox);

  while (true) {
    const userInput = await text({
      message: chalk.bold.hex("#A6E3A1")("💬 Your message"),
      placeholder: "Type your message...",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "Message cannot be empty";
        }
      },
    });

    // Handle cancellation (Ctrl+C)
    if (isCancel(userInput)) {
      const exitBox = boxen(chalk.bold.hex("#F9E2AF")("Chat session ended. Goodbye! 👋"), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "#F9E2AF",
      });
      console.log(exitBox);
      process.exit(0);
    }

    // Handle exit command
    if (typeof userInput === 'string' && userInput.toLowerCase() === "exit") {
      const exitBox = boxen(chalk.bold.hex("#F9E2AF")("Chat session ended. Goodbye! 👋"), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "#F9E2AF",
      });
      console.log(exitBox);
      break;
    }

    // Clear the completed clack prompt line to avoid duplicate inputs on screen
    process.stdout.write("\x1b[1A\x1b[2K");

    displayMessage("user", userInput as string);

    const spinner = yoctoSpinner({ 
      text: chalk.hex("#89B4FA")("Metis AI is thinking...") 
    }).start();

    // Save user message
    await saveMessage(conversation.id, "user", userInput as string);

    // Get messages count before AI response
    const messages = await chatService.getMessages(conversation.id);
    
    // Get AI response (streams directly to console)
    const aiResponse = await getAIResponse(conversation.id, spinner);

    // Save AI response in background to prevent UI block
    saveMessage(conversation.id, "assistant", aiResponse).catch(() => {});

    // Update title in background if first exchange
    if (messages.length === 0 || messages.length === 1) {
      const title = (userInput as string).slice(0, 50) + ((userInput as string).length > 50 ? "..." : "");
      updateConversationTitle(conversation.id, title, conversation.userId).catch(() => {});
    }
  }
}

async function getAIResponse(conversationId: string, spinner: any) {
  const dbMessages = await chatService.getMessages(conversationId);
  const aiMessages = chatService.formatMessagesForAI(dbMessages);
  
  let fullResponse = "";
  let isFirstChunk = true;
  
  try {
    const result = await aiService.sendMessage(aiMessages, (chunk) => {
      if (isFirstChunk) {
        spinner.stop();
        console.log();
        console.log(chalk.bold.hex("#89B4FA")("🤖 Metis AI"));
        console.log(chalk.hex("#45475A")("─".repeat(50)));
        isFirstChunk = false;
      }
      fullResponse += chunk;
      process.stdout.write(chalk.hex("#CDD6F4")(chunk));
    });
    
    if (isFirstChunk) spinner.stop();
    console.log("\n" + chalk.hex("#45475A")("─".repeat(50)) + "\n");
    
    return result.content;
  } catch (error) {
    spinner.error("Failed to get AI response");
    throw error;
  }
}

export function displayMessage(role: string, content: string) {
  const isUser = role === "user";
  const parsedContent = typeof content === "string" ? content : JSON.stringify(content);
  
  // Using marked.parse with marked-terminal for styling
  const formattedContent = String(marked.parse(parsedContent)).trim();
  
  const title = isUser
    ? chalk.bold.hex("#A6E3A1")("👤 You")
    : chalk.bold.hex("#89B4FA")("🤖 Metis AI");
    
  const borderColor = isUser ? "#A6E3A1" : "#89B4FA";
  const alignment = isUser ? "right" : "left";

  console.log(
    boxen(formattedContent, {
      title,
      titleAlignment: alignment,
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 1, left: isUser ? 6 : 0, right: isUser ? 0 : 6 },
      borderColor,
      borderStyle: "round",
      float: alignment as any,
    })
  );
}

export function displayMessages(messages: any[]) {
  for (const msg of messages) {
    displayMessage(msg.role, msg.content);
  }
}

export async function saveMessage(conversationId: string, role: string, content: string) {
  try {
    return await chatService.addMessage(conversationId, role, content);
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to save message:`), error);
  }
}

export async function updateConversationTitle(conversationId: string, title: string, userId?: string) {
  try {
    return await chatService.updateConversationTitle(conversationId, title, userId);
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to update conversation title:`), error);
  }
}
