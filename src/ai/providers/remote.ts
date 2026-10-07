/**
 * RemoteGemmaProvider transport: opt-in Gemma behind MERA's own server (/api/gemma).
 * Sends only the task name and structured input — the server rebuilds the prompt.
 * Reflection notes are included only when the person separately allows it.
 */
import { ProviderError, type CompletionRequest, type ModelTransport } from "./types";

const TIMEOUT_MS = 30_000;

export function remoteTransport(fetchImpl: typeof fetch = (...a) => fetch(...a)): ModelTransport {
  return {
    id: "remote-gemma",
    async complete(req: CompletionRequest) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) throw new ProviderError("network", "offline");
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
      try {
        const res = await fetchImpl("/api/gemma", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ task: req.task, input: req.input, repair: req.repair, maxTokens: req.maxTokens }),
          signal: abort.signal,
        });
        if (res.status === 503) throw new ProviderError("unavailable", "remote Gemma isn't configured on this server");
        if (!res.ok) throw new ProviderError("network", `HTTP ${res.status}`);
        const body = (await res.json()) as { output?: unknown };
        if (typeof body.output !== "string") throw new ProviderError("invalid_output", "no output");
        return body.output;
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError(abort.signal.aborted ? "timeout" : "network");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
