// Provider presets for the "Add service" form. Token costs are per single
// token in USD (provider list price). Picking one fills the URL + metering so
// users never have to guess. "flat" presets charge a fixed price per call.

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  metering: "flat" | "per_token";
  inputTokenCost?: number; // USD per input token
  outputTokenCost?: number; // USD per output token
  costPerRequest?: number; // USD per call (flat)
}

// Per-token prices are list price / 1,000,000.
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai-gpt-4o",
    label: "OpenAI · gpt-4o",
    baseUrl: "https://api.openai.com/v1",
    metering: "per_token",
    inputTokenCost: 2.5 / 1_000_000,
    outputTokenCost: 10 / 1_000_000,
  },
  {
    id: "openai-gpt-4o-mini",
    label: "OpenAI · gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    metering: "per_token",
    inputTokenCost: 0.15 / 1_000_000,
    outputTokenCost: 0.6 / 1_000_000,
  },
  {
    id: "anthropic-sonnet",
    label: "Anthropic · Claude Sonnet",
    baseUrl: "https://api.anthropic.com/v1",
    metering: "per_token",
    inputTokenCost: 3 / 1_000_000,
    outputTokenCost: 15 / 1_000_000,
  },
  {
    id: "anthropic-haiku",
    label: "Anthropic · Claude Haiku",
    baseUrl: "https://api.anthropic.com/v1",
    metering: "per_token",
    inputTokenCost: 0.8 / 1_000_000,
    outputTokenCost: 4 / 1_000_000,
  },
  {
    id: "google-gemini-flash",
    label: "Google · Gemini 1.5 Flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    metering: "per_token",
    inputTokenCost: 0.075 / 1_000_000,
    outputTokenCost: 0.3 / 1_000_000,
  },
];

export function findPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
