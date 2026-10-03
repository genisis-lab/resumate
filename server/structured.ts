import { callAI, parseJsonObject, type AiSettings, type JsonSchema, type OpenAiMessage } from "./ai-proxy"

export interface StructuredRequest<T> {
  messages: OpenAiMessage[]
  schema: JsonSchema
  temperature?: number
  maxTokens?: number
  /** Return the validated value, or a short reason the output was rejected. */
  validate: (value: Record<string, unknown>) => T | { invalid: string }
}

function isInvalid<T>(value: T | { invalid: string }): value is { invalid: string } {
  return Boolean(value && typeof value === "object" && "invalid" in (value as object))
}

// Ask for structured JSON, validate it, and make one corrective retry when the
// reply is malformed or ungrounded. Provider errors are not retried here.
export async function generateStructured<T>(settings: AiSettings, request: StructuredRequest<T>): Promise<{ value: T } | { error: string }> {
  const temperature = request.temperature ?? 0.3
  let messages = request.messages
  let reason = "AI returned an invalid structured response"
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = await callAI(settings, messages, true, attempt ? Math.min(temperature, 0.2) : temperature, request.schema, request.maxTokens)
    const parsed = parseJsonObject(output)
    const result = parsed ? request.validate(parsed) : { invalid: "The reply was not a single JSON object." }
    if (!isInvalid(result)) return { value: result }
    reason = result.invalid
    messages = [
      ...request.messages,
      { role: "assistant", content: output.slice(0, 6_000) },
      { role: "user", content: `Your previous reply was rejected: ${reason} Reply again with only the corrected JSON object. Keep every fact grounded in the supplied text.` },
    ]
  }
  return { error: reason }
}
