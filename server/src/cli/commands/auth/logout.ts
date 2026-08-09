import { cancel, confirm, intro, isCancel, outro } from "@clack/prompts";
import chalk from "chalk";
import { Command } from "commander";
import { clearStoredToken, getStoredToken } from "../../../lib/token";

export async function logoutAction() {
  intro(
    chalk.bgHex("#89B4FA").hex("#11111B").bold(" METIS CLI ") +
      " " +
      chalk.bold.cyan("🚪 Auth CLI Logout"),
  );

  const token = await getStoredToken();

  if (!token) {
    outro(chalk.yellow("ℹ You are not currently logged in."));
    return;
  }

  const shouldLogout = await confirm({
    message: "Are you sure you want to log out of Metis CLI?",
    initialValue: true,
  });

  if (isCancel(shouldLogout) || !shouldLogout) {
    cancel("Logout cancelled.");
    return;
  }

  const success = await clearStoredToken();

  if (success) {
    outro(chalk.bold.green("👋 Successfully logged out of Metis CLI."));
  } else {
    cancel("Failed to clear authentication token.");
  }
}

export const logoutCommand = new Command("logout")
  .description("Log out of your Metis CLI session")
  .action(async () => {
    await logoutAction();
  });
