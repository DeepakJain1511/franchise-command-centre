import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ExternalLink, FlaskConical, Map as MapIcon, MessageSquareText, SendHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReasonChip, StatusChip } from '@/components/chips';
import { Button } from '@/components/ui/button';
import { useApplicants, useAsk } from '@/engine/hooks';
import type { AskResponse, DecisionStatus } from '@/engine/types';
import { cn } from '@/lib/cn';
import { useAppDrawer } from '@/lib/hooks';

interface Msg {
  id: number;
  q: string;
  a: AskResponse | null;
}

const BASE_SUGGESTIONS = ['Why is APP-007 on hold?', 'Who is competing for TER-02?', 'What if APP-012 finds a ground-floor space?'];

const statusVerb = (s: DecisionStatus) =>
  s === 'Approved' ? 'approved' : s === 'Rejected' ? 'rejected' : s === 'Waitlisted' ? 'waitlisted' : s === 'On hold' ? 'on hold' : 'waiting on info';

export function AskPanel({ about, onTryWhatIf }: { about: string | null; onTryWhatIf: (appId: string, autorun: boolean) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const ask = useAsk();
  const apps = useApplicants();
  const navigate = useNavigate();
  const { openApp } = useAppDrawer();
  const listRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const aboutRow = about ? apps.data?.find((r) => r.app.id === about) : undefined;
  const suggestions = aboutRow
    ? [`Why is ${aboutRow.app.id} ${statusVerb(aboutRow.decision.status)}?`, `What if ${aboutRow.app.id} finds a ground-floor space?`, ...(aboutRow.decision.territoryId ? [`Who is competing for ${aboutRow.decision.territoryId}?`] : [])]
    : BASE_SUGGESTIONS;

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || ask.loading) return;
    const id = ++seq.current;
    setMsgs((m) => [...m, { id, q: question, a: null }]);
    setText('');
    const a = await ask.run(question);
    setMsgs((m) => m.map((x) => (x.id === id ? { ...x, a } : x)));
  };

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  const nameOf = (id?: string) => apps.data?.find((r) => r.app.id === id)?.app.name;

  return (
    <section className="card flex min-h-[520px] flex-col lg:h-[calc(100vh-190px)]" aria-label="Ask">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <MessageSquareText className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold">Ask</h2>
        {aboutRow && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-2xs font-medium text-brand tnum">About {aboutRow.app.id}</span>}
        <span className="ml-auto text-2xs text-subtle">Canned answers in the demo</span>
      </header>

      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin" aria-live="polite">
        {msgs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="text-sm text-muted">Ask why, or what if.</p>
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
                  name={nameOf(m.a.applicationId)}
                  onOpen={openApp}
                  onTry={onTryWhatIf}
                  onMap={(t) => navigate(`/map?territory=${t}`)}
                  onSuggest={send}
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
            Ask a question
          </label>
          <input
            id="ask-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={aboutRow ? `Ask about ${aboutRow.app.id}…` : 'Why is APP-007 on hold?'}
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

function Answer({ a, name, onOpen, onTry, onMap, onSuggest }: {
  a: AskResponse;
  name?: string;
  onOpen: (id: string) => void;
  onTry: (id: string, autorun: boolean) => void;
  onMap: (t: string) => void;
  onSuggest: (q: string) => void;
}) {
  return (
    <div className="max-w-[92%] space-y-2.5 rounded-2xl rounded-bl-md border bg-surface p-3.5 shadow-soft">
      {(a.kind === 'decision' || a.kind === 'whatif') && a.applicationId && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-2xs text-subtle tnum">{a.applicationId}</span>
            {a.kind === 'whatif' && <span className="rounded-full bg-raised px-1.5 py-0.5 text-2xs text-muted">would become</span>}
            {a.status && <StatusChip status={a.status} />}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {a.reasons.map((r) => (
              <ReasonChip key={r.id} reason={r} />
            ))}
          </div>
          <p className="text-sm text-muted">{a.sentence}</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => onOpen(a.applicationId!)}>
              <ExternalLink /> Open applicant
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onTry(a.applicationId!, a.kind === 'whatif')}>
              <FlaskConical /> {a.kind === 'whatif' ? 'See the diff' : 'Try a what-if'}
            </Button>
          </div>
        </>
      )}
      {a.kind === 'territory' && a.territoryId && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tnum">{a.territoryId}</span>
            <span className="text-xs text-muted">{a.sentence}</span>
          </div>
          <ol className="space-y-1">
            {(a.ranked ?? []).slice(0, 6).map((r, i) => (
              <li key={r.applicationId}>
                <button type="button" onClick={() => onOpen(r.applicationId)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-raised focus-ring">
                  <span className="w-4 text-xs text-subtle tnum">{i + 1}</span>
                  <span className="flex-1 truncate">{r.name}</span>
                  <StatusChip status={r.status} size="sm" />
                </button>
              </li>
            ))}
          </ol>
          <Button size="sm" variant="secondary" onClick={() => onMap(a.territoryId!)}>
            <MapIcon /> Open on map
          </Button>
        </>
      )}
      {a.kind === 'fallback' && (
        <>
          <p className="text-sm text-muted">{a.sentence}</p>
          <div className="flex flex-wrap gap-1.5">
            {(a.suggestions ?? []).map((s) => (
              <button key={s} type="button" onClick={() => onSuggest(s)} className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-raised focus-ring')}>
                {s} <ArrowRight className="h-3 w-3" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
