import OpenAI from "openai";
import { Extraction, extractionJsonSchema, type ExtractionT } from "./schema";
import { SYSTEM_PROMPT, USER_PROMPT } from "./prompt";

const TOOL = "record_itinerary_items";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export class ExtractionError extends Error {}

function client() {
  if (!process.env.OPENAI_API_KEY) throw new ExtractionError("OPENAI_API_KEY is not set.");
  return new OpenAI({ maxRetries: 3 }); // retries 429/5xx with backoff
}

/** Reads one image or PDF with an OpenAI vision model and returns validated items (EXT-1, EXT-5). */
export async function extractFromFile(bytes: ArrayBuffer, mimeType: string): Promise<{ data: ExtractionT; raw: unknown }> {
  const b64 = Buffer.from(bytes).toString("base64");
  let filePart: OpenAI.Responses.ResponseInputContent;
  if (mimeType === "application/pdf") {
    filePart = { type: "input_file", filename: "document.pdf", file_data: `data:application/pdf;base64,${b64}` };
  } else if (IMAGE_TYPES.includes(mimeType)) {
    filePart = { type: "input_image", image_url: `data:${mimeType};base64,${b64}`, detail: "high" };
  } else {
    throw new ExtractionError(`Unsupported file type ${mimeType}. Upload a JPG, PNG, WebP or PDF.`);
  }

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote = lastError
      ? `\n\nYour previous answer failed validation: ${lastError}. Call the tool again with corrected input.`
      : "";
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const res = await client().responses.create({
      model,
      // Reading a ticket needs little reasoning; low effort is much faster on reasoning models.
      ...(/^(gpt-5|o\d)/.test(model) ? { reasoning: { effort: "low" as const } } : {}),
      instructions: SYSTEM_PROMPT,
      input: [{ role: "user", content: [filePart, { type: "input_text", text: USER_PROMPT + retryNote }] }],
      tools: [{
        type: "function",
        name: TOOL,
        description: "Record every itinerary item found in the document.",
        parameters: extractionJsonSchema(),
        strict: false,
      }],
      tool_choice: { type: "function", name: TOOL },
    });

    const call = res.output.find(
      (o): o is OpenAI.Responses.ResponseFunctionToolCall => o.type === "function_call" && o.name === TOOL,
    );
    if (!call) {
      lastError = "the model did not return structured data";
      continue;
    }
    let input: unknown;
    try {
      input = JSON.parse(call.arguments);
    } catch {
      lastError = "the tool arguments were not valid JSON";
      continue;
    }
    const parsed = Extraction.safeParse(input);
    if (parsed.success) return { data: parsed.data, raw: input };
    lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  throw new ExtractionError(`Could not read this document: ${lastError}`);
}
