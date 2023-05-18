import { Configuration, OpenAIApi } from "openai";
const configuration = new Configuration({
  organization: import.meta.env.VITE_OPENAI_ORGANIZATION,
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export const openai = new OpenAIApi(configuration);
