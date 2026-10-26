/**
 * Client for /api/gemini. Every call is optional: on any failure (no key, static host, rate limit, timeout)
 * it resolves to null and the caller uses the rule-based path.
 */
export interface AiStatus {
  enabled: boolean;
  model: string | null;
}

let status: Promise<AiStatus> | null = null;

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

export function aiStatus(): Promise<AiStatus> {
  status ??= withTimeout(async (signal) => {
    const r = await fetch('/api/gemini', { signal });
    if (!r.ok) return { enabled: false, model: null };
    const j = (await r.json()) as Partial<AiStatus>;
    return { enabled: !!j.enabled, model: j.model ?? null };
  }, 4000).catch(() => ({ enabled: false, model: null }));
  return status;
}

export async function aiTask<T>(task: 'parse' | 'reply' | 'audit', input: unknown, timeoutMs = 12000): Promise<T | null> {
  const s = await aiStatus();
  if (!s.enabled) return null;
  try {
    return await withTimeout(async (signal) => {
      const r = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task, input }), signal });
      if (!r.ok) return null;
      const j = (await r.json()) as { data?: T };
      return j.data ?? null;
    }, timeoutMs);
  } catch {
    return null;
  }
}
