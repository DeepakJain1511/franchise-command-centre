/**
 * MOCK DecisionEngine — the ONLY implementation in Phase 1.
 * Everything here returns hand-written fixtures (data/mock/*) after a short fake delay.
 * The only derived values are joins (PIN -> territory), counts and the one-store-per-PIN
 * lock, which is a hard visible constraint rather than a decision rule.
 */
import { applications as appFixtures } from '@/data/mock/applications';
import { decisionFixtures, STEP_OFFSETS, STEP_OWNER, TRAINING_MODULES, type DecisionFixture, type ReasonTuple } from '@/data/mock/decisions';
import { cityCentres, pincodes } from '@/data/mock/pincodes';
import { cannedReplies, defaultReply, economicsByTier, managersByCity, managersByTerritory } from '@/data/mock/partner';
import { cannedScenarios } from '@/data/mock/scenarios';
import { seedStaffNames, staffCatalog, STAFF_PASS_MARK } from '@/data/mock/staff';
import { stores as storeFixtures } from '@/data/mock/stores';
import { territories as territoryFixtures } from '@/data/mock/territories';
import { dataFlagsFor } from '@/lib/dataQuality';
import { fromToday, plusDays, iso, DEMO_TODAY } from '@/lib/time';
import {
  ONBOARDING_STEPS,
  type Application,
  type AskResponse,
  type ChatMessage,
  type Dataset,
  type Decision,
  type DecisionEngine,
  type Explanation,
  type NextStep,
  type OnboardingPlan,
  type Language,
  type PartnerProfile,
  type PinState,
  type Reason,
  type ScenarioChange,
  type ScenarioPreset,
  type ScenarioResult,
  type StaffMember,
  type StaffRole,
  type StaffRoster,
  type Store,
  type Territory,
  type TerritoryState,
  type TimelineEvent,
} from './types';

const delay = (ms = 180) => new Promise<void>((r) => setTimeout(r, ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const SENT = { '+': 'helped', '-': 'hurt', '!': 'missing' } as const;

export function toReasons(appId: string, tuples: ReasonTuple[]): Reason[] {
  const seen: Record<string, number> = {};
  return tuples.map(([s, label, topic]) => {
    const n = (seen[topic] = (seen[topic] ?? 0) + 1);
    return { id: `${appId}:${topic}:${n}`, label, sentiment: SENT[s], topic };
  });
}

/* ------------------------------------------------------------------ */
/* Builders: fixture -> Decision                                       */
/* ------------------------------------------------------------------ */

function buildOnboarding(fx: DecisionFixture): OnboardingPlan | null {
  if (!fx.onboarding) return null;
  const { step, start, risk } = fx.onboarding;
  const currentIdx = ONBOARDING_STEPS.indexOf(step);
  const isOpen = step === 'Open';
  // PHASE-2: real logic goes here — read training completion from the LMS.
  const trainingIdx = ONBOARDING_STEPS.indexOf('Training');
  const training = TRAINING_MODULES.map((m, i) => ({
    ...m,
    progress: currentIdx > trainingIdx ? 1 : currentIdx === trainingIdx ? (i < 2 ? 1 : i < 4 ? 0.5 : 0) : 0,
  }));
  return {
    current: step,
    training,
    startDate: start,
    targetOpen: plusDays(start, STEP_OFFSETS.Open),
    atRisk: !!risk,
    riskNote: risk,
    steps: ONBOARDING_STEPS.map((s, i) => ({
      step: s,
      targetDate: plusDays(start, STEP_OFFSETS[s]),
      state: isOpen || i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'upcoming',
    })),
  };
}

function buildNextSteps(appId: string, fx: DecisionFixture, plan: OnboardingPlan | null): NextStep[] {
  if (fx.next) {
    return fx.next.map(([label, owner, due, done], i) => ({ id: `${appId}-n${i}`, label, owner, dueDate: fromToday(due), done: !!done }));
  }
  // PHASE-2: real logic goes here (next-best-action). Templates by status for now.
  if (plan) {
    return plan.steps
      .filter((s) => s.state !== 'done')
      .slice(0, 3)
      .map((s, i) => ({ id: `${appId}-n${i}`, label: s.step === 'Open' ? 'Open the store' : `Finish ${s.step.toLowerCase()}`, owner: STEP_OWNER[s.step], dueDate: s.targetDate, done: false }))
      .concat(plan.current === 'Open' ? [{ id: `${appId}-n9`, label: '30-day store review', owner: 'Expansion team', dueDate: fromToday(20), done: false }] : []);
  }
  switch (fx.status) {
    case 'Waitlisted':
      return [
        { id: `${appId}-n0`, label: 'Notify: on waitlist', owner: 'Expansion team', dueDate: fromToday(2), done: true },
        { id: `${appId}-n1`, label: 'Offer alternate PIN / territory', owner: 'Expansion team', dueDate: fromToday(14), done: false },
        { id: `${appId}-n2`, label: 'Re-check when a slot opens', owner: 'Expansion team', dueDate: fromToday(30), done: false },
      ];
    case 'Rejected':
      return [{ id: `${appId}-n0`, label: 'Send decline note with reason', owner: 'Expansion team', dueDate: fromToday(1), done: false }];
    default:
      return [{ id: `${appId}-n0`, label: 'Follow up with applicant', owner: 'Expansion team', dueDate: fromToday(5), done: false }];
  }
}

function buildTimeline(app: Application, fx: DecisionFixture, plan: OnboardingPlan | null): TimelineEvent[] {
  const ev: TimelineEvent[] = [{ date: app.submittedAt, label: 'Application received', kind: 'received' }];
  if (fx.status === 'Needs info') {
    ev.push({ date: plusDays(app.submittedAt, 1), label: 'Info requested from partner', kind: 'info' });
  } else {
    ev.push({ date: plusDays(app.submittedAt, 2), label: 'Screened', kind: 'screened' });
    ev.push({ date: plusDays(app.submittedAt, 5), label: `Decision: ${fx.status}`, kind: 'decision' });
  }
  if (plan) {
    ev.push({ date: plan.startDate, label: 'Onboarding started', kind: 'onboarding' });
    plan.steps.filter((s) => s.state === 'done').forEach((s) => ev.push({ date: s.targetDate, label: `${s.step} done`, kind: 'onboarding' }));
  }
  ev.push(...(fx.extraEvents ?? []));
  const today = iso(DEMO_TODAY);
  return ev.filter((e) => e.date <= today).sort((a, b) => b.date.localeCompare(a.date));
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

interface AppliedScenario {
  result: ScenarioResult;
  backupFx: Record<string, DecisionFixture>;
  backupApps: Record<string, Application>;
}

class MockEngine implements DecisionEngine {
  private applications: Application[] = clone(appFixtures);
  private territories: Territory[] = clone(territoryFixtures);
  private stores: Store[] = clone(storeFixtures);
  private fixtures: Record<string, DecisionFixture> = clone(decisionFixtures);
  private applied = new Map<string, AppliedScenario>();
  private source: Dataset['source'] = 'sample';
  private fileName: string | undefined;
  private loadedAt = new Date().toISOString();
  private scenarioSeq = 0;

  async loadDataset(source: 'sample' | File): Promise<Dataset> {
    await delay(300);
    // PHASE-2: real logic goes here — parse the uploaded workbook into Application/Territory rows.
    // In Phase 1 an upload always resolves to the sample fixtures.
    this.source = source === 'sample' ? 'sample' : 'upload';
    this.fileName = source === 'sample' ? undefined : source.name;
    this.loadedAt = new Date().toISOString();
    return this.getDatasetSync();
  }

  private getDatasetSync(): Dataset {
    return {
      source: this.source,
      fileName: this.fileName,
      applications: clone(this.applications),
      territories: clone(this.territories),
      stores: clone(this.stores),
      cities: (Object.keys(cityCentres) as Array<keyof typeof cityCentres>).map((city) => ({ city, ...cityCentres[city] })),
      loadedAt: this.loadedAt,
    };
  }

  async getDataset() {
    await delay(120);
    return this.getDatasetSync();
  }

  private territoryOf(pin: string): Territory | undefined {
    return this.territories.find((t) => t.pins.includes(pin));
  }

  private decisionsSync(): Decision[] {
    return this.applications.map((app) => {
      const fx = this.fixtures[app.id];
      const plan = buildOnboarding(fx);
      return {
        applicationId: app.id,
        status: fx.status,
        stage: fx.stage,
        confidence: fx.conf,
        summary: fx.summary,
        reasons: toReasons(app.id, fx.reasons),
        territoryId: this.territoryOf(app.pin)?.id ?? null,
        attention: fx.attention ?? (plan?.atRisk ? 'Onboarding at risk' : null),
        attentionPriority: fx.attention ? (fx.attentionOrder ?? 50) : plan?.atRisk ? 50 : null,
        dropReason: fx.dropReason ?? null,
        nextSteps: buildNextSteps(app.id, fx, plan),
        onboarding: plan,
        dataFlags: [...dataFlagsFor(app, this.territories, this.stores), ...(fx.extraFlags ?? [])],
        daysInStage: fx.days,
        timeline: buildTimeline(app, fx, plan),
        territoryRank: fx.rank,
      };
    });
  }

  /** Attention ordering is fixture data (attentionOrder). */
  attentionOrder(appId: string): number {
    return this.fixtures[appId]?.attentionOrder ?? 99;
  }

  async getDecisions() {
    await delay(160);
    return this.decisionsSync();
  }

  async explain(applicationId: string): Promise<Explanation> {
    await delay(140);
    const d = this.decisionsSync().find((x) => x.applicationId === applicationId);
    const app = this.applications.find((a) => a.id === applicationId);
    if (!d || !app) throw new Error(`Unknown application ${applicationId}`);
    const helped = d.reasons.filter((r) => r.sentiment === 'helped').map((r) => r.label);
    const hurt = d.reasons.filter((r) => r.sentiment === 'hurt').map((r) => r.label);
    const missing = d.reasons.filter((r) => r.sentiment === 'missing').map((r) => r.label);
    const t = d.territoryId ? this.territories.find((x) => x.id === d.territoryId) : undefined;
    // PHASE-2: real logic goes here — long-form explanation from the real engine / LLM.
    const fullReasoning = [
      `Outcome: ${d.status}. ${d.summary}`,
      helped.length ? `Worked in favour: ${helped.join(', ')}.` : 'Nothing stood out in favour.',
      hurt.length ? `Held it back: ${hurt.join(', ')}.` : 'No hard blockers.',
      missing.length ? `Still to confirm: ${missing.join(', ')}.` : 'All required info is in.',
      t
        ? `Territory ${t.id} (${t.name}) is ${t.priority.toLowerCase()} priority with ${t.openSlots} slot${t.openSlots === 1 ? '' : 's'}; this applicant is ${d.territoryRank ? `#${d.territoryRank} in line` : 'not ranked'}.`
        : `PIN ${app.pin} is outside every growth territory.`,
      'One store per PIN is enforced: a PIN with an existing or planned store is locked.',
    ];
    const competitors = d.territoryId
      ? this.decisionsSync()
          .filter((x) => x.territoryId === d.territoryId && x.applicationId !== applicationId)
          .map((x) => {
            const a = this.applications.find((y) => y.id === x.applicationId)!;
            return { applicationId: x.applicationId, name: a.name, status: x.status, rank: x.territoryRank, investmentLakh: a.investmentLakh };
          })
          .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      : [];
    return { applicationId, status: d.status, summary: d.summary, reasons: d.reasons, fullReasoning, competitors };
  }

  // PHASE-2: real logic goes here — territory fill comes from the real allocation, not fixture statuses.
  private territoryStatesSync(): TerritoryState[] {
    const decisions = this.decisionsSync();
    return this.territories.map((t) => {
      const inT = decisions.filter((d) => d.territoryId === t.id);
      const approved = inT.filter((d) => d.status === 'Approved');
      const months = ['2026-07', '2026-08', '2026-09', '2026-10'];
      const fillHistory = months.map((m) => ({
        month: m,
        filled: approved.filter((d) => (d.onboarding?.startDate ?? '9999').slice(0, 7) <= m).length,
      }));
      return {
        territoryId: t.id,
        openSlots: t.openSlots,
        filled: approved.length,
        applicants: inT.length,
        competingIds: [...inT].sort((a, b) => (a.territoryRank ?? 99) - (b.territoryRank ?? 99)).map((d) => d.applicationId),
        oversubscribed: inT.filter((d) => d.status !== 'Rejected').length > t.openSlots,
        fillHistory,
      };
    });
  }

  async getTerritoryState() {
    await delay(140);
    return this.territoryStatesSync();
  }

  // PHASE-2: real logic goes here — PIN states (incl. "too close to a store" conflicts) from the real engine.
  private pinStatesSync(): PinState[] {
    const decisions = this.decisionsSync();
    const tStates = this.territoryStatesSync();
    const allPins = new Set<string>([
      ...this.territories.flatMap((t) => t.pins),
      ...this.stores.map((s) => s.pin),
      ...this.applications.map((a) => a.pin),
    ]);
    return [...allPins].map((pin) => {
      const meta = pincodes.find((p) => p.pin === pin);
      const t = this.territoryOf(pin);
      const store = this.stores.find((s) => s.pin === pin);
      const apps = this.applications.filter((a) => a.pin === pin);
      const live = apps.filter((a) => {
        const s = this.fixtures[a.id].status;
        return s !== 'Rejected';
      });
      const allocated = apps.find((a) => this.fixtures[a.id].status === 'Approved');
      const ts = t ? tStates.find((x) => x.territoryId === t.id) : undefined;
      let status: PinState['status'];
      let note: string | null = null;
      // The one hard rule: a PIN with a store (existing or planned) is locked.
      if (store) {
        status = 'store';
        note = 'Store already here — one store per PIN.';
      } else if (allocated) {
        status = 'allocated';
        note = `Planned for ${allocated.id} — one store per PIN.`;
      } else if (!t) {
        status = 'outside';
        note = apps.length ? `${apps.length} applicant${apps.length > 1 ? 's' : ''}, no territory` : null;
      } else if (live.length >= 2) {
        status = 'conflict';
        note = `${live.length} applicants, 1 PIN`;
      } else if (live.length === 1) {
        status = 'interest';
      } else if (ts && ts.filled < ts.openSlots) {
        status = 'open';
      } else {
        status = 'full';
        note = `No slot left in ${t.id}`;
      }
      if (decisions.length === 0) note = null;
      return {
        pin,
        city: meta?.city ?? t?.city ?? store?.city ?? apps[0]?.city ?? 'Bengaluru',
        area: meta?.area ?? '—',
        lat: meta?.lat ?? 0,
        lng: meta?.lng ?? 0,
        territoryId: t?.id ?? null,
        status,
        storeId: store?.id ?? null,
        allocatedTo: allocated?.id ?? null,
        applicantIds: apps.map((a) => a.id),
        locked: status === 'store' || status === 'allocated',
        note,
      };
    });
  }

  async getPinStates() {
    await delay(140);
    return this.pinStatesSync();
  }

  /* -------------------------- Ask -------------------------- */

  async ask(question: string): Promise<AskResponse> {
    await delay(450);
    // PHASE-2: real logic goes here — natural-language Q&A (LLM over engine output).
    const q = question.trim();
    const appMatch = q.match(/APP[-\s]?(\d{1,3})/i);
    const terMatch = q.match(/TER[-\s]?(\d{1,2})/i);
    const decisions = this.decisionsSync();

    if (appMatch && /what if|found|finds|now has|gets|moves|switch/i.test(q)) {
      const id = `APP-${appMatch[1].padStart(3, '0')}`;
      const scen = cannedScenarios.find((s) => s.applicationId === id);
      if (scen) {
        const r = await this.simulate({ applicationId: id, ...scen.preset });
        return {
          kind: 'whatif', applicationId: id, status: r.after.status,
          reasons: r.after.reasons.filter((x) => r.flipped.includes(x.id)).slice(0, 3),
          sentence: r.sentence,
        };
      }
    }
    if (appMatch) {
      const id = `APP-${appMatch[1].padStart(3, '0')}`;
      const d = decisions.find((x) => x.applicationId === id);
      if (d) {
        const ordered = [...d.reasons].sort((a, b) => rankSent(a) - rankSent(b));
        return { kind: 'decision', applicationId: id, status: d.status, reasons: ordered.slice(0, 3), sentence: d.summary };
      }
    }
    if (terMatch) {
      const id = `TER-${terMatch[1].padStart(2, '0')}`;
      const t = this.territories.find((x) => x.id === id);
      const ts = this.territoryStatesSync().find((x) => x.territoryId === id);
      if (t && ts) {
        const ranked = ts.competingIds.map((aid) => ({
          applicationId: aid,
          name: this.applications.find((a) => a.id === aid)!.name,
          status: decisions.find((d) => d.applicationId === aid)!.status,
        }));
        return {
          kind: 'territory', territoryId: id, reasons: [],
          sentence: ts.applicants
            ? `${ts.applicants} applicants for ${ts.openSlots} slot${ts.openSlots === 1 ? '' : 's'}; ${ts.filled} filled.`
            : `No applicants yet for ${ts.openSlots} open slot${ts.openSlots === 1 ? '' : 's'}.`,
          ranked,
        };
      }
    }
    return {
      kind: 'fallback', reasons: [],
      sentence: 'Try an application or territory ID — the demo answers those.',
      suggestions: ['Why is APP-007 on hold?', 'Who is competing for TER-02?', 'What if APP-012 finds a ground-floor space?'],
    };
  }

  /* -------------------------- What-if -------------------------- */

  async simulate(change: ScenarioChange): Promise<ScenarioResult> {
    await delay(650);
    const app = this.applications.find((a) => a.id === change.applicationId);
    if (!app) throw new Error(`Unknown application ${change.applicationId}`);
    const fx = this.fixtures[app.id];
    const before = { status: fx.status, reasons: toReasons(app.id, fx.reasons), confidence: fx.conf };
    const scen = cannedScenarios.find((s) => s.applicationId === app.id && s.matches(change, app));
    const id = `SIM-${String(++this.scenarioSeq).padStart(3, '0')}`;
    if (!scen) {
      // PHASE-2: real logic goes here — re-score any change. The demo only has canned outcomes.
      return {
        id, change, canned: false, before, after: before, flipped: [], ripples: [],
        sentence: 'No change to the decision for this edit in the demo data.',
      };
    }
    const afterReasons = toReasons(app.id, scen.after.reasons);
    const beforeMap = new Map(before.reasons.map((r) => [r.id, r]));
    const flipped = afterReasons.filter((r) => beforeMap.get(r.id)?.sentiment !== r.sentiment || beforeMap.get(r.id)?.label !== r.label).map((r) => r.id);
    return {
      id, change, canned: true, before,
      after: { status: scen.after.status, reasons: afterReasons, confidence: scen.after.conf },
      flipped, ripples: scen.ripples, sentence: scen.sentence,
    };
  }

  /* -------------------------- Partner portal -------------------------- */

  private threads = new Map<string, ChatMessage[]>();

  async getPartnerProfile(applicationId: string): Promise<PartnerProfile> {
    await delay(120);
    const app = this.applications.find((a) => a.id === applicationId);
    if (!app) throw new Error(`Unknown application ${applicationId}`);
    const fx = this.fixtures[applicationId];
    const territory = this.territoryOf(app.pin);
    const manager = (territory && managersByTerritory[territory.id]) || managersByCity[app.city];
    const tier = territory?.tier ?? (app.city === 'Bengaluru' ? 'Tier 1' : app.city === 'Tumakuru' || app.city === 'Davanagere' ? 'Tier 3' : 'Tier 2');
    // PHASE-2: real logic goes here — payback from the real P&L model.
    const e = economicsByTier[tier];
    const profit = e.monthlySalesLakh * e.grossMargin - e.monthlyCostsLakh;
    if (!this.threads.has(applicationId)) {
      const first = app.name.split(' ')[0];
      const plan = buildOnboarding(fx);
      const t0 = `${iso(DEMO_TODAY)}T09:15:00`;
      this.threads.set(applicationId, [
        { id: 'm1', from: 'brand', at: `${plan?.startDate ?? app.submittedAt}T10:00:00`, text: `Hi ${first}, I'm ${manager.name}, your relationship manager at Bunty. I'll be with you all the way to opening day.` },
        {
          id: 'm2',
          from: 'brand',
          at: t0,
          text: plan
            ? plan.current === 'Open'
              ? 'Congratulations on opening! Your 30-day review is on the calendar; ping me with anything.'
              : `You're at the ${plan.current} stage. Target opening is ${plan.targetOpen.split('-').reverse().slice(0, 2).join('/')}. Tell me if anything is blocking you.`
            : `Thanks for applying. ${fx.summary} Reply here if you have questions.`,
        },
      ]);
    }
    return {
      applicationId,
      manager,
      economics: {
        investmentLakh: app.investmentLakh,
        monthlySalesLakh: e.monthlySalesLakh,
        grossMargin: e.grossMargin,
        monthlyCostsLakh: e.monthlyCostsLakh,
        paybackMonths: profit > 0 ? Math.ceil(app.investmentLakh / profit) : Infinity,
        basis: `similar ${tier} stores`,
      },
      messages: clone(this.threads.get(applicationId)!),
    };
  }

  async sendPartnerMessage(applicationId: string, text: string): Promise<ChatMessage> {
    const thread = this.threads.get(applicationId) ?? [];
    const now = new Date().toISOString();
    thread.push({ id: `p${thread.length + 1}`, from: 'partner', text, at: now });
    await delay(900);
    // PHASE-2: real logic goes here — real messaging between partner and brand.
    const reply = cannedReplies.find((r) => r.keys.test(text))?.reply ?? defaultReply;
    const msg: ChatMessage = { id: `b${thread.length + 1}`, from: 'brand', text: reply, at: new Date().toISOString() };
    thread.push(msg);
    this.threads.set(applicationId, thread);
    return msg;
  }

  /* -------------------------- Staff training -------------------------- */

  private rosters = new Map<string, StaffMember[]>();

  private score(staffId: string, moduleId: string) {
    // Deterministic demo quiz score, 74–97.
    const h = [...`${staffId}${moduleId}`].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 997, 7);
    return 74 + (h % 24);
  }

  private certify(m: StaffMember): StaffMember {
    const passed = m.modules.length > 0 && m.modules.every((x) => x.progress >= 1 && (x.quizScore ?? 0) >= STAFF_PASS_MARK);
    const last = m.modules.map((x) => x.completedAt ?? '').sort().pop() || iso(DEMO_TODAY);
    return { ...m, certifiedAt: passed ? m.certifiedAt ?? last : null };
  }

  private newMember(appId: string, n: number, name: string, role: StaffRole, language: Language, joinedAt: string): StaffMember {
    const id = `${appId}-ST${n}`;
    return {
      id, name, role, language, joinedAt, certifiedAt: null,
      modules: staffCatalog.filter((c) => c.forRoles.includes(role)).map((c) => ({ moduleId: c.id, assignedAt: joinedAt, progress: 0, quizScore: null, completedAt: null })),
    };
  }

  private roster(appId: string): StaffMember[] {
    if (this.rosters.has(appId)) return this.rosters.get(appId)!;
    const app = this.applications.find((a) => a.id === appId);
    const plan = app ? buildOnboarding(this.fixtures[appId]) : null;
    let members: StaffMember[] = [];
    if (app && plan) {
      // PHASE-2: real logic goes here — staff come from the partner / LMS, not a seed.
      const stage = ONBOARDING_STEPS.indexOf(plan.current);
      const training = ONBOARDING_STEPS.indexOf('Training');
      const names = seedStaffNames[app.language].slice(0, stage < training ? 1 : 3);
      members = names.map(([name, role], i) => {
        const m = this.newMember(appId, i + 1, name, role, app.language, plan.startDate);
        const doneShare = stage > training ? 1 : stage === training ? [1, 0.5, 0.34][i] : 0.34;
        const nDone = Math.round(m.modules.length * doneShare);
        m.modules = m.modules.map((x, k) =>
          k < nDone
            ? { ...x, progress: 1, quizScore: this.score(m.id, x.moduleId), completedAt: plusDays(plan.startDate, 40 + k * 3) }
            : k === nDone && stage >= training
              ? { ...x, progress: 0.5 }
              : x,
        );
        return this.certify(m);
      });
    }
    this.rosters.set(appId, members);
    return members;
  }

  private rosterOut(appId: string): StaffRoster {
    return { applicationId: appId, catalog: staffCatalog, passMark: STAFF_PASS_MARK, members: clone(this.roster(appId)) };
  }

  async getStaff(applicationId: string) {
    await delay(120);
    return this.rosterOut(applicationId);
  }

  async addStaff(applicationId: string, s: { name: string; role: StaffRole; language: Language }) {
    await delay(200);
    const list = this.roster(applicationId);
    list.push(this.newMember(applicationId, list.length + 1 + Math.floor(Math.random() * 1000), s.name.trim(), s.role, s.language, iso(DEMO_TODAY)));
    return this.rosterOut(applicationId);
  }

  async assignStaffModule(applicationId: string, staffId: string, moduleId: string) {
    await delay(150);
    const list = this.roster(applicationId);
    const i = list.findIndex((m) => m.id === staffId);
    if (i >= 0 && !list[i].modules.some((x) => x.moduleId === moduleId)) {
      list[i] = this.certify({
        ...list[i],
        certifiedAt: null,
        modules: [...list[i].modules, { moduleId, assignedAt: iso(DEMO_TODAY), progress: 0, quizScore: null, completedAt: null }],
      });
    }
    return this.rosterOut(applicationId);
  }

  async completeStaffModule(applicationId: string, staffId: string, moduleId: string) {
    await delay(350);
    const list = this.roster(applicationId);
    const i = list.findIndex((m) => m.id === staffId);
    if (i >= 0) {
      list[i] = this.certify({
        ...list[i],
        modules: list[i].modules.map((x) =>
          x.moduleId === moduleId ? { ...x, progress: 1, quizScore: this.score(staffId, moduleId), completedAt: iso(DEMO_TODAY) } : x,
        ),
      });
    }
    return this.rosterOut(applicationId);
  }

  async removeStaff(applicationId: string, staffId: string) {
    await delay(120);
    this.rosters.set(applicationId, this.roster(applicationId).filter((m) => m.id !== staffId));
    return this.rosterOut(applicationId);
  }

  async getScenarioPresets(): Promise<ScenarioPreset[]> {
    await delay(80);
    return cannedScenarios.map((s) => ({ applicationId: s.applicationId, title: s.title, change: { applicationId: s.applicationId, ...s.preset } }));
  }

  async applyScenario(result: ScenarioResult) {
    await delay(200);
    const app = this.applications.find((a) => a.id === result.change.applicationId);
    const scen = app && cannedScenarios.find((s) => s.applicationId === app.id && s.matches(result.change, app));
    if (!app || !scen) return;
    const ids = [app.id, ...scen.effects.map((e) => e.applicationId)];
    const backupFx: Record<string, DecisionFixture> = {};
    const backupApps: Record<string, Application> = {};
    ids.forEach((i) => {
      backupFx[i] = clone(this.fixtures[i]);
      backupApps[i] = clone(this.applications.find((a) => a.id === i)!);
    });
    const today = iso(DEMO_TODAY);
    Object.assign(app, scen.appPatch(result.change));
    this.fixtures[app.id] = {
      ...this.fixtures[app.id], ...scen.after, days: 0,
      attention: undefined, attentionOrder: undefined,
      extraEvents: [...(this.fixtures[app.id].extraEvents ?? []), { date: today, label: `What-if applied: ${backupFx[app.id].status} → ${scen.after.status}`, kind: 'decision' }],
    };
    for (const e of scen.effects) {
      const prev = this.fixtures[e.applicationId];
      this.fixtures[e.applicationId] = {
        ...prev, ...e.fixture, attention: undefined, attentionOrder: undefined,
        extraEvents: [...(prev.extraEvents ?? []), { date: today, label: `Ripple from ${app.id}: ${prev.status} → ${e.fixture.status}`, kind: 'decision' }],
      };
    }
    this.applied.set(result.id, { result, backupFx, backupApps });
  }

  async revertScenario(scenarioId: string) {
    await delay(150);
    const a = this.applied.get(scenarioId);
    if (!a) return;
    Object.entries(a.backupFx).forEach(([id, fx]) => (this.fixtures[id] = fx));
    Object.entries(a.backupApps).forEach(([id, app]) => {
      const idx = this.applications.findIndex((x) => x.id === id);
      this.applications[idx] = app;
    });
    this.applied.delete(scenarioId);
  }

  async reset() {
    await delay(100);
    this.applications = clone(appFixtures);
    this.territories = clone(territoryFixtures);
    this.stores = clone(storeFixtures);
    this.fixtures = clone(decisionFixtures);
    this.applied.clear();
    this.threads.clear();
    this.rosters.clear();
    this.source = 'sample';
    this.fileName = undefined;
  }
}

const rankSent = (r: Reason) => (r.sentiment === 'hurt' ? 0 : r.sentiment === 'missing' ? 1 : 2);

export const mockEngine = new MockEngine();
export type { MockEngine };
