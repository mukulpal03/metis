import { cancel, confirm, intro, isCancel, outro } from "@clack/prompts";
import { logger } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import chalk from "chalk";
import { Command } from "commander";
import open from "open";
import yoctoSpinner from "yocto-spinner";
import { z } from "zod";
import { getStoredToken, isTokenExpired, storeToken } from "../../../lib/token";
import { CONFIG_DIR, TOKEN_FILE } from "../../../lib/config";

export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
export const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || "";

// Re-export for backward compatibility (other modules may import from here)
export { CONFIG_DIR, TOKEN_FILE };

export async function loginAction(opts?: unknown) {
  const optionsSchema = z.object({
    serverUrl: z.string().optional(),
    clientId: z.string().optional(),
  });

  const options = optionsSchema.parse(opts || {});

  const serverUrl = options.serverUrl || BACKEND_URL;
  const clientId = options.clientId || CLIENT_ID;

  intro(
    chalk.bgHex("#89B4FA").hex("#11111B").bold(" METIS CLI ") +
      " " +
      chalk.bold.cyan("🔏 Auth CLI Login"),
  );

  const existingToken = await getStoredToken();
  const expired = await isTokenExpired(existingToken);

  if (existingToken && !expired) {
    const shouldReAuth = await confirm({
      message: "You are already loggedIn. Do You want to login Again?",
      initialValue: false,
    });

    if (isCancel(shouldReAuth) || !shouldReAuth) {
      cancel("Login Cancelled");
      process.exit(0);
    }
  }

  const authClient = createAuthClient({
    baseURL: serverUrl,
    plugins: [deviceAuthorizationClient()],
  });

  const spinner = yoctoSpinner({ text: "Requesting Device authorization... " });
  spinner.start();

  try {
    const { data, error } = await authClient.$fetch<{
      device_code: string;
      user_code: string;
      verification_uri: string;
      verification_uri_complete: string;
      expires_in: number;
      interval: number;
    }>("/device/code", {
      method: "POST",
      body: {
        client_id: clientId,
      },
    });

    if (error || !data) {
      spinner.stop();
      cancel(
        `Failed to request device authorization: ${error?.message || JSON.stringify(error || "No data returned")}`,
      );
      process.exit(1);
    }

    const {
      device_code,
      user_code,
      verification_uri,
      verification_uri_complete,
      expires_in,
      interval,
    } = data;

    spinner.stop();

    console.log(chalk.bold.hex("#F9E2AF")("🔐 Device Authorization Required"));
    console.log(
      chalk.hex("#A6ADC8")("🌐 Please visit: ") +
        chalk.bold.underline.hex("#89B4FA")(
          verification_uri_complete || verification_uri,
        ),
    );
    console.log(
      chalk.hex("#A6ADC8")("🔑 Please enter code: ") +
        chalk.bgHex("#CBA6F7").hex("#11111B").bold(` ${user_code} `),
    );

    const shouldOpen = await confirm({
      message: "Open verification URL in your browser automatically?",
      initialValue: true,
    });

    if (!isCancel(shouldOpen) && shouldOpen) {
      await open(verification_uri_complete || verification_uri);
    }

    const token = await pollForToken(
      authClient,
      device_code,
      clientId,
      interval,
    );

    if (token) {
      // Extract user data
      let user = (token as any).user;
      if (!user && (token as any).access_token) {
        try {
          const sessionRes = await (authClient as any).getSession({
            fetchOptions: {
              headers: {
                authorization: `Bearer ${(token as any).access_token}`,
              },
            },
          });
          if (sessionRes?.data?.user) {
            user = sessionRes.data.user;
          }
        } catch (_) {}
      }

      if (!user) {
        try {
          const { db } = await import("../../../lib/db");
          const dbDeviceCode = await db.deviceCode.findFirst({
            where: {
              OR: [
                { deviceCode: device_code },
                { userCode: user_code },
              ],
            },
          });
          if (dbDeviceCode?.userId) {
            const dbUser = await db.user.findUnique({
              where: { id: dbDeviceCode.userId },
            });
            if (dbUser) {
              user = {
                id: dbUser.id,
                name: dbUser.name,
                email: dbUser.email,
                image: dbUser.image,
              };
            }
          }
        } catch (err: any) {
          logger.warn(`Could not resolve user from DB: ${err.message || err}`);
        }
      }

      if (user) {
        (token as any).user = user;
      }

      const saved = await storeToken(token);
      if (!saved) {
        console.log(
          chalk.yellow("\n⚠️  Warning: Could not save authentication token."),
        );
        console.log(
          chalk.yellow("   You may need to login again on next use."),
        );
      }

      // Save user to DB if user data is present
      if (user && user.email) {
        try {
          const { db } = await import("../../../lib/db");
          await db.user.upsert({
            where: { email: user.email },
            update: {
              name: user.name || "",
              image: user.image || null,
            },
            create: {
              id: user.id || user.email,
              email: user.email,
              name: user.name || "",
              image: user.image || null,
            },
          });
        } catch (err: any) {
          logger.error(`Failed to sync user to database: ${err.message || err}`);
        }
      }

      outro(
        chalk.bold.green(
          `🎉 Login successful! ${user?.name ? `Welcome, ${user.name}!` : user?.email ? `Logged in as ${user.email}.` : ""}`,
        ),
      );
    }
  } catch (err: any) {
    spinner.stop();
    cancel(`Device authorization error: ${err.message || err}`);
    process.exit(1);
  }
}

async function pollForToken(
  authClient: any,
  deviceCode: string,
  clientId: string,
  initialInterval: number,
) {
  let pollingInterval = initialInterval;
  const spinner = yoctoSpinner({ text: "", color: "cyan" });
  let dots = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      dots = (dots + 1) % 4;
      spinner.text = chalk.gray(
        `Polling for authorization${".".repeat(dots)}${" ".repeat(3 - dots)}`,
      );
      if (!spinner.isSpinning) spinner.start();

      try {
        const { data, error } = await authClient.device.token({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: clientId,
          fetchOptions: {
            headers: {
              "user-agent": `My CLI`,
            },
          },
        });

        if (data?.access_token) {
          spinner.stop();
          console.log("Authorization successful!");
          resolve(data);
          return;
        } else if (error) {
          switch (error.error) {
            case "authorization_pending":
              // Continue polling
              break;
            case "slow_down":
              pollingInterval += 5;
              break;
            case "access_denied":
              spinner.stop();
              cancel("Access was denied by the user.");
              process.exit(1);
            case "expired_token":
              spinner.stop();
              cancel("The device code has expired. Please try again.");
              process.exit(1);
            default:
              spinner.stop();
              cancel(`Error: ${error.error_description || error.error}`);
              process.exit(1);
          }
        }
      } catch (error: any) {
        spinner.stop();
        logger.error(`Error: ${error.message || error}`);
        process.exit(1);
      }

      setTimeout(poll, pollingInterval * 1000);
    };

    setTimeout(poll, pollingInterval * 1000);
  });
}

export const loginCommand = new Command("login")
  .description("Authenticate your Metis CLI")
  .option("--server-url <url>", "Custom backend server URL", BACKEND_URL)
  .option("--client-id <id>", "Custom OAuth client ID", CLIENT_ID)
  .action(async (opts) => {
    await loginAction(opts);
  });
