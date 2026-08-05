import { cancel, confirm, intro, isCancel, outro } from "@clack/prompts";
import { logger } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import chalk from "chalk";
import { Command } from "commander";
import dotenv from "dotenv";
import fs from "fs/promises";
import open from "open";
import os from "os";
import path from "path";
import yoctoSpinner from "yocto-spinner";
import { z } from "zod";
import { db } from "../../../lib/db";

dotenv.config();

export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
export const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
export const CONFIG_DIR = path.join(os.homedir(), ".better-auth");
export const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");

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

  const existingToken = false;
  const expired = false;

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
        `Failed to request device authorization: ${error?.message || JSON.stringify(error || "No data returned")}`
      );
      process.exit(1);
    }

    //Extract all the necessary fields from data

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
        chalk.bold.underline.hex("#89B4FA")(verification_uri_complete || verification_uri)
    );
    console.log(
      chalk.hex("#A6ADC8")("🔑 Please enter code: ") +
        chalk.bgHex("#CBA6F7").hex("#11111B").bold(` ${user_code} `)
    );

    const shouldOpen = await confirm({
      message: "Open verification URL in your browser automatically?",
      initialValue: true,
    });

    if (!isCancel(shouldOpen) && shouldOpen) {
      await open(verification_uri_complete || verification_uri);
    }

    const pollSpinner = yoctoSpinner({
      text: chalk.hex("#F9E2AF")("Waiting for user authorization in browser..."),
    });
    pollSpinner.start();
    
  } catch (err: any) {
    spinner.stop();
    cancel(`Device authorization error: ${err.message || err}`);
    process.exit(1);
  }
}

export const loginCommand = new Command("login")
  .description("Authenticate your Metis CLI")
  .option("--server-url <url>", "Custom backend server URL", BACKEND_URL)
  .option("--client-id <id>", "Custom OAuth client ID", CLIENT_ID)
  .action(async (opts) => {
    await loginAction(opts);
  });
