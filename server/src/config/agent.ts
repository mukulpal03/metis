import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";
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
        path: z
          .string()
          .describe(
            "Relative file path (e.g. index.html, styles.css, script.js, src/App.jsx)",
          ),
        content: z
          .string()
          .describe(
            "Complete code content for this file. MUST NOT be empty or missing logic.",
          ),
      }),
    )
    .describe(
      "Array of all project files. MANDATORY FOR WEB APPS: You MUST include index.html, styles.css, AND script.js (or main.js/ts). DO NOT OMIT script.js!",
    ),
  setupCommands: z
    .array(z.string())
    .describe(
      "Bash commands to setup and run (e.g., npm install, npm run dev, or open index.html)",
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

  printSystem(
    chalk.hex("#89B4FA")("\n🤖 Agent Mode: Generating your application...\n"),
  );
  printSystem(chalk.gray(`Request: ${description}\n`));

  const spinner = yoctoSpinner({
    text: chalk.hex("#89B4FA")("Building application structure and files..."),
  }).start();

  try {
    const languageModel = aiService.getLanguageModel();

    const result = await generateObject({
      model: languageModel,
      system: `You are an expert autonomous software engineering agent.
Your mission is to generate 100% complete, fully working production-ready applications.

CRITICAL INSTRUCTION FOR WEB APPLICATIONS:
1. ALWAYS generate separate, dedicated files for each layer:
   - index.html (HTML structure with <link rel="stylesheet" href="styles.css"> and <script src="script.js" defer></script>)
   - styles.css (Polished, modern CSS styling with flexbox/grid, dynamic animations, and vibrant styling)
   - script.js (FULL interactive JavaScript code: event listeners, game state, DOM manipulation, storage logic, etc.)
   - README.md (Setup instructions)
2. ABSOLUTELY NEVER omit the JavaScript logic file (script.js). A web application without a separate JavaScript file containing interactive logic is broken and UNACCEPTABLE.
3. Write clean, complete code with ZERO placeholders, ZERO TODOs, and ZERO truncated logic.`,
      schema: ApplicationSchema,
      prompt: `Create a complete, production-ready application for: ${description}

Provide:
- A meaningful kebab-case folder name
- All necessary files with complete content (index.html, styles.css, script.js, README.md, package.json if needed)
- Setup commands (for example: "Open index.html in browser" OR "cd <folder> && npm install && npm run dev")`,
    });

    const application = result.object;

    if (!application.files || application.files.length === 0) {
      throw new Error("No files were generated");
    }

    // Safety check: Enforce JS file creation for HTML web projects
    const hasHtml = application.files.some((f) => f.path.endsWith(".html"));
    const hasScript = application.files.some(
      (f) =>
        f.path.endsWith(".js") ||
        f.path.endsWith(".ts") ||
        f.path.endsWith(".jsx") ||
        f.path.endsWith(".tsx"),
    );

    if (hasHtml && !hasScript) {
      spinner.text = chalk.hex("#89B4FA")(
        "Generating missing JavaScript logic file (script.js)...",
      );

      const scriptResult = await generateObject({
        model: languageModel,
        schema: z.object({
          filename: z
            .string()
            .describe("The filename for the script, e.g. script.js"),
          content: z
            .string()
            .describe(
              "Complete, full-featured interactive JavaScript code with event listeners and logic",
            ),
        }),
        prompt: `Write the complete, interactive JavaScript code (script.js) for the following application request: "${description}".
Existing HTML/CSS code:
${application.files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n")}

CRITICAL: Implement all interactive logic, DOM manipulation, event listeners, state updates, winning/reset logic, and dynamic controls!`,
      });

      if (scriptResult.object?.content) {
        const scriptFileName = scriptResult.object.filename || "script.js";
        application.files.push({
          path: scriptFileName,
          content: scriptResult.object.content,
        });

        // Ensure index.html references the script file
        const htmlIndex = application.files.findIndex((f) =>
          f.path.endsWith(".html"),
        );
        if (
          htmlIndex !== -1 &&
          !application.files[htmlIndex].content.includes(scriptFileName)
        ) {
          if (application.files[htmlIndex].content.includes("</body>")) {
            application.files[htmlIndex].content = application.files[
              htmlIndex
            ].content.replace(
              "</body>",
              `  <script src="${scriptFileName}" defer></script>\n</body>`,
            );
          } else {
            application.files[htmlIndex].content +=
              `\n<script src="${scriptFileName}" defer></script>`;
          }
        }
      }
    }

    spinner.success("Structured application generated successfully!");

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
    printSystem(
      chalk.bold.hex("#A6E3A1")("\n✨ Application created successfully!\n"),
    );
    printSystem(chalk.hex("#89B4FA")(`📁 Location: ${chalk.bold(appDir)}\n`));

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
