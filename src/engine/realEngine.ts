/**
 * The real DecisionEngine: wraps the pure pipeline (runPipeline) with per-browser state —
 * base data (sample or upload, never modified), ordered overrides, the demo time slider, chat threads.
 * State lives in localStorage for THIS browser only (spec §16: never shared storage).
 */
import { addDays, format, parseISO } from 'date-fns';
import { APPROVAL_BAR, SPACE_SIZE, TIME_SLIDER_MAX_DAYS } from '@/config';
import { applications as sampleApps } from '@/data/mock/applications';
import { cityCentres, pincodes } from '@/data/mock/pincodes';
import { economicsByTier, managersByCity, managersByTerritory } from '@/data/mock/partner';
import { seedStaffNames, staffCatalog, STAFF_PASS_MARK } from '@/data/mock/staff';
import { stores as sampleStores } from '@/data/mock/stores';
import { territories as sampleTerritories } from '@/data/mock/territories';
import { LANG_OF, t } from '@/i18n';
import { aiTask } from '@/lib/gemini';
import { compareAudit, runChecks, type AuditRow, type CheckReport } from './checks';
import { diffResults } from './diff';
import { extractChanges, findIds, parseFollowUp, sanitizeChange, type Change, type Parsed } from './followups';
import type { AppResult, BaseData, Override, PipelineResult, TaskStatus } from './model';
import { currentStage } from './onboarding';
import { parseWorkbook, type ParseReport } from './parse';
import { runPipeline } from './pipeline';
import { chipsOf, scoreLine, statusOf, textOf, toDecision } from './present';
import type {
  Application, AskResponse, ChatMessage, Dataset, Decision, DecisionEngine, Explanation, InboxThread, Language, PartnerProfile, PinState,
  Reason, ScenarioChange, ScenarioPreset, ScenarioResult, StaffMember, StaffRole, StaffRoster, TerritoryState,
} from './types';

/** Day 0 of the demo = the decision date. */
export const DECISION_DATE = '2026-10-26';
const STORAGE_KEY = 'fcc:state:v1';

const SAMPLE: BaseData = { applications: sampleApps, territories: sampleTerritories, stores: sampleStores, parseWarnings: [] };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const isoPlus = (iso: string, n: number) => format(addDays(parseISO(iso), n), 'yyyy-MM-dd');
const fmt = (iso: string) => format(parseISO(iso), 'd MMM');
const tick = (ms = 60) => new Promise<void>((r) => setTimeout(r, ms));

export class DatasetError extends Error {
  constructor(public messages: string[], public report: ParseReport | null) {
    super(messages.join(' '));
  }
}

interface Persisted {
  source: Dataset['source'];
  fileName?: string;
  base?: BaseData; // only for uploads
  overrides: Override[];
  day: number;
  threads: Record<string, ChatMessage[]>;
  unread: Record<string, number>;
  loadedAt: string;
}

class RealEngine implements DecisionEngine {
  private base: BaseData = SAMPLE;
  private source: Dataset['source'] = 'sample';
  private fileName: string | undefined;
  private loadedAt = new Date().toISOString();
  private overrides: Override[] = [];
  private day = 0;
  private threads = new Map<string, ChatMessage[]>();
  private unread = new Map<string, number>();
  private rosters = new Map<string, StaffMember[]>();
  private sims = new Map<string, Change[]>();
  private appliedSims = new Map<string, string[]>();
  private cache: { key: string; res: PipelineResult } | null = null;
  private rev = 0;
  private seq = 0;
  /** True when this browser already had a working copy (refresh / second tab). */
  restored = false;

  constructor() {
    this.restore();
  }

  /* ---------------- persistence (this browser only) ---------------- */

  private persist() {
    const p: Persisted = {
      source: this.source, fileName: this.fileName, base: this.source === 'upload' ? this.base : undefined, overrides: this.overrides,
      day: this.day, threads: Object.fromEntries(this.threads), unread: Object.fromEntries(this.unread), loadedAt: this.loadedAt,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* storage full / blocked — state stays in memory */
    }
  }

  /** Re-read state (also called when another tab of this browser changed it). */
  restore() {
    try {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Persisted;
      this.source = p.source;
      this.fileName = p.fileName;
      this.base = p.source === 'upload' && p.base ? p.base : SAMPLE;
      this.overrides = p.overrides ?? [];
      this.day = p.day ?? 0;
      this.threads = new Map(Object.entries(p.threads ?? {}));
      this.unread = new Map(Object.entries(p.unread ?? {}));
      this.loadedAt = p.loadedAt ?? this.loadedAt;
      this.restored = true;
      this.changed(false);
    } catch {
      /* corrupt state — start clean */
    }
  }

  private changed(save = true) {
    this.rev++;
    this.cache = null;
    if (save) this.persist();
  }

  /* ---------------- pipeline ---------------- */

  private today() {
    return isoPlus(DECISION_DATE, this.day);
  }

  private options() {
    return { decisionDate: DECISION_DATE, today: this.today() };
  }

  private run(extra: Override[] = []): PipelineResult {
    if (extra.length) return runPipeline(this.base, [...this.overrides, ...extra], this.options());
    const key = `${this.rev}`;
    if (this.cache?.key !== key) this.cache = { key, res: runPipeline(this.base, this.overrides, this.options()) };
    return this.cache.res;
  }

  private result(id: string): AppResult {
    const r = this.run().results.find((x) => x.id === id);
    if (!r) throw new Error(`Unknown application ${id}`);
    return r;
  }

  private decisions(): Decision[] {
    const res = this.run();
    return res.results.map((r) => toDecision(r, this.overrides, DECISION_DATE, res.options.today));
  }

  async getPipeline() {
    return this.run();
  }

  async getAlerts() {
    return this.run().alerts;
  }

  getDay() {
    return this.day;
  }

  async setDay(day: number) {
    this.day = Math.max(0, Math.min(TIME_SLIDER_MAX_DAYS, Math.round(day)));
    this.changed();
  }

  /* ---------------- dataset ---------------- */

  async inspectFile(file: File): Promise<{ report: ParseReport; base: BaseData | null }> {
    const XLSX = await import('xlsx');
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      return { report: { ok: false, sheets: [], errors: [`That's a .${ext || 'unknown'} file — upload the Excel template (.xlsx).`], warnings: [] }, base: null };
    }
    const wb = XLSX.read(await file.arrayBuffer(), { cellStyles: true });
    return parseWorkbook(wb, XLSX.utils, { submittedAt: DECISION_DATE });
  }

  async loadDataset(source: 'sample' | File): Promise<Dataset> {
    if (source === 'sample') {
      this.base = SAMPLE;
      this.source = 'sample';
      this.fileName = undefined;
    } else {
      const { report, base } = await this.inspectFile(source);
      if (!report.ok || !base) throw new DatasetError(report.errors.length ? report.errors : ['That file could not be read.'], report);
      this.base = base;
      this.source = 'upload';
      this.fileName = source.name;
    }
    // A new dataset starts a fresh working copy.
    this.overrides = [];
    this.day = 0;
    this.threads.clear();
    this.unread.clear();
    this.rosters.clear();
    this.loadedAt = new Date().toISOString();
    this.changed();
    return this.getDatasetSync();
  }

  private getDatasetSync(): Dataset {
    const res = this.run();
    return {
      source: this.source,
      fileName: this.fileName,
      applications: clone(res.applications),
      territories: clone(res.territoryInputs),
      stores: clone(res.stores),
      cities: (Object.keys(cityCentres) as Array<keyof typeof cityCentres>).map((city) => ({ city, ...cityCentres[city] })),
      loadedAt: this.loadedAt,
    };
  }

  async getDataset() {
    return this.getDatasetSync();
  }

  sessionInfo() {
    return { restored: this.restored, source: this.source, fileName: this.fileName };
  }

  async getDecisions() {
    return this.decisions();
  }

  /* ---------------- explanations ---------------- */

  async explain(applicationId: string): Promise<Explanation> {
    const res = this.run();
    const r = this.result(applicationId);
    const txt = textOf(r);
    const fullReasoning = [
      `Outcome: ${txt.outcome}. ${txt.main}`,
      ...txt.others,
      `Score: ${scoreLine(r)}`,
      ...txt.warnings.map((w) => `Note: ${w}`),
      ...(r.decidedBy ? [`Decided by: ${r.decidedBy}.`] : []),
      ...txt.tips.map((tip) => `Tip: ${tip}`),
      'One store per PIN is enforced: a PIN with an existing or planned store is locked.',
    ];
    const competitors = r.competitors
      .map((id) => res.results.find((x) => x.id === id))
      .filter((x): x is AppResult => !!x)
      .map((x) => ({ applicationId: x.id, name: x.app.name, status: statusOf(x), rank: x.slotRank ?? x.queuePosition, investmentLakh: x.app.investmentLakh ?? 0 }))
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    return { applicationId, status: statusOf(r), summary: txt.main, reasons: chipsOf(r), fullReasoning, competitors };
  }

  /* ---------------- territories + pins ---------------- */

  private territoryStates(): TerritoryState[] {
    const res = this.run();
    const months = ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01'].filter((m) => m <= res.options.today.slice(0, 7));
    return res.territories.map((t) => {
      const inT = res.results.filter((x) => t.applicants.includes(x.id));
      const ranked = [
        ...inT.filter((x) => x.slotTerritoryId === t.id && x.slotRank).sort((a, b) => (a.slotRank ?? 0) - (b.slotRank ?? 0)),
        ...t.queue.map((id) => res.results.find((x) => x.id === id)!).filter((x) => x && x.slotTerritoryId !== t.id),
        ...inT.filter((x) => !(x.slotTerritoryId === t.id && x.slotRank) && !t.queue.includes(x.id)).sort((a, b) => b.adjustedScore - a.adjustedScore),
      ];
      const qualified = inT.filter((x) => x.adjustedPct >= x.bar && x.outcome !== 'REJECT' && x.outcome !== 'WITHDRAWN').length;
      return {
        territoryId: t.id,
        openSlots: t.openSlots,
        filled: t.approved.length + t.reserved.length,
        applicants: inT.length,
        competingIds: [...new Set(ranked.map((x) => x.id))],
        oversubscribed: qualified > t.openSlots,
        fillHistory: months.map((m) => ({
          month: m,
          filled: res.results.filter((x) => x.slotTerritoryId === t.id && (x.outcome === 'APPROVE' || x.reservation) && (x.onboarding?.startDate ?? x.reservation?.awardedOn ?? DECISION_DATE).slice(0, 7) <= m).length,
        })),
      };
    });
  }

  async getTerritoryState() {
    return this.territoryStates();
  }

  async getPinStates(): Promise<PinState[]> {
    const res = this.run();
    const tStates = this.territoryStates();
    const terrOf = (pin: string) => res.territoryInputs.find((t) => t.pins.includes(pin));
    const allPins = new Set<string>([...res.territoryInputs.flatMap((t) => t.pins), ...res.stores.map((s) => s.pin), ...res.applications.map((a) => a.pin).filter((p) => /^\d{6}$/.test(p))]);
    return [...allPins].map((pin) => {
      const meta = pincodes.find((p) => p.pin === pin);
      const t = terrOf(pin);
      const store = res.stores.find((s) => s.pin === pin);
      const apps = res.results.filter((x) => x.app.pin === pin);
      const liveApps = apps.filter((x) => x.outcome !== 'REJECT' && x.outcome !== 'WITHDRAWN');
      const allocated = res.results.find((x) => x.slotPin === pin && (x.outcome === 'APPROVE' || x.outcome === 'HOLD_RESERVED' || x.outcome === 'REDIRECT_RESERVED'));
      const ts = t ? tStates.find((x) => x.territoryId === t.id) : undefined;
      let status: PinState['status'];
      let note: string | null = null;
      if (store) {
        status = 'store';
        note = 'Store already here — one store per PIN.';
      } else if (allocated) {
        status = 'allocated';
        note = `${allocated.outcome === 'APPROVE' ? 'Planned' : 'Reserved'} for ${allocated.id} — one store per PIN.`;
      } else if (!t) {
        status = 'outside';
        note = apps.length ? `${apps.length} applicant${apps.length > 1 ? 's' : ''}, no territory` : null;
      } else if (liveApps.length >= 2) {
        status = 'conflict';
        note = `${liveApps.length} applicants, 1 PIN`;
      } else if (liveApps.length === 1) {
        status = 'interest';
      } else if (ts && ts.filled < ts.openSlots) {
        status = 'open';
      } else {
        status = 'full';
        note = `No slot left in ${t.id}`;
      }
      const city = meta?.city ?? t?.city ?? store?.city ?? apps[0]?.app.city ?? 'Bengaluru';
      const centre = cityCentres[city];
      return {
        pin, city, area: meta?.area ?? '—',
        // PINs we have no centroid for (uploads) sit near their city centre — demo-approximate.
        lat: meta?.lat ?? centre.lat + ((Number(pin) % 97) - 48) * 0.0006,
        lng: meta?.lng ?? centre.lng + ((Number(pin) % 89) - 44) * 0.0006,
        territoryId: t?.id ?? null, status, storeId: store?.id ?? null, allocatedTo: allocated?.id ?? null,
        applicantIds: apps.map((x) => x.id), locked: status === 'store' || status === 'allocated', note,
      };
    });
  }

  /* ---------------- overrides (§16) ---------------- */

  getOverrides() {
    return clone(this.overrides);
  }

  private toOverrides(changes: Change[], source: Override['source'], reason?: string): Override[] {
    const now = new Date().toISOString();
    return changes.map((c) => ({
      id: `OV-${Date.now().toString(36)}-${++this.seq}`, target: c.target, targetId: c.id, field: c.field, value: c.value, reason,
      timestamp: now, effectiveDate: this.today(), source, label: `${c.id}: ${c.label}`,
    }));
  }

  async applyChanges(changes: Change[], source: Override['source'], reason?: string) {
    const before = this.run();
    const ovs = this.toOverrides(changes, source, reason);
    this.overrides.push(...ovs);
    this.changed();
    return { overrideIds: ovs.map((o) => o.id), diff: diffResults(before, this.run()) };
  }

  async undoLast() {
    if (!this.overrides.length) return [];
    const before = this.run();
    // Undo removes the last *change*, i.e. every override made in the same action.
    const lastTs = this.overrides[this.overrides.length - 1].timestamp;
    this.overrides = this.overrides.filter((o) => o.timestamp !== lastTs);
    this.changed();
    return diffResults(before, this.run());
  }

  async removeOverrides(ids: string[]) {
    const before = this.run();
    this.overrides = this.overrides.filter((o) => !ids.includes(o.id));
    this.changed();
    return diffResults(before, this.run());
  }

  async resetOverrides() {
    this.overrides = [];
    this.changed();
  }

  async setTaskStatus(applicationId: string, taskId: string, status: TaskStatus, by: 'partner' | 'company') {
    const r = this.result(applicationId);
    const task = r.onboarding?.tasks.find((x) => x.id === taskId);
    const label = task ? t('en', task.code) : taskId;
    const verb = status === 'Verified' ? 'verified' : status === 'Done — awaiting check' ? 'marked done' : 'reopened';
    await this.applyChanges(
      [{ target: 'app', id: applicationId, field: 'task', value: { taskId, status }, label: `${label} ${verb} by ${by === 'partner' ? 'partner' : 'expansion team'}` }],
      by,
    );
  }

  async extendDeadline(applicationId: string, reason: string) {
    return (await this.applyChanges([{ target: 'app', id: applicationId, field: 'deadline', value: 'extend', label: 'deadline extended by 7 days' }], 'company', reason)).diff;
  }

  async releaseReservation(applicationId: string, reason: string) {
    return (await this.applyChanges([{ target: 'app', id: applicationId, field: 'release', value: true, label: 'reservation released — slot to next in line' }], 'company', reason)).diff;
  }

  /* ---------------- Ask (§16) ---------------- */

  private async parse(text: string): Promise<{ parsed: Parsed; source: 'rules' | 'gemini' }> {
    const res = this.run();
    const parsed = parseFollowUp(text, res.applications, res.results);
    if (parsed.kind !== 'unknown') return { parsed, source: 'rules' };
    // Rules didn't understand it — let Gemini extract structure, then validate every field ourselves.
    const ai = await aiTask<{ intent?: string; appIds?: string[]; territoryId?: string | null; changes?: Array<{ field: string; value: unknown }> }>('parse', {
      text,
      applicants: res.applications.slice(0, 400).map((a) => ({ id: a.id, name: a.name })),
      territories: res.territoryInputs.map((x) => x.id),
    });
    if (!ai) return { parsed, source: 'rules' };
    const appIds = (ai.appIds ?? []).filter((id) => res.applications.some((a) => a.id === id));
    const territoryId = ai.territoryId && res.territoryInputs.some((x) => x.id === ai.territoryId) ? ai.territoryId : undefined;
    if ((ai.intent === 'update' || ai.intent === 'whatif') && appIds.length) {
      const app = res.applications.find((a) => a.id === appIds[0])!;
      const changes = (ai.changes ?? []).map((c) => sanitizeChange(c, app, res.results.find((x) => x.id === app.id))).filter((c): c is Change => !!c);
      if (changes.length) return { parsed: { kind: ai.intent, appIds, territoryId, changes, assumptions: [] }, source: 'gemini' };
    }
    const intents = ['why', 'next', 'compare', 'territory', 'summary'] as const;
    const intent = intents.find((i) => i === ai.intent);
    if (intent && (appIds.length || territoryId || intent === 'summary')) return { parsed: { kind: 'question', intent, appIds, territoryId }, source: 'gemini' };
    return { parsed, source: 'rules' };
  }

  private suggestions(): string[] {
    const res = this.run();
    const hold = res.results.find((x) => statusOf(x) === 'On hold' || statusOf(x) === 'Needs info');
    const noSpace = res.results.find((x) => x.flags.some((f) => f.code === 'F_NO_SPACE') && x.outcome !== 'REJECT');
    const terr = [...res.territories].sort((a, b) => b.applicants.length - a.applicants.length)[0];
    return [
      ...(hold ? [`Why is ${hold.id} ${statusOf(hold) === 'Needs info' ? 'waiting on info' : 'on hold'}?`] : []),
      ...(noSpace ? [`${noSpace.id} has now found a ground-floor space`] : []),
      ...(terr ? [`Who is competing for ${terr.id}?`] : []),
      'How many applications are approved?',
    ];
  }

  private decisionAnswer(r: AppResult, kind: 'decision' | 'next'): AskResponse {
    const txt = textOf(r);
    const order = (x: Reason) => (x.sentiment === 'hurt' ? 0 : x.sentiment === 'missing' ? 1 : 2);
    return {
      kind, applicationId: r.id, status: statusOf(r), reasons: [...chipsOf(r)].sort((a, b) => order(a) - order(b)).slice(0, 3),
      sentence: `${r.app.name} — ${txt.outcome}${txt.sub ? ` (${txt.sub})` : ''}. ${txt.main}`,
      why: [...txt.others, `Score: ${scoreLine(r)}`, ...txt.warnings].slice(0, 6),
      next: txt.nextSteps.slice(0, 4),
    };
  }

  async ask(question: string): Promise<AskResponse> {
    await tick(120);
    const { parsed, source } = await this.parse(question);
    const res = this.run();
    const byId = (id: string) => res.results.find((x) => x.id === id);

    if (parsed.kind === 'update' || parsed.kind === 'whatif') {
      const understood = `Understood: ${parsed.changes.map((c) => `${c.id} ${c.label}`).join('; ')}`;
      const before = res;
      const after = parsed.kind === 'update' ? (await this.applyChanges(parsed.changes, 'ask')) : null;
      const now = parsed.kind === 'update' ? this.run() : this.run(this.toOverrides(parsed.changes, 'sandbox'));
      const diff = after?.diff ?? diffResults(before, now);
      const focusId = parsed.appIds[0] ?? diff[0]?.id;
      const r = focusId ? now.results.find((x) => x.id === focusId) : undefined;
      const base = r ? this.decisionAnswer(r, 'decision') : null;
      return {
        kind: parsed.kind, applicationId: r?.id, territoryId: parsed.territoryId, status: r ? statusOf(r) : undefined, reasons: base?.reasons ?? [],
        sentence: r ? `${parsed.kind === 'whatif' ? 'Would be' : 'Now'}: ${base!.sentence}` : `${parsed.kind === 'whatif' ? 'Would change' : 'Changed'} ${diff.length} applicant${diff.length === 1 ? '' : 's'}.`,
        why: base?.why, next: base?.next, understood, assumptions: parsed.assumptions, diff, overrideIds: after?.overrideIds, source,
      };
    }

    if (parsed.kind === 'question') {
      const r = parsed.appIds[0] ? byId(parsed.appIds[0]) : undefined;
      if (parsed.intent === 'compare' && parsed.appIds.length >= 2) {
        const rows = parsed.appIds.slice(0, 4).map((id) => byId(id)!).filter(Boolean);
        const best = [...rows].sort((a, b) => b.adjustedScore - a.adjustedScore)[0];
        return {
          kind: 'compare', reasons: [], source,
          sentence: `${best.app.name} (${best.id}) ranks higher — adjusted score ${Math.round(best.adjustedScore)}.`,
          compare: rows.map((x) => ({
            applicationId: x.id, name: x.app.name, status: statusOf(x), outcome: textOf(x).outcome, score: Math.round(x.adjustedPct), bar: x.bar,
            factors: (['money', 'space', 'experience', 'background', 'timeline'] as const).map((k) => `${x.score.factors[k].points}/${x.score.factors[k].max}`).concat(x.penalty.penalty ? [`−${x.penalty.penalty}`] : ['0']),
          })),
          why: rows.map((x) => `${x.id}: ${textOf(x).main}`),
        };
      }
      if (r) return { ...this.decisionAnswer(r, parsed.intent === 'next' ? 'next' : 'decision'), source };
      if (parsed.intent === 'territory' && parsed.territoryId) {
        const tr = res.territories.find((x) => x.id === parsed.territoryId);
        const ts = this.territoryStates().find((x) => x.territoryId === parsed.territoryId);
        if (tr && ts) {
          return {
            kind: 'territory', territoryId: tr.id, reasons: [], source,
            sentence: `${tr.openSlots} slot${tr.openSlots === 1 ? '' : 's'} · ${tr.approved.length} approved · ${tr.reserved.length} reserved · ${tr.remaining} free · ${tr.queue.length} in queue.`,
            ranked: ts.competingIds.map((id) => {
              const x = byId(id)!;
              return { applicationId: id, name: x.app.name, status: statusOf(x), note: `${Math.round(x.adjustedPct)} · ${textOf(x).sub ?? textOf(x).outcome}` };
            }),
            why: tr.belowBar.length ? [`Below the ${APPROVAL_BAR[tr.priority]} bar: ${tr.belowBar.join(', ')}`] : [],
          };
        }
      }
      if (parsed.intent === 'summary') {
        const count = (f: (x: AppResult) => boolean) => res.results.filter(f).length;
        const counts = [
          { label: 'Approved', value: count((x) => x.outcome === 'APPROVE') },
          { label: 'Hold — reserved', value: count((x) => x.outcome === 'HOLD_RESERVED') },
          { label: 'Redirect — reserved', value: count((x) => x.outcome === 'REDIRECT_RESERVED') },
          { label: 'Hold', value: count((x) => x.outcome === 'HOLD') },
          { label: 'Waitlist', value: count((x) => x.outcome === 'WAITLIST') },
          { label: 'Rejected', value: count((x) => x.outcome === 'REJECT') },
          { label: 'Withdrawn', value: count((x) => x.outcome === 'WITHDRAWN') },
        ].filter((c) => c.value > 0);
        const health = ['On track', 'At risk', 'Delayed'].map((h) => ({ label: h, value: count((x) => x.outcome === 'APPROVE' && x.onboarding?.health === h) }));
        return {
          kind: 'summary', reasons: [], source, counts,
          sentence: `${res.results.length} applications · ${counts[0]?.label === 'Approved' ? counts[0].value : 0} approved across ${res.territories.length} territories.`,
          why: [`Onboarding health: ${health.map((h) => `${h.label} ${h.value}`).join(' · ')}`, `${res.alerts.length} alert${res.alerts.length === 1 ? '' : 's'} open`],
        };
      }
    }
    const ids = findIds(question, res.applications);
    return {
      kind: 'fallback', reasons: [], source,
      sentence: ids.appIds.length
        ? `I found ${ids.appIds[0]} but not what changed. Try "${ids.appIds[0]} has found a 450 sq ft ground-floor space", or use the form below.`
        : 'I didn’t catch an application or territory ID. Try one of these, or use the form below.',
      suggestions: this.suggestions(),
    };
  }


  /* ---------------- What-if sandbox ---------------- */

  private scenarioToChanges(c: ScenarioChange): Change[] {
    const app = this.run().applications.find((a) => a.id === c.applicationId);
    if (!app) return [];
    const out: Change[] = [];
    const push = (field: Change['field'], value: Change['value'], label: string) => out.push({ target: 'app', id: app.id, field, value, label });
    if (c.space !== undefined && c.space !== app.space) push('space', c.space, `space → ${c.space}`);
    if (c.floor !== undefined && c.floor !== app.floor) push('floor', c.floor, `floor → ${c.floor}`);
    if (c.spaceSqft !== undefined && c.spaceSqft !== app.spaceSqft) push('spaceSqft', c.spaceSqft, `size → ${c.spaceSqft ?? 'unknown'}${c.spaceSqft ? ' sq ft' : ''}`);
    if (c.launchMonths !== undefined && c.launchMonths !== app.launchMonths) push('launchMonths', c.launchMonths, `target launch → ${c.launchMonths} months`);
    if (c.investmentLakh !== undefined && c.investmentLakh !== app.investmentLakh) push('investmentLakh', c.investmentLakh, `investment → ₹${c.investmentLakh}L`);
    if (c.experienceYears !== undefined && c.experienceYears !== app.experienceYears) push('experienceYears', c.experienceYears, `experience → ${c.experienceYears} yrs`);
    if (c.pin !== undefined && c.pin !== app.pin) push('pin', c.pin, `pin → ${c.pin}`);
    return out;
  }

  async simulate(change: ScenarioChange): Promise<ScenarioResult> {
    await tick(200);
    const before = this.run();
    const changes = this.scenarioToChanges(change);
    const after = changes.length ? this.run(this.toOverrides(changes, 'sandbox')) : before;
    const b = before.results.find((x) => x.id === change.applicationId)!;
    const a = after.results.find((x) => x.id === change.applicationId)!;
    const bReasons = chipsOf(b);
    const aReasons = chipsOf(a);
    const bMap = new Map(bReasons.map((x) => [x.id, x]));
    const flipped = aReasons.filter((x) => bMap.get(x.id)?.sentiment !== x.sentiment || bMap.get(x.id)?.label !== x.label).map((x) => x.id);
    const diff = diffResults(before, after);
    const ripples = diff
      .filter((d) => d.id !== change.applicationId)
      .flatMap((d) => d.changes.filter((c) => c.what === 'outcome' || c.what === 'slot' || c.what === 'queue').map((c) => ({ label: `${d.id} ${c.what}`, before: c.before, after: c.after, applicationId: d.id })));
    const terrBefore = before.territories.find((x) => x.id === (a.slotTerritoryId ?? a.territoryId));
    const terrAfter = after.territories.find((x) => x.id === terrBefore?.id);
    if (terrBefore && terrAfter && terrBefore.remaining !== terrAfter.remaining) {
      ripples.unshift({ label: `${terrBefore.id} free slots`, before: String(terrBefore.remaining), after: String(terrAfter.remaining), applicationId: '' });
    }
    const id = `SIM-${String(++this.seq).padStart(3, '0')}`;
    this.sims.set(id, changes);
    const ta = textOf(a);
    return {
      id, change, canned: diff.length > 0, diff,
      before: { status: statusOf(b), reasons: bReasons, confidence: Math.max(0, b.adjustedPct / 100) },
      after: { status: statusOf(a), reasons: aReasons, confidence: Math.max(0, a.adjustedPct / 100) },
      flipped, ripples,
      sentence: !changes.length ? 'Nothing changed — pick a different value.' : diff.length ? `${ta.outcome}${ta.sub ? ` · ${ta.sub}` : ''}. ${ta.main}` : 'No change to any decision. ' + ta.main,
    };
  }

  async getScenarioPresets(): Promise<ScenarioPreset[]> {
    const res = this.run();
    const out: ScenarioPreset[] = [];
    const add = (r: AppResult | undefined, title: string, change: Omit<ScenarioChange, 'applicationId'>) => {
      if (r && !out.some((o) => o.applicationId === r.id)) out.push({ applicationId: r.id, title, change: { applicationId: r.id, ...change } });
    };
    const ideal = (r: AppResult) => SPACE_SIZE[r.score.tier].idealMin + 150;
    const noSpace = res.results.find((x) => x.flags.some((f) => f.code === 'F_NO_SPACE') && x.outcome !== 'REJECT' && x.outcome !== 'WITHDRAWN');
    if (noSpace) add(noSpace, `${noSpace.id} finds a ground-floor space`, { space: 'Rented', floor: 'Ground', spaceSqft: ideal(noSpace) });
    const noSize = res.results.find((x) => x.flags.some((f) => f.code === 'F_SIZE_MISSING'));
    if (noSize) add(noSize, `${noSize.id} shares a ${ideal(noSize)} sq ft size`, { spaceSqft: ideal(noSize) });
    const small = res.results.find((x) => x.flags.some((f) => f.code === 'F_SPACE_TOO_SMALL'));
    if (small) add(small, `${small.id} moves to a ${ideal(small)} sq ft unit`, { spaceSqft: ideal(small), floor: 'Ground' });
    const upper = res.results.find((x) => x.app.floor === 'Upper' && (x.outcome === 'WAITLIST' || x.outcome === 'HOLD'));
    if (upper) add(upper, `${upper.id} switches to a ground floor`, { floor: 'Ground' });
    const money = res.results.find((x) => x.warnings.some((w) => w.code === 'W_PAYBACK_RISK') && x.outcome !== 'APPROVE');
    if (money) add(money, `${money.id} raises investment to ₹${money.score.tierMin}L`, { investmentLakh: money.score.tierMin });
    return out.slice(0, 4);
  }

  async applyScenario(result: ScenarioResult) {
    const changes = this.sims.get(result.id) ?? this.scenarioToChanges(result.change);
    const { overrideIds } = await this.applyChanges(changes, 'sandbox');
    this.appliedSims.set(result.id, overrideIds);
  }

  async revertScenario(scenarioId: string) {
    const ids = this.appliedSims.get(scenarioId);
    if (ids) await this.removeOverrides(ids);
    this.appliedSims.delete(scenarioId);
  }

  /* ---------------- Partner portal + chat ---------------- */

  private manager(app: Application) {
    const terr = this.run().territoryInputs.find((x) => x.pins.includes(app.pin));
    return (terr && managersByTerritory[terr.id]) || managersByCity[app.city];
  }

  private thread(id: string): ChatMessage[] {
    if (!this.threads.has(id)) {
      const r = this.result(id);
      const lang = LANG_OF[r.app.language];
      const m = this.manager(r.app);
      const txt = textOf(r, lang);
      this.threads.set(id, [
        { id: 'm1', from: 'brand', at: `${DECISION_DATE}T10:00:00`, text: t(lang, 'CHAT_HELLO', { name: r.app.name.split(' ')[0], manager: m.name }) },
        { id: 'm2', from: 'assistant', at: `${DECISION_DATE}T10:01:00`, text: t(lang, 'CHAT_STATUS', { outcome: txt.outcome, reason: txt.main }) },
      ]);
    }
    return this.threads.get(id)!;
  }

  async getPartnerProfile(applicationId: string): Promise<PartnerProfile> {
    const r = this.result(applicationId);
    const app = r.app;
    const tierName = `Tier ${r.tier}` as const;
    // Placeholder economics (payback is out of scope for decisions — spec §2). Shown as an illustrative estimate only.
    const e = economicsByTier[tierName];
    const profit = e.monthlySalesLakh * e.grossMargin - e.monthlyCostsLakh;
    const inv = app.investmentLakh ?? r.score.tierMin;
    return {
      applicationId,
      manager: this.manager(app),
      economics: { investmentLakh: inv, monthlySalesLakh: e.monthlySalesLakh, grossMargin: e.grossMargin, monthlyCostsLakh: e.monthlyCostsLakh, paybackMonths: profit > 0 ? Math.ceil(inv / profit) : Infinity, basis: `similar ${tierName} stores` },
      messages: clone(this.thread(applicationId)),
    };
  }

  /** Instant, engine-grounded answer in the partner's language. */
  private assistantReply(r: AppResult, text: string): string {
    const lang = LANG_OF[r.app.language];
    const low = text.toLowerCase();
    const txt = textOf(r, lang);
    const m = this.manager(r.app);
    const p = r.onboarding;
    if (/open|launch|date|when|kab|yavaga/.test(low)) {
      return p && r.outcome === 'APPROVE'
        ? t(lang, 'CHAT_OPENING', { date: fmt(p.openingDate), stage: t(lang, `STAGE_${currentStage(p)}`) })
        : `${t(lang, 'CHAT_NO_PLAN')} ${t(lang, 'CHAT_STATUS', { outcome: txt.outcome, reason: txt.main })}`;
    }
    if (/train|module|course|staff|sikh/.test(low)) {
      return p ? t(lang, 'CHAT_TRAINING', { track: t(lang, `TRACK_${p.track}`), language: r.app.language, week: p.trainingStartWeek }) : t(lang, 'CHAT_NO_PLAN');
    }
    if (/space|shop|rent|floor|sq|dukan|jaga|angadi/.test(low)) {
      const s = SPACE_SIZE[r.score.tier];
      return t(lang, 'CHAT_SPACE', { city: r.app.city, min: s.min, idealMin: s.idealMin, idealMax: s.idealMax });
    }
    if (/payback|profit|earn|return/.test(low)) return t(lang, 'CHAT_PAYBACK');
    if (/why|status|decision|hold|wait|reject|approved|kyun|yake|result/.test(low)) {
      return `${t(lang, 'CHAT_STATUS', { outcome: txt.outcome, reason: txt.main })}${txt.nextSteps[0] ? ` ${t(lang, 'CHAT_NEXT', { next: txt.nextSteps[0] })}` : ''}`;
    }
    if (/next|task|do|step|kya karu|madbeku/.test(low)) {
      return txt.nextSteps.length ? t(lang, 'CHAT_NEXT', { next: txt.nextSteps.slice(0, 2).join(' · ') }) : t(lang, 'CHAT_STATUS', { outcome: txt.outcome, reason: txt.main });
    }
    return t(lang, 'CHAT_DEFAULT', { manager: m.name });
  }

  async sendPartnerMessage(applicationId: string, text: string): Promise<ChatMessage> {
    const r = this.result(applicationId);
    const thread = this.thread(applicationId);
    const now = new Date().toISOString();
    const { changes } = extractChanges(text, r.app, r);
    const detected = changes.length
      ? { understood: changes.map((c) => c.label).join('; '), changes: changes.map((c) => ({ field: c.field, value: c.value, label: c.label })), applied: false }
      : undefined;
    thread.push({ id: `p${thread.length + 1}-${Date.now().toString(36)}`, from: 'partner', text, at: now, ...(detected ? { detected } : {}) });
    this.unread.set(applicationId, (this.unread.get(applicationId) ?? 0) + 1);
    await tick(500);
    const lang = LANG_OF[r.app.language];
    const reply = detected
      ? t(lang, 'CHAT_FORWARDED', { manager: this.manager(r.app).name, understood: detected.understood })
      : this.assistantReply(r, text);
    const msg: ChatMessage = { id: `a${thread.length + 1}-${Date.now().toString(36)}`, from: 'assistant', text: reply, at: new Date().toISOString() };
    thread.push(msg);
    this.persist();
    return msg;
  }

  async getInbox(): Promise<InboxThread[]> {
    const res = this.run();
    return [...this.threads.entries()]
      .filter(([, msgs]) => msgs.some((m) => m.from === 'partner'))
      .map(([id, msgs]) => {
        const r = res.results.find((x) => x.id === id);
        return {
          applicationId: id, name: r?.app.name ?? id, status: r ? statusOf(r) : 'On hold', last: msgs[msgs.length - 1] ?? null,
          unread: this.unread.get(id) ?? 0, pendingUpdate: msgs.some((m) => m.detected && !m.detected.applied),
        };
      })
      .sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? ''));
  }

  async sendBrandMessage(applicationId: string, text: string): Promise<ChatMessage> {
    const thread = this.thread(applicationId);
    const msg: ChatMessage = { id: `b${thread.length + 1}-${Date.now().toString(36)}`, from: 'brand', text: text.trim(), at: new Date().toISOString() };
    thread.push(msg);
    this.unread.set(applicationId, 0);
    this.persist();
    return msg;
  }

  async markThreadRead(applicationId: string) {
    this.unread.set(applicationId, 0);
    this.persist();
  }

  async suggestReply(applicationId: string): Promise<{ text: string; source: 'rules' | 'gemini' }> {
    const r = this.result(applicationId);
    const lang = LANG_OF[r.app.language];
    const thread = this.thread(applicationId);
    const lastQ = [...thread].reverse().find((m) => m.from === 'partner')?.text ?? '';
    const txt = textOf(r, lang);
    const ai = await aiTask<{ reply?: string }>('reply', {
      language: r.app.language, partnerName: r.app.name, managerName: this.manager(r.app).name, question: lastQ,
      facts: {
        outcome: txt.outcome, detail: txt.sub, reason: txt.main, nextSteps: txt.nextSteps.slice(0, 3), deadline: r.reservation?.deadline ?? null,
        openingDate: r.outcome === 'APPROVE' ? r.onboarding?.openingDate ?? null : null, trainingTrack: r.onboarding?.track ?? null,
      },
    });
    if (ai?.reply) return { text: ai.reply, source: 'gemini' };
    // After an update (or with no question) the most useful reply is the current status + the next step.
    const lastPartner = [...thread].reverse().find((m) => m.from === 'partner');
    return { text: this.assistantReply(r, !lastPartner || lastPartner.detected ? 'status' : lastQ), source: 'rules' };
  }

  async applyDetectedUpdate(applicationId: string, messageId: string) {
    const thread = this.thread(applicationId);
    const msg = thread.find((m) => m.id === messageId);
    if (!msg?.detected || msg.detected.applied) return [];
    const changes: Change[] = msg.detected.changes.map((c) => ({ target: 'app', id: applicationId, field: c.field, value: c.value, label: c.label }));
    const { diff } = await this.applyChanges(changes, 'partner', 'From partner chat');
    msg.detected.applied = true;
    const r = this.result(applicationId);
    const lang = LANG_OF[r.app.language];
    const txt = textOf(r, lang);
    thread.push({ id: `a${thread.length + 1}-${Date.now().toString(36)}`, from: 'assistant', at: new Date().toISOString(), text: t(lang, 'CHAT_APPLIED', { outcome: txt.outcome, reason: txt.main }) });
    this.persist();
    return diff;
  }

  /* ---------------- Checks agent ---------------- */

  async runChecks(withGemini: boolean): Promise<CheckReport> {
    const res = this.run();
    const report = runChecks(this.base, this.overrides, res);
    if (withGemini) {
      const rows = res.applications.slice(0, 60).map((a) => ({
        id: a.id, city: a.city, investmentLakh: a.investmentLakh, experienceYears: a.experienceYears, business: a.business, space: a.space,
        spaceSqft: a.spaceSqft, floor: a.floor, launchMonths: a.launchMonths,
      }));
      // Small batches in parallel: one big call is too slow for a serverless time limit.
      const batches: (typeof rows)[] = [];
      for (let i = 0; i < rows.length; i += 8) batches.push(rows.slice(i, i + 8));
      const answers = await Promise.all(batches.map((b) => aiTask<{ rows?: AuditRow[] }>('audit', { applicants: b }, 50000)));
      const auditRows = answers.flatMap((x) => x?.rows ?? []);
      if (auditRows.length) {
        const item = compareAudit(res, auditRows);
        if (answers.some((x) => !x?.rows)) item.detail += ` (${answers.filter((x) => !x?.rows).length} batch(es) did not answer)`;
        report.items.push(item);
        if (item.status === 'pass') report.passed++;
        else report.warned++;
      } else {
        report.items.push({ id: 'gemini', title: 'Gemini rubric cross-check', rule: '§7 (independent)', status: 'warn', offenders: [], detail: 'Gemini is not configured or did not answer — the rule checks above still ran in full.' });
        report.warned++;
      }
    }
    return report;
  }

  /* ---------------- Staff training (placeholder, partner portal) ---------------- */

  private score(staffId: string, moduleId: string) {
    const h = [...`${staffId}${moduleId}`].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 997, 7);
    return 74 + (h % 24);
  }

  private certify(m: StaffMember): StaffMember {
    const passed = m.modules.length > 0 && m.modules.every((x) => x.progress >= 1 && (x.quizScore ?? 0) >= STAFF_PASS_MARK);
    const last = m.modules.map((x) => x.completedAt ?? '').sort().pop() || this.today();
    return { ...m, certifiedAt: passed ? m.certifiedAt ?? last : null };
  }

  private newMember(appId: string, n: number, name: string, role: StaffRole, language: Language, joinedAt: string): StaffMember {
    return {
      id: `${appId}-ST${n}`, name, role, language, joinedAt, certifiedAt: null,
      modules: staffCatalog.filter((c) => c.forRoles.includes(role)).map((c) => ({ moduleId: c.id, assignedAt: joinedAt, progress: 0, quizScore: null, completedAt: null })),
    };
  }

  private roster(appId: string): StaffMember[] {
    if (this.rosters.has(appId)) return this.rosters.get(appId)!;
    const r = this.run().results.find((x) => x.id === appId);
    let members: StaffMember[] = [];
    // Placeholder: one seed staff member per approved partner until real staff data exists.
    if (r && r.outcome === 'APPROVE' && r.onboarding) {
      const [name, role] = seedStaffNames[r.app.language][0];
      members = [this.certify(this.newMember(appId, 1, name, role, r.app.language, r.onboarding.startDate))];
    }
    this.rosters.set(appId, members);
    return members;
  }

  private rosterOut(appId: string): StaffRoster {
    return { applicationId: appId, catalog: staffCatalog, passMark: STAFF_PASS_MARK, members: clone(this.roster(appId)) };
  }

  async getStaff(applicationId: string) {
    return this.rosterOut(applicationId);
  }

  async addStaff(applicationId: string, s: { name: string; role: StaffRole; language: Language }) {
    const list = this.roster(applicationId);
    list.push(this.newMember(applicationId, list.length + 1 + Math.floor(Math.random() * 1000), s.name.trim(), s.role, s.language, this.today()));
    return this.rosterOut(applicationId);
  }

  async assignStaffModule(applicationId: string, staffId: string, moduleId: string) {
    const list = this.roster(applicationId);
    const i = list.findIndex((m) => m.id === staffId);
    if (i >= 0 && !list[i].modules.some((x) => x.moduleId === moduleId)) {
      list[i] = this.certify({ ...list[i], certifiedAt: null, modules: [...list[i].modules, { moduleId, assignedAt: this.today(), progress: 0, quizScore: null, completedAt: null }] });
    }
    return this.rosterOut(applicationId);
  }

  async completeStaffModule(applicationId: string, staffId: string, moduleId: string) {
    const list = this.roster(applicationId);
    const i = list.findIndex((m) => m.id === staffId);
    if (i >= 0) {
      list[i] = this.certify({ ...list[i], modules: list[i].modules.map((x) => (x.moduleId === moduleId ? { ...x, progress: 1, quizScore: this.score(staffId, moduleId), completedAt: this.today() } : x)) });
    }
    return this.rosterOut(applicationId);
  }

  async removeStaff(applicationId: string, staffId: string) {
    this.rosters.set(applicationId, this.roster(applicationId).filter((m) => m.id !== staffId));
    return this.rosterOut(applicationId);
  }

  async reset() {
    this.base = SAMPLE;
    this.source = 'sample';
    this.fileName = undefined;
    this.overrides = [];
    this.day = 0;
    this.threads.clear();
    this.unread.clear();
    this.rosters.clear();
    this.sims.clear();
    this.appliedSims.clear();
    this.changed();
  }
}

export const realEngine = new RealEngine();
export type { RealEngine };
