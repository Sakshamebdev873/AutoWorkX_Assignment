import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Logger } from "pino";

export interface AiSummary {
  summary: string;
  industryClassification: string;
  model: string;
}

const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const OPENAI_MODEL = "gpt-4o-mini";

const PROMPT_PREFIX =
  "Based on the following extracted website text, respond with ONLY a JSON object of the shape " +
  '{"summary": string (2-3 sentences), "industryClassification": string (a short industry label)}. ' +
  "No prose outside the JSON.\n\nWebsite text:\n";

function parseSummary(text: string, model: string): AiSummary | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]) as { summary?: unknown; industryClassification?: unknown };
  return {
    summary: String(parsed.summary ?? ""),
    industryClassification: String(parsed.industryClassification ?? ""),
    model,
  };
}

async function summarizeWithAnthropic(apiKey: string, textContext: string): Promise<AiSummary | null> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 300,
    messages: [{ role: "user", content: PROMPT_PREFIX + textContext.slice(0, 8000) }],
  });

  const block = response.content.find((c) => c.type === "text");
  if (!block || block.type !== "text") return null;

  return parseSummary(block.text, ANTHROPIC_MODEL);
}

async function summarizeWithOpenAi(apiKey: string, textContext: string): Promise<AiSummary | null> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: 300,
    messages: [{ role: "user", content: PROMPT_PREFIX + textContext.slice(0, 8000) }],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) return null;

  return parseSummary(text, OPENAI_MODEL);
}

/**
 * Optional bonus stage: asks an LLM for a short summary + industry classification from crawled page text.
 * Gated on an API key being present and --llm being passed; any failure degrades to `null` rather
 * than breaking the run — the core JSON output must never depend on this succeeding.
 * Prefers ANTHROPIC_API_KEY when both are set, otherwise falls back to OPENAI_API_KEY.
 */
export async function summarizeCompany(textContext: string, logger: Logger): Promise<AiSummary | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!anthropicKey && !openAiKey) {
    logger.info("no ANTHROPIC_API_KEY or OPENAI_API_KEY set — skipping AI summarization");
    return null;
  }
  if (!textContext.trim()) return null;

  try {
    if (anthropicKey) {
      return await summarizeWithAnthropic(anthropicKey, textContext);
    }
    return await summarizeWithOpenAi(openAiKey!, textContext);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "AI summarization failed — continuing without it");
    return null;
  }
}
