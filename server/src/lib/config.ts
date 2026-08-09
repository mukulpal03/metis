import os from "os";
import path from "path";

/**
 * Shared CLI configuration constants.
 * Extracted to avoid circular dependencies between token.ts and login.ts.
 */
export const CONFIG_DIR = path.join(os.homedir(), ".better-auth");
export const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");
