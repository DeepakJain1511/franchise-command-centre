# /api/gemini

Optional. The app works without it — every call falls back to rules.

- `GET /api/gemini` → `{ enabled, model }`
- `POST /api/gemini` with `{ task, input }`. Only three tasks exist; prompts live on the server (`server/gemini.ts`):

| task | input | returns | used for |
|---|---|---|---|
| `parse` | `{ text, applicants: [{id, name}], territories: [id] }` | `{ intent, appIds, territoryId, changes: [{field, value}] }` | Follow-ups the rule parser didn't understand. Every change is validated by `sanitizeChange` before it is applied. |
| `reply` | `{ language, partnerName, managerName, question, facts }` | `{ reply }` | "Suggest reply" in the partner inbox (≤ 60 words, facts only). |
| `audit` | `{ applicants: [raw rows] }` | `{ rows: [{id, money, space, experience, background, timeline}] }` | Checks agent: independent rubric recomputation, compared with the engine. Disagreements are flagged, never applied. |

Key: `OPENROUTER_API_KEY` (and optional `OPENROUTER_MODEL`, default `google/gemini-3.7-flash`) — Google models via the OpenRouter gateway, pinned to Google providers — in `.env.local` for `npm run dev` / `vite preview`,
or in Vercel's environment variables. Never commit it.
