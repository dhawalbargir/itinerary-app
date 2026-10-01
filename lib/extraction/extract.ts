import Anthropic from "@anthropic-ai/sdk";
import { Extraction, extractionJsonSchema, type ExtractionT } from "./schema";
import { SYSTEM_PROMPT, USER_PROMPT } from "./prompt";

const TOOL = "record_itinerary_items";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export class ExtractionError extends Error {}

function client() {
  if (!process.env.ANTHROPIC_API_KEY) throw new ExtractionError("ANTHROPIC_API_KEY is not set.");
  return new Anthropic({ maxRetries: 3 }); // retries 429/5xx with backoff
}

export async function extractFromFile(bytes: ArrayBuffer, mimeType: string): Promise<{ data: ExtractionT; raw: unknown }> {
  const data = Buffer.from(bytes).toString("base64");
  let fileBlock: Anthropic.ContentBlockParam;
  if (mimeType === "application/pdf") {
    fileBlock = { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  } else if ((IMAGE_TYPES as readonly string[]).includes(mimeType)) {
    fileBlock = { type: "image", source: { type: "base64", media_type: mimeType as ImageType, data } };
  } else {
    throw new ExtractionError(`Unsupported file type ${mimeType}. Upload a JPG, PNG, WebP or PDF.`);
  }

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: [fileBlock, { type: "text", text: USER_PROMPT }] },
  ];

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client().messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [{
        name: TOOL,
        description: "Record every itinerary item found in the document.",
        input_schema: extractionJsonSchema() as Anthropic.Tool.InputSchema,
      }],
      tool_choice: { type: "tool", name: TOOL },
      messages,
    });

    const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL);
    if (!call) {
      lastError = "The model did not return structured data.";
      continue;
    }
    const parsed = Extraction.safeParse(call.input);
    if (parsed.success) return { data: parsed.data, raw: call.input };

    // EXT validation retry: show the model its own output and the error once.
    lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    messages.push(
      { role: "assistant", content: res.content },
      { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, is_error: true,
        content: `Validation failed: ${lastError}. Call the tool again with corrected input.` }] },
    );
  }
  throw new ExtractionError(`Could not read this document: ${lastError}`);
}
