import OpenAI, { APIError, APIUserAbortError } from "openai";
import { AIProvider, AIProviderError, JsonCompletionParams } from "./provider";

/**
 * OpenAI provider using the Responses API with strict structured outputs.
 * Model name comes from OPENAI_MODEL - never hardcoded.
 * All provider-specific code stays in this file.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async completeJson(params: JsonCompletionParams): Promise<unknown> {
    try {
      const response = await this.client.responses.create(
        {
          model: this.model,
          input: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
          text: {
            format: {
              type: "json_schema",
              name: params.schemaName,
              schema: params.jsonSchema,
              strict: true,
            },
          },
          max_output_tokens: params.maxOutputTokens ?? 4000,
        },
        { signal: params.signal }
      );
      try {
        return JSON.parse(response.output_text);
      } catch {
        throw new AIProviderError(
          "invalid_response",
          "The model returned malformed JSON."
        );
      }
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      if (err instanceof APIUserAbortError) {
        throw new AIProviderError("cancelled", "The request was cancelled.");
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIProviderError("cancelled", "The request was cancelled.");
      }
      if (err instanceof APIError) {
        // Never forward provider error bodies to the client.
        throw new AIProviderError(
          "provider_unavailable",
          "The writing model is unavailable right now."
        );
      }
      throw new AIProviderError(
        "provider_unavailable",
        "The writing model is unavailable right now."
      );
    }
  }
}
