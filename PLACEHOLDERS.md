# Placeholders

Decisions are real — they come from the rule engine (`src/engine/*`, numbers in `src/config.ts`).
The items below are **placeholders kept on purpose** because the data isn't available yet. None of them
changes a decision, and each is labelled in the UI.

| Placeholder | Where | What would replace it |
|---|---|---|
| Payback estimate (sales, margin, costs by tier) | Partner portal · `data/mock/partner.ts` | Real P&L per store. Spec §2 keeps payback **out of the decision**; the card says "Illustrative estimate · not part of the decision". |
| Relationship managers (names, phone, email) | Partner portal, chat · `data/mock/partner.ts` | CRM assignment |
| Staff training roster, quiz scores, certificates | Partner portal · `data/mock/staff.ts`, `realEngine.ts` (staff methods) | An LMS |
| Training module progress | Drawer / partner portal | Modules show done once the "Complete training" task is marked done; per-module progress needs an LMS |
| Module hours | Drawer | Training team's programme (track lengths 2/4/6 weeks are from the spec) |
| PIN centroids and neighbourhood names | Map · `data/mock/pincodes.ts` | A PIN geometry source. PINs from an upload that aren't in the list sit near their city centre. |
| Catchment rings (km) on the map | Map | Visual only. The **decision** uses the spec's rule: penalty by PIN-number difference (§9.2). |
| Applications-received dates | Overview timeline | Not in the sheet; uploads use the decision date |
| Festival dates (Diwali, Ugadi, …) | `config.ts` → `OCCASION_DATES` | Approximate next occurrences (lunar calendar), used only for the notes date check (§6) |
| Kannada / Hindi strings | `src/i18n/kn.ts`, `hi.ts` | To be checked by a native speaker (§14) |

## Follow-ups that need data, not a guess

- "Deadline met" for a **hold** is not accepted as-is: the engine needs the actual details
  (e.g. "APP-019 space is 450 sq ft"). For **redirects**, "accepted" and "deadline met / space verified" are accepted.
- A fix submitted after a reservation lapsed re-runs the whole pipeline (spec §11.2), so it can take the slot back.
