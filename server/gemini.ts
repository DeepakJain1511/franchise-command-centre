/**
 * Gemini proxy (Google models via the OpenRouter gateway) — the key stays on the server
 * (Vercel function / Vite dev middleware), never in the bundle.
 * Only three fixed tasks are accepted, each with a server-owned prompt, so the endpoint is not an open proxy.
 * Gemini never makes a decision: it parses follow-ups, drafts chat replies and independently re-scores the rubric
 * for the checks agent. If it is missing, slow or rate-limited the app falls back to rules.
 */
import {
  BACKGROUND_KEYWORDS, BACKGROUND_POINTS, CITY_INFO, EXPERIENCE_BANDS, FLOOR_POINTS, MONEY_BANDS, OWNERSHIP_POINTS, REALISTIC_MIN_MONTHS_NO_SPACE,
  REALISTIC_MIN_MONTHS_WITH_SPACE, SIZE_POINTS, SPACE_SIZE, TIER_MIN_INVESTMENT, TIMELINE_LONG_MONTHS, TIMELINE_POINTS,
} from '../src/config';

export type Task = 'parse' | 'reply' | 'audit';
export interface GeminiEnv {
  /** OpenRouter key — every call goes through the OpenRouter gateway to a Google model. */
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
}

const MAX_BODY = 200_000;
const DEFAULT_MODEL = 'google/gemini-3.7-flash';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const RUBRIC = `Score each franchise applicant on 5 factors (integers). Use ONLY these rules.
Tier by city: ${Object.entries(CITY_INFO).map(([c, v]) => `${c}=T${v.tier}`).join(', ')}. Tier minimum investment (₹ lakh): T1 ${TIER_MIN_INVESTMENT[1]}, T2 ${TIER_MIN_INVESTMENT[2]}, T3 ${TIER_MIN_INVESTMENT[3]}.
MONEY (max 30): ratio = investment / tier minimum. ${MONEY_BANDS.map((b) => `ratio ≥ ${b.minRatio} → ${b.points}`).join('; ')}; below 0.7 → 0. Blank investment → 0.
SPACE (max 25): 0 if space is "Not yet identified", or size blank/0, or floor "Not known", or size below tier minimum (T1 ${SPACE_SIZE[1].min}, T2 ${SPACE_SIZE[2].min}, T3 ${SPACE_SIZE[3].min} sq ft). Otherwise ownership (Owned ${OWNERSHIP_POINTS.Owned}, Rented ${OWNERSHIP_POINTS.Rented}) + size (ideal range T1 ${SPACE_SIZE[1].idealMin}-${SPACE_SIZE[1].idealMax}, T2 ${SPACE_SIZE[2].idealMin}-${SPACE_SIZE[2].idealMax}, T3 ${SPACE_SIZE[3].idealMin}-${SPACE_SIZE[3].idealMax} → ${SIZE_POINTS.ideal}; between minimum and ideal minimum → ${SIZE_POINTS.slightlySmall}; above ideal max → ${SIZE_POINTS.larger}) + floor (Ground ${FLOOR_POINTS.Ground}, Mall unit ${FLOOR_POINTS['Mall unit']}, Upper ${FLOOR_POINTS.Upper}).
EXPERIENCE (max 20): years (blank = 0): ${EXPERIENCE_BANDS.map((b) => `≥${b.minYears} → ${b.points}`).join('; ')}.
BACKGROUND (max 15): scan "business" text, whole words, case-insensitive, first match wins. Retail words (${BACKGROUND_KEYWORDS.retail.join(', ')}) → ${BACKGROUND_POINTS.retail}; else business words (${BACKGROUND_KEYWORDS.otherBusiness.join(', ')}) → ${BACKGROUND_POINTS.otherBusiness}; else (blank, job, IT, student…) → ${BACKGROUND_POINTS.unclear}. Plurals count.
TIMELINE (max 10): realisticMin = ${REALISTIC_MIN_MONTHS_WITH_SPACE} if the applicant has an Owned/Rented space that is not below the tier minimum (a blank size still counts as having a space — the size is only unknown), else ${REALISTIC_MIN_MONTHS_NO_SPACE}. target blank → ${TIMELINE_POINTS.blank}; realisticMin ≤ target ≤ ${TIMELINE_LONG_MONTHS} → ${TIMELINE_POINTS.realistic}; target > ${TIMELINE_LONG_MONTHS} → ${TIMELINE_POINTS.long}; realisticMin−1 ≤ target < realisticMin → ${TIMELINE_POINTS.tight}; lower → ${TIMELINE_POINTS.unrealistic}.
Return JSON: {"rows":[{"id":"APP-001","money":0,"space":0,"experience":0,"background":0,"timeline":0}]} — one row per applicant, nothing else.`;

const PARSE = `You turn one plain-language message about franchise applicants into JSON for a rule engine. You never decide outcomes.
Return JSON only: {"intent":"why|next|compare|territory|summary|update|whatif|unknown","appIds":[],"territoryId":null,"changes":[{"field":"...","value":...}]}
- "update" = new information that should change the data; "whatif" = hypothetical ("what if", "suppose"); questions are why/next/compare/territory/summary.
- Only use IDs from the provided lists. Map applicant names to their IDs.
- Allowed change fields and values: space ("Owned"|"Rented"|"Not yet identified"), spaceSqft (number or null), floor ("Ground"|"Upper"|"Mall unit"|"Not known"), pin (6 digits), investmentLakh (number, ₹ lakh; 1 crore = 100), experienceYears (number), launchMonths (number), language ("Kannada"|"English"|"Hindi"), locationConfirmed (true), redirect ("accepted"|"declined"), deadline ("met"|"missed"|"extend"), withdrawn (true).
- Vague updates: apply only what is stated; for anything missing assume the LESS favourable option (e.g. "found a ground-floor space" → space "Rented", floor "Ground", spaceSqft null).`;

const REPLY = `You draft a short chat reply from a franchise brand's relationship manager to a partner.
Write in the partner's language (Kannada, Hindi or English, natural and polite). At most 60 words.
Use ONLY the facts given. Never promise approval, dates or money that are not in the facts. If the question is not covered, say the manager will check and reply within a working day.
Return JSON only: {"reply":"..."}`;

function stripFences(s: string) {
  return s.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One JSON-mode chat call to a Google model on OpenRouter. Retries 429 / 5xx up to 3 times; stops on 402. */
async function callGemini(env: GeminiEnv, system: string, user: string, timeoutMs: number): Promise<unknown> {
  const model = env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.max(1000, deadline - Date.now()));
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY ?? ''}`,
          'Content-Type': 'application/json',
          'X-Title': 'Franchise Partner Engine',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
          // Google's own infrastructure serves every request.
          provider: { only: ['google-vertex', 'google-ai-studio'], allow_fallbacks: false },
        }),
        signal: ctrl.signal,
      });
      if (r.status === 402) throw new Error('AI credits exhausted (402)');
      if ((r.status === 429 || r.status >= 500) && attempt < 3 && Date.now() < deadline - 1500) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
      const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return JSON.parse(stripFences(j.choices?.[0]?.message?.content ?? ''));
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function handleGemini(method: string, rawBody: string, env: GeminiEnv): Promise<{ status: number; json: unknown }> {
  const enabled = !!env.OPENROUTER_API_KEY;
  if (method === 'GET') return { status: 200, json: { enabled, model: enabled ? env.OPENROUTER_MODEL || DEFAULT_MODEL : null } };
  if (method !== 'POST') return { status: 405, json: { error: 'Method not allowed' } };
  if (!enabled) return { status: 503, json: { error: 'AI is not configured' } };
  if (rawBody.length > MAX_BODY) return { status: 413, json: { error: 'Too large' } };
  let body: { task?: Task; input?: unknown };
  try {
    body = JSON.parse(rawBody || '{}');
  } catch {
    return { status: 400, json: { error: 'Bad JSON' } };
  }
  try {
    switch (body.task) {
      case 'parse':
        return { status: 200, json: { data: await callGemini(env, PARSE, JSON.stringify(body.input), 10_000) } };
      case 'reply':
        return { status: 200, json: { data: await callGemini(env, REPLY, JSON.stringify(body.input), 10_000) } };
      case 'audit':
        return { status: 200, json: { data: await callGemini(env, RUBRIC, JSON.stringify(body.input), 50_000) } };
      default:
        return { status: 400, json: { error: 'Unknown task' } };
    }
  } catch (e) {
    return { status: 502, json: { error: e instanceof Error ? e.message : 'Gemini failed' } };
  }
}
