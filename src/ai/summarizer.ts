import Anthropic from "@anthropic-ai/sdk";
import type { Logger } from "pino";

export interface AiSummary {
  summary: string;
  industryClassification: string;
  model: string;
}

const MODEL = "claude-sonnet-4-5";

/**
 * Optional bonus stage: asks Claude for a short summary + industry classification from crawled page text.
 * Gated on ANTHROPIC_API_KEY being present and --llm being passed; any failure degrades to `null` rather
 * than breaking the run — the core JSON output must never depend on this succeeding.
 */
export async function summarizeCompany(textContext: string, logger: Logger): Promise<AiSummary | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.info("ANTHROPIC_API_KEY not set — skipping AI summarization");
    return null;
  }
  if (!textContext.trim()) return null;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content:
            "Based on the following extracted website text, respond with ONLY a JSON object of the shape " +
            '{"summary": string (2-3 sentences), "industryClassification": string (a short industry label)}. ' +
            `No prose outside the JSON.\n\nWebsite text:\n${textContext.slice(0, 8000)}`,
        },
      ],
    });

    const block = response.content.find((c) => c.type === "text");
    if (!block || block.type !== "text") return null;

    const jsonMatch = block.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as { summary?: unknown; industryClassification?: unknown };
    return {
      summary: String(parsed.summary ?? ""),
      industryClassification: String(parsed.industryClassification ?? ""),
      model: MODEL,
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "AI summarization failed — continuing without it");
    return null;
  }
}
