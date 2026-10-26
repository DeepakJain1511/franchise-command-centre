import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ExternalLink, FlaskConical, Map as MapIcon, MessageSquareText, SendHorizontal, Sparkles, Undo2, Waves } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReasonChip, StatusChip } from '@/components/chips';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/controls';
import { useApplicants, useAsk, useEngineActions, usePipeline } from '@/engine/hooks';
import type { AppField } from '@/engine/model';
import type { AskResponse, Change, DecisionStatus } from '@/engine/types';
import { cn } from '@/lib/cn';
import { useAppDrawer } from '@/lib/hooks';
import { useUi } from '@/store/ui';

interface Msg {
  id: number;
  q: string;
  a: AskResponse | null;
  undone?: boolean;
}

const statusVerb = (s: DecisionStatus) =>
  s === 'Approved' ? 'approved' : s === 'Rejected' ? 'rejected' : s === 'Waitlisted' ? 'waitlisted' : s === 'On hold' ? 'on hold' : 'waiting on info';

export function AskPanel({ about, onTryWhatIf }: { about: string | null; onTryWhatIf: (appId: string, autorun: boolean) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const ask = useAsk();
  const act = useEngineActions();
  const apps = useApplicants();
  const pipe = usePipeline();
  const navigate = useNavigate();
  const toast = useUi((s) => s.toast);
  const { openApp } = useAppDrawer();
  const listRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const aboutRow = about ? apps.data?.find((r) => r.app.id === about) : undefined;
  const rows = apps.data ?? [];
  const hold = rows.find((r) => r.decision.status === 'On hold' || r.decision.status === 'Needs info');
  const noSpace = rows.find((r) => r.decision.result.flags.some((f) => f.code === 'F_NO_SPACE') && r.decision.status !== 'Rejected');
  const busiest = [...(pipe.data?.territories ?? [])].sort((a, b) => b.applicants.length - a.applicants.length)[0];
  const suggestions = aboutRow
    ? [
        `Why is ${aboutRow.app.id} ${statusVerb(aboutRow.decision.status)}?`,
        `What should ${aboutRow.app.id} do next?`,
        `What if ${aboutRow.app.id} finds a 450 sq ft ground-floor space?`,
        ...(aboutRow.decision.territoryId ? [`Who is competing for ${aboutRow.decision.territoryId}?`] : []),
      ]
    : [
        ...(hold ? [`Why is ${hold.app.id} ${statusVerb(hold.decision.status)}?`] : []),
        ...(noSpace ? [`${noSpace.app.id} has now found a ground-floor space`] : []),
        ...(busiest ? [`Who is competing for ${busiest.id}?`] : []),
        'How many applications are approved?',
      ];

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || ask.loading) return;
    const id = ++seq.current;
    setMsgs((m) => [...m, { id, q: question, a: null }]);
    setText('');
    const a = await ask.run(question);
    setMsgs((m) => m.map((x) => (x.id === id ? { ...x, a } : x)));
  };

  const undo = async (m: Msg) => {
    if (!m.a?.overrideIds?.length) return;
    const diff = await act.removeOverrides(m.a.overrideIds);
    setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, undone: true } : x)));
    toast(`Undone${diff.length ? ` — ${diff.length} applicant${diff.length > 1 ? 's' : ''} back` : ''}`, 'success');
  };

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  const nameOf = (id?: string) => apps.data?.find((r) => r.app.id === id)?.app.name;

  return (
    <section className="card flex min-h-[520px] flex-col lg:h-[calc(100vh-190px)]" aria-label="Ask">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <MessageSquareText className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold">Ask or tell</h2>
        {aboutRow && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-2xs font-medium text-brand tnum">About {aboutRow.app.id}</span>}
        <span className="ml-auto text-2xs text-subtle">Updates re-run every decision · Undo anytime</span>
      </header>

      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin" aria-live="polite">
        {msgs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="text-sm text-muted">Ask why — or tell me what changed.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {msgs.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-2">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-sm text-brand-fg">{m.q}</div>
              {!m.a ? (
                <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-raised px-3.5 py-3" aria-label="Thinking">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-subtle" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                </div>
              ) : (
                <Answer
                  a={m.a}
                  undone={!!m.undone}
                  name={nameOf(m.a.applicationId)}
                  onOpen={openApp}
                  onTry={onTryWhatIf}
                  onMap={(t) => navigate(`/map?territory=${t}`)}
                  onSuggest={send}
                  onUndo={() => undo(m)}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="space-y-2 border-t p-3">
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              disabled={ask.loading}
              className="rounded-full border bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:border-brand/40 hover:text-fg focus-ring disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
          className="flex items-center gap-2"
        >
          <label className="sr-only" htmlFor="ask-input">
            Ask a question or give an update
          </label>
          <input
            id="ask-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={aboutRow ? `Ask or update ${aboutRow.app.id}…` : suggestions[0] ?? 'Why is APP-007 on hold?'}
            className="h-10 flex-1 rounded-md border bg-surface px-3 text-sm shadow-soft placeholder:text-subtle focus-ring"
          />
          <Button type="submit" variant="primary" size="icon" disabled={!text.trim() || ask.loading} aria-label="Send">
            <SendHorizontal />
          </Button>
        </form>
      </div>
    </section>
  );
}

function Lines({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="label mb-1">{title}</div>
      <ul className="space-y-0.5 text-sm text-muted">
        {items.map((x, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-subtle" aria-hidden />
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiffList({ a, onOpen }: { a: AskResponse; onOpen: (id: string) => void }) {
  if (!a.diff) return null;
  if (!a.diff.length) return <p className="text-xs text-muted">No decision changed.</p>;
  return (
    <div>
      <div className="label mb-1 flex items-center gap-1.5">
        <Waves className="h-3 w-3" /> {a.diff.length} applicant{a.diff.length > 1 ? 's' : ''} changed
      </div>
      <ul className="divide-y rounded-md border">
        {a.diff.map((d) => (
          <li key={d.id} className="px-2.5 py-1.5 text-xs">
            <button type="button" onClick={() => onOpen(d.id)} className="font-medium text-brand hover:underline focus-ring tnum">
              {d.id}
            </button>{' '}
            <span className="text-muted">{d.name}</span>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {d.changes.map((c, i) => (
                <span key={i} className="tnum">
                  <span className="text-subtle">{c.what}:</span> {c.before} <ArrowRight className="inline h-3 w-3 text-subtle" /> <span className="font-semibold">{c.after}</span>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Answer({ a, name, undone, onOpen, onTry, onMap, onSuggest, onUndo }: {
  a: AskResponse;
  name?: string;
  undone: boolean;
  onOpen: (id: string) => void;
  onTry: (id: string, autorun: boolean) => void;
  onMap: (t: string) => void;
  onSuggest: (q: string) => void;
  onUndo: () => void;
}) {
  const isDecision = a.kind === 'decision' || a.kind === 'next' || a.kind === 'whatif' || a.kind === 'update';
  return (
    <div className="max-w-[94%] space-y-2.5 rounded-2xl rounded-bl-md border bg-surface p-3.5 shadow-soft">
      {a.understood && (
        <div className={cn('rounded-md px-2.5 py-1.5 text-xs', a.kind === 'update' ? 'bg-st-approved/10 text-st-approved' : 'bg-raised text-muted')}>
          <span className="font-medium">{a.kind === 'whatif' ? 'Preview (not saved) — ' : ''}{a.understood}</span>
          {a.assumptions?.map((x) => (
            <div key={x} className="mt-0.5 text-muted">Assumed: {x}</div>
          ))}
          {a.source === 'gemini' && <div className="mt-0.5 flex items-center gap-1 text-muted"><Sparkles className="h-3 w-3" /> Read with Gemini — please check this line. The decision is by the rules.</div>}
        </div>
      )}
      {isDecision && a.applicationId && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-2xs text-subtle tnum">{a.applicationId}</span>
            {a.kind === 'whatif' && <span className="rounded-full bg-raised px-1.5 py-0.5 text-2xs text-muted">would become</span>}
            {a.status && <StatusChip status={a.status} />}
          </div>
          <p className="text-sm">{a.sentence}</p>
          <div className="flex flex-wrap gap-1.5">
            {a.reasons.map((r) => (
              <ReasonChip key={r.id} reason={r} />
            ))}
          </div>
          <Lines title="Why" items={a.why} />
          <Lines title="What next" items={a.next} />
        </>
      )}
      {(a.kind === 'update' || a.kind === 'whatif') && !a.applicationId && <p className="text-sm">{a.sentence}</p>}
      {(a.kind === 'update' || a.kind === 'whatif') && <DiffList a={a} onOpen={onOpen} />}
      {isDecision && a.applicationId && (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => onOpen(a.applicationId!)}>
            <ExternalLink /> Open applicant
          </Button>
          {a.kind !== 'update' && (
            <Button size="sm" variant="secondary" onClick={() => onTry(a.applicationId!, false)}>
              <FlaskConical /> Try a what-if
            </Button>
          )}
          {a.kind === 'update' && a.overrideIds?.length ? (
            undone ? (
              <span className="self-center text-xs text-muted">Undone</span>
            ) : (
              <Button size="sm" variant="secondary" onClick={onUndo}>
                <Undo2 /> Undo
              </Button>
            )
          ) : null}
        </div>
      )}
      {a.kind === 'compare' && a.compare && (
        <>
          <p className="text-sm">{a.sentence}</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-raised/60 text-left text-subtle">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Applicant</th>
                  {['Money', 'Space', 'Exp', 'Bkgd', 'Time', 'Store', 'Total', 'Bar'].map((h) => (
                    <th key={h} className="px-2 py-1.5 text-right font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.compare.map((c) => (
                  <tr key={c.applicationId} className="border-t">
                    <td className="px-2 py-1.5">
                      <button type="button" onClick={() => onOpen(c.applicationId)} className="font-medium hover:underline focus-ring">{c.name}</button>
                      <div className="text-2xs text-subtle">{c.outcome}</div>
                    </td>
                    {c.factors.map((f, i) => (
                      <td key={i} className="px-2 py-1.5 text-right tnum">{f}</td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-semibold tnum">{c.score}</td>
                    <td className="px-2 py-1.5 text-right tnum text-muted">{c.bar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Lines title="Why" items={a.why} />
        </>
      )}
      {a.kind === 'territory' && a.territoryId && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tnum">{a.territoryId}</span>
            <span className="text-xs text-muted">{a.sentence}</span>
          </div>
          <ol className="space-y-1">
            {(a.ranked ?? []).slice(0, 8).map((r, i) => (
              <li key={r.applicationId}>
                <button type="button" onClick={() => onOpen(r.applicationId)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-raised focus-ring">
                  <span className="w-4 text-xs text-subtle tnum">{i + 1}</span>
                  <span className="flex-1 truncate">{r.name}</span>
                  {r.note && <span className="hidden text-2xs text-subtle tnum sm:inline">{r.note}</span>}
                  <StatusChip status={r.status} size="sm" />
                </button>
              </li>
            ))}
          </ol>
          <Lines title="Note" items={a.why} />
          <Button size="sm" variant="secondary" onClick={() => onMap(a.territoryId!)}>
            <MapIcon /> Open on map
          </Button>
        </>
      )}
      {a.kind === 'summary' && (
        <>
          <p className="text-sm">{a.sentence}</p>
          <div className="flex flex-wrap gap-1.5">
            {(a.counts ?? []).map((c) => (
              <span key={c.label} className="rounded-md border px-2 py-1 text-xs">
                <span className="font-semibold tnum">{c.value}</span> <span className="text-muted">{c.label}</span>
              </span>
            ))}
          </div>
          <Lines title="Also" items={a.why} />
        </>
      )}
      {a.kind === 'fallback' && (
        <>
          <p className="text-sm text-muted">{a.sentence}</p>
          <div className="flex flex-wrap gap-1.5">
            {(a.suggestions ?? []).map((s) => (
              <button key={s} type="button" onClick={() => onSuggest(s)} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-raised focus-ring">
                {s} <ArrowRight className="h-3 w-3" />
              </button>
            ))}
          </div>
          <UpdateForm />
        </>
      )}
    </div>
  );
}

/* ---------------- Structured update form (spec §16: applicant → field → value) ---------------- */

type FormField = Extract<AppField, 'space' | 'spaceSqft' | 'floor' | 'pin' | 'investmentLakh' | 'experienceYears' | 'launchMonths' | 'language' | 'withdrawn' | 'locationConfirmed'>;
const FIELDS: Array<{ value: FormField; label: string; kind: 'num' | 'text' | 'choice'; choices?: string[] }> = [
  { value: 'space', label: 'Space available', kind: 'choice', choices: ['Owned', 'Rented', 'Not yet identified'] },
  { value: 'spaceSqft', label: 'Space size (sq ft)', kind: 'num' },
  { value: 'floor', label: 'Floor', kind: 'choice', choices: ['Ground', 'Upper', 'Mall unit', 'Not known'] },
  { value: 'pin', label: 'Pin code', kind: 'text' },
  { value: 'investmentLakh', label: 'Investment (₹ lakh)', kind: 'num' },
  { value: 'experienceYears', label: 'Experience (years)', kind: 'num' },
  { value: 'launchMonths', label: 'Target launch (months)', kind: 'num' },
  { value: 'language', label: 'Preferred language', kind: 'choice', choices: ['Kannada', 'English', 'Hindi'] },
  { value: 'locationConfirmed', label: 'Location confirmed', kind: 'choice', choices: ['Yes'] },
  { value: 'withdrawn', label: 'Withdraw application', kind: 'choice', choices: ['Yes'] },
];

function UpdateForm() {
  const apps = useApplicants();
  const act = useEngineActions();
  const toast = useUi((s) => s.toast);
  const [appId, setAppId] = useState<string>();
  const [field, setField] = useState<FormField>('space');
  const [value, setValue] = useState('');
  const meta = FIELDS.find((f) => f.value === field)!;
  const options = (apps.data ?? []).map((r) => ({ value: r.app.id, label: `${r.app.id} · ${r.app.name}` }));
  const submit = async () => {
    if (!appId || !value) return;
    const v: Change['value'] = meta.kind === 'num' ? Number(value) : field === 'withdrawn' || field === 'locationConfirmed' ? true : value;
    if (meta.kind === 'num' && !Number.isFinite(v)) return;
    const { diff } = await act.applyChanges([{ target: 'app', id: appId, field, value: v, label: `${meta.label.toLowerCase()} → ${value}` }]);
    toast(`Updated ${appId}${diff.length ? ` — ${diff.length} applicant${diff.length > 1 ? 's' : ''} changed` : ''}`, 'success');
    setValue('');
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-2 rounded-md border bg-raised/40 p-2.5"
      aria-label="Structured update"
    >
      <div className="label">Or update directly</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={appId} onChange={setAppId} options={options} placeholder="Applicant" ariaLabel="Applicant" />
        <Select value={field} onChange={(v) => (setField(v), setValue(''))} options={FIELDS.map((f) => ({ value: f.value, label: f.label }))} ariaLabel="Field" />
        {meta.kind === 'choice' ? (
          <Select value={value || undefined} onChange={setValue} options={meta.choices!.map((c) => ({ value: c, label: c }))} placeholder="Value" ariaLabel="Value" />
        ) : (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode={meta.kind === 'num' ? 'decimal' : 'text'}
            placeholder="Value"
            aria-label="Value"
            className="h-9 rounded-md border bg-surface px-2.5 text-sm focus-ring"
          />
        )}
      </div>
      <Button size="sm" variant="primary" type="submit" disabled={!appId || !value || act.busy}>
        Apply &amp; re-run
      </Button>
    </form>
  );
}
