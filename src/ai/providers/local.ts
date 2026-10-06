/** LocalGemmaProvider transport: Gemma 3 1B running in this browser. Nothing leaves the device. */
import { completeLocal, localUsable } from "@/ai/local/manager";
import { ProviderError, type CompletionRequest, type ModelTransport } from "./types";

export const localTransport: ModelTransport = {
  id: "local-gemma",
  async complete(req: CompletionRequest) {
    if (!localUsable()) throw new ProviderError("unavailable");
    const out = await completeLocal(req.messages, req.maxTokens);
    if (out === null) throw new ProviderError("unavailable", "local model returned nothing (cancelled, timed out or failed)");
    return out;
  },
};
