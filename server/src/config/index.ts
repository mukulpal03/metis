export const config = {
  googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
  model: process.env["METIS-MODEL"] || process.env.METIS_MODEL || "gemini-2.5-flash",
};

export const geminiApiKey = config.googleApiKey;
export const geminiModelName = config.model;
