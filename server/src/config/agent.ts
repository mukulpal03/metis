import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";
import boxen from "boxen";
import yoctoSpinner from "yocto-spinner";
import { generateObject } from "ai";
import { z } from "zod";
import type { AIService } from "../cli/ai/service";

/**
 * Zod schema for structured application generation
 */
export const ApplicationSchema = z.object({
  folderName: z.string().describe("Kebab-case folder name for the application"),
  description: z.string().describe("Brief description of what was created"),
  files: z
    .array(
      z.object({
        path: z.string().describe("Relative file path (e.g., src/App.jsx)"),
        content: z.string().describe("Complete file content"),
      }),
    )
    .describe("All files needed for the application"),
  setupCommands: z
    .array(z.string())
    .describe(
      "Bash commands to setup and run (e.g., npm install, npm run dev)",
    ),
});

export type Application = z.infer<typeof ApplicationSchema>;

export interface GeneratedAppResult {
  folderName: string;
  appDir: string;
  files: string[];
  commands: string[];
  success: boolean;
}

/**
 * Console logging helpers (styled with Metis theme)
 */
function printSystem(message: string): void {
  console.log(message);
}

/**
 * Display file tree structure in Metis CLI styling
 */
function displayFileTree(
  files: Array<{ path: string; content: string }>,
  folderName: string,
): void {
  printSystem(chalk.bold.hex("#89B4FA")("\n📂 Project Structure:"));
  printSystem(chalk.bold.hex("#CDD6F4")(`${folderName}/`));

  const filesByDir: Record<string, string[]> = {};
  files.forEach((file) => {
    const parts = file.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";

    if (!filesByDir[dir]) {
      filesByDir[dir] = [];
    }
    filesByDir[dir].push(parts[parts.length - 1]);
  });

  Object.keys(filesByDir)
    .sort()
    .forEach((dir) => {
      if (dir) {
        printSystem(chalk.hex("#A6ADC8")(`├── ${dir}/`));
        filesByDir[dir].forEach((file) => {
          printSystem(chalk.hex("#CDD6F4")(`│   └── ${file}`));
        });
      } else {
        filesByDir[dir].forEach((file) => {
          printSystem(chalk.hex("#CDD6F4")(`├── ${file}`));
        });
      }
    });
}

/**
 * Create application files
 */
async function createApplicationFiles(
  baseDir: string,
  folderName: string,
  files: Array<{ path: string; content: string }>,
): Promise<string> {
  const appDir = path.join(baseDir, folderName);

  await fs.mkdir(appDir, { recursive: true });
  printSystem(chalk.hex("#89B4FA")(`\n📁 Created directory: ${folderName}/`));

  for (const file of files) {
    const filePath = path.join(appDir, file.path);
    const fileDir = path.dirname(filePath);

    await fs.mkdir(fileDir, { recursive: true });
    await fs.writeFile(filePath, file.content, "utf8");
    printSystem(chalk.hex("#A6E3A1")(`  ✓ ${file.path}`));
  }

  return appDir;
}

/**
 * Generate application using structured output with Metis AI multi-provider support
 */
export async function generateApplication(
  description: string,
  aiService: AIService,
  cwd: string = process.cwd(),
): Promise<GeneratedAppResult> {
  const providerInfo = aiService.getProviderInfo();
  const providerBadge = `${providerInfo.providerName.toUpperCase()} (${providerInfo.modelName})`;

  const agentHeaderBox = boxen(
    `${chalk.bold.hex("#89B4FA")("🤖 Metis Agent Mode")}\n` +
      `${chalk.gray("Request:")} ${chalk.bold.white(description)}\n` +
      `${chalk.gray("Provider:")} ${chalk.cyan(providerBadge)}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "#89B4FA",
    },
  );
  printSystem(agentHeaderBox);

  const spinner = yoctoSpinner({
    text: chalk.hex("#89B4FA")("Generating structured application output..."),
  }).start();

  try {
    const languageModel = aiService.getLanguageModel();

    const result = await generateObject({
      model: languageModel,
      schema: ApplicationSchema,
      prompt: `Create a complete, production-ready application for: ${description}

CRITICAL REQUIREMENTS:
1. Generate ALL files needed for the application to run
2. Include package.json with ALL dependencies and correct versions (if needed)
3. Include README.md with setup instructions
4. Include configuration files (.gitignore, etc.) if needed
5. Write clean, well-commented, production-ready code
6. Include error handling and input validation
7. Use modern JavaScript/TypeScript best practices
8. Make sure all imports and paths are correct
9. NO PLACEHOLDERS - everything must be complete and working
10. For simple HTML/CSS/JS projects, you can skip package.json if not needed

Provide:
- A meaningful kebab-case folder name
- All necessary files with complete content
- Setup commands (for example: cd folder, npm install, npm run dev OR just open index.html)
- Make it visually appealing and functional`,
    });

    const application = result.object;
    spinner.success(
      `Generated application structure for ${chalk.bold.hex("#A6E3A1")(application.folderName)}`,
    );

    printSystem(
      chalk.hex("#A6E3A1")(`\n✅ Generated: ${application.folderName}\n`),
    );
    printSystem(chalk.gray(`Description: ${application.description}\n`));

    if (!application.files || application.files.length === 0) {
      throw new Error("No files were generated");
    }

    printSystem(chalk.hex("#A6E3A1")(`Files: ${application.files.length}\n`));

    // Display file tree
    displayFileTree(application.files, application.folderName);

    // Create application directory and files
    printSystem(chalk.hex("#89B4FA")("\n📝 Creating files...\n"));
    const appDir = await createApplicationFiles(
      cwd,
      application.folderName,
      application.files,
    );

    // Display results
    const successBox = boxen(
      `${chalk.bold.hex("#A6E3A1")("✨ Application created successfully!")}\n\n` +
        `${chalk.gray("📁 Location:")} ${chalk.bold.cyan(appDir)}`,
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "#A6E3A1",
      },
    );
    printSystem(successBox);

    // Display setup commands
    if (application.setupCommands && application.setupCommands.length > 0) {
      printSystem(chalk.bold.hex("#89B4FA")("📋 Next Steps:\n"));
      printSystem(chalk.hex("#A6ADC8")("```bash"));
      application.setupCommands.forEach((cmd) => {
        printSystem(chalk.white(cmd));
      });
      printSystem(chalk.hex("#A6ADC8")("```\n"));
    } else {
      printSystem(chalk.hex("#F9E2AF")("ℹ️  No setup commands provided\n"));
    }

    return {
      folderName: application.folderName,
      appDir,
      files: application.files.map((f) => f.path),
      commands: application.setupCommands || [],
      success: true,
    };
  } catch (err: unknown) {
    spinner.error("Failed to generate application");
    const error = err instanceof Error ? err : new Error(String(err));
    printSystem(
      chalk.red(`\n❌ Error generating application: ${error.message}\n`),
    );
    if (error.stack) {
      printSystem(chalk.dim(error.stack + "\n"));
    }
    throw error;
  }
}
