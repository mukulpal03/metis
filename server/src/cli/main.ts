#!/usr/bin/env node

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Command } from "commander";
import chalk from "chalk";
import figlet from "figlet";
import boxen from "boxen";

// Load environment variables once, silently — before any command runs
const envPaths = [
  path.join(process.cwd(), ".env"),
  path.join(process.cwd(), "server", ".env"),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
    break;
  }
}

import { loginCommand } from "./commands/auth/login";
import { logoutCommand } from "./commands/auth/logout";
import { whoamiCommand } from "./commands/auth/whoami";
import { wakeupCommand } from "./commands/ai/wakeup";

async function main() {
  // Generate Figlet ASCII Logo using 'Slant' font
  const asciiLogo = figlet.textSync("METIS", {
    font: "Slant",
    horizontalLayout: "fitted",
  });

  // Catppuccin / Tokyo Night palette hex colors
  const primaryColor = chalk.hex("#89B4FA");   // Soft Sapphire Blue
  const accentColor = chalk.hex("#CBA6F7");    // Soft Lavender Purple
  const mutedText = chalk.hex("#A6ADC8");      // Muted Cool Gray
  const badgeBg = chalk.bgHex("#CBA6F7").hex("#11111B").bold; // Dark text on Lavender badge

  const logoText = primaryColor(asciiLogo);
  const badge = badgeBg(" METIS CLI ");
  const tagLine = accentColor.bold("AI-Powered Developer Assistant");
  const subText = mutedText("Type ") + chalk.white.bold("metis --help") + mutedText(" to explore commands.");

  const cardContent = `${logoText}\n  ${badge}  ${tagLine}\n\n  ${subText}`;

  console.log(
    boxen(cardContent, {
      padding: { top: 1, bottom: 1, left: 2, right: 3 },
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: "round",
      borderColor: "#89B4FA",
    })
  );

  const program = new Command();

  program
    .name("metis")
    .description("Metis CLI - AI-powered CLI tool")
    .version("0.1.0");

  program.addCommand(loginCommand);
  program.addCommand(logoutCommand);
  program.addCommand(whoamiCommand);
  program.addCommand(wakeupCommand);
     
  await program.parseAsync(process.argv);

  // Cleanly disconnect database if it was loaded during this command.
  // Only call disconnect if the db module was actually imported and initialized.
  const g = globalThis as any;
  if (g.__metis_db_loaded) {
    try {
      const { disconnectDb } = await import("../lib/db");
      await disconnectDb();
    } catch (_) {}
  }
}

main().catch((err) => {
  console.error(chalk.red("Error: ", err));
  process.exit(1);
});

