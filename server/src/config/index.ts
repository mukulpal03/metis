export const config = {
  googleApiKey:
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    "",
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "",
  provider: (
    process.env.AI_PROVIDER ||
    process.env.METIS_PROVIDER ||
    "auto"
  ).toLowerCase(),
  model:
    process.env["METIS-MODEL"] ||
    process.env.METIS_MODEL ||
    process.env.AI_MODEL ||
    "",
};

export const geminiApiKey = config.googleApiKey;
export const geminiModelName = config.model || "gemini-2.5-flash";
export const openaiApiKey = config.openaiApiKey;
export const openaiModelName = config.model || "gpt-4o-mini";

export * from "./tools";
export * from "./agent";


