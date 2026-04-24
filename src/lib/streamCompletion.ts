/**
 * Streaming SSE parser for Lovable AI Gateway (OpenAI-compatible).
 * Calls onDelta with each token as it arrives.
 *
 * On HTTP errors we expose the parsed body so callers can route into a
 * dedicated error panel (status, message, raw body) with retry guidance.
 */
export interface StreamErrorInfo {
  status?: number;
  message: string;
  rawBody?: string;
}

export async function streamCompletion(opts: {
  url: string;
  body: unknown;
  authToken?: string;
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
  onError?: (err: StreamErrorInfo) => void;
}): Promise<void> {
  const { url, body, authToken, signal, onDelta, onError } = opts;

  const resp = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    let msg = `Request failed (${resp.status})`;
    let raw: string | undefined;
    try {
      raw = await resp.text();
      try {
        const j = JSON.parse(raw);
        msg = j?.error ?? msg;
      } catch { /* not JSON */ }
    } catch { /* noop */ }
    onError?.({ status: resp.status, message: msg, rawBody: raw });
    throw new Error(msg);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;

  while (!done) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") { done = true; break; }
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (delta) onDelta(delta);
      } catch {
        // partial JSON across chunks — re-buffer
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  // Flush leftovers
  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (!raw.startsWith("data: ")) continue;
      const payload = raw.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (delta) onDelta(delta);
      } catch { /* ignore */ }
    }
  }
}
