/**
 * Provider abstraction. Kept deliberately small: one structured-JSON
 * completion method. Adding Anthropic later means implementing this
 * interface in one new file and registering it in index.ts.
 */
export interface JsonCompletionParams {
  system: string;
  user: string;
  /** Identifier for the expected shape, e.g. "writing_brief". */
  schemaName: string;
  /** Plain JSON schema (strict: all fields required, no extras). */
  jsonSchema: Record<string, unknown>;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface AIProvider {
  /** Machine name reported to the client ("openai" | "demo" | ...). */
  readonly name: string;
  /** Returns parsed (but not yet schema-validated) JSON. */
  completeJson(params: JsonCompletionParams): Promise<unknown>;
}

/** Error carrying a stable public code; never includes provider internals. */
export class AIProviderError extends Error {
  constructor(
    public readonly code:
      | "provider_unavailable"
      | "invalid_response"
      | "timeout"
      | "cancelled",
    message: string
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
