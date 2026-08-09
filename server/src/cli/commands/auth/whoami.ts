import { intro } from "@clack/prompts";
import boxen from "boxen";
import chalk from "chalk";
import { Command } from "commander";
import { getStoredToken, isTokenExpired, storeToken } from "../../../lib/token";

export async function whoamiAction() {
  intro(
    chalk.bgHex("#89B4FA").hex("#11111B").bold(" METIS CLI ") +
      " " +
      chalk.bold.cyan("👤 Auth WhoAmI"),
  );

  const token = await getStoredToken();
  const expired = await isTokenExpired(token);

  if (!token || expired) {
    console.log(
      chalk.red(
        "\n❌ Not authenticated or your session has expired.\n   Run " +
          chalk.bold.white("metis login") +
          " to sign in.",
      ),
    );
    return;
  }

  // Attempt to resolve user details (only hit DB if token is missing user info)
  let user = token.user;
  if (!user?.email || user.email === "N/A" || user.name === "Authenticated User") {
    try {
      const { db } = await import("../../../lib/db");
      const dbUser = await db.user.findFirst();
      if (dbUser) {
        user = {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
        };
        token.user = user;
        await storeToken(token);
      }
    } catch (_) {}
  }

  const name = user?.name || "Authenticated User";
  const email = user?.email || "N/A";
  const tokenPreview = token.access_token
    ? `${token.access_token.slice(0, 10)}...${token.access_token.slice(-6)}`
    : "Stored Token";
  const expiresAt = token.expires_at
    ? new Date(token.expires_at).toLocaleString()
    : "Session Active";

  const content = [
    `${chalk.bold.hex("#89B4FA")("👤 Name:")}    ${chalk.white.bold(name)}`,
    `${chalk.bold.hex("#89B4FA")("📧 Email:")}   ${chalk.hex("#A6ADC8")(email)}`,
    `${chalk.bold.hex("#89B4FA")("🛡️ Status:")}  ${chalk.bgHex("#A6E3A1").hex("#11111B").bold(" AUTHENTICATED ")}`,
    `${chalk.bold.hex("#89B4FA")("🔑 Token:")}   ${chalk.gray(tokenPreview)}`,
    `${chalk.bold.hex("#89B4FA")("⏳ Expires:")} ${chalk.gray(expiresAt)}`,
  ].join("\n");

  console.log(
    boxen(content, {
      padding: { top: 1, bottom: 1, left: 2, right: 3 },
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: "round",
      borderColor: "#89B4FA",
      title: chalk.bold.cyan(" User Session Profile "),
      titleAlignment: "center",
    }),
  );
}

export const whoamiCommand = new Command("whoami")
  .description("Display details of the currently authenticated Metis user")
  .action(async () => {
    await whoamiAction();
  });
