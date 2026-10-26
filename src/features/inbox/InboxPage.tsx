import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ExternalLink, Inbox, SendHorizontal, Sparkles, Store as StoreIcon, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/app/AppShell';
import { Avatar, StatusChip } from '@/components/chips';
import { EmptyState, ListSkeleton } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/controls';
import { useApplicants, useEngineActions, useInbox, usePartnerProfile, useSuggestReply } from '@/engine/hooks';
import type { ChatMessage } from '@/engine/types';
import { cn } from '@/lib/cn';
import { useAppDrawer } from '@/lib/hooks';
import { useUi } from '@/store/ui';

const time = (at: string) => new Date(at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function InboxPage() {
  const inbox = useInbox();
  const apps = useApplicants();
  const [params, setParams] = useSearchParams();
  const selected = params.get('thread') ?? inbox.data?.[0]?.applicationId ?? null;
  const select = (id: string) => setParams((p) => (p.set('thread', id), p), { replace: true });
  const options = (apps.data ?? []).map((r) => ({ value: r.app.id, label: `${r.app.id} · ${r.app.name}` }));

  return (
    <div className="pb-10">
      <PageHeader
        title="Partner inbox"
        question="What are partners asking?"
        actions={
          options.length > 0 && (
            <div className="w-64">
              <Select value={undefined} onChange={(v) => select(v)} options={options} placeholder="Message any applicant…" ariaLabel="Start a conversation" />
            </div>
          )
        }
      />
      <div className="grid gap-4 px-4 md:px-6 lg:grid-cols-[320px_1fr]">
        <section className="card overflow-hidden" aria-label="Conversations">
          {inbox.loading && !inbox.data ? (
            <div className="p-4">
              <ListSkeleton />
            </div>
          ) : !inbox.data?.length ? (
            <EmptyState
              title="No partner messages yet"
              icon={<Inbox className="h-5 w-5" />}
              action={<PartnerLink id={apps.data?.[0]?.app.id} />}
            />
          ) : (
            <ul className="max-h-[calc(100vh-220px)] divide-y overflow-y-auto scrollbar-thin">
              {inbox.data.map((t) => (
                <li key={t.applicationId}>
                  <button
                    type="button"
                    onClick={() => select(t.applicationId)}
                    className={cn('flex w-full items-start gap-2.5 px-3.5 py-3 text-left hover:bg-raised focus-ring', selected === t.applicationId && 'bg-brand-soft/60')}
                  >
                    <Avatar name={t.name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{t.name}</span>
                        <span className="text-2xs text-subtle tnum">{t.applicationId}</span>
                        {t.unread > 0 && <span className="ml-auto rounded-full bg-brand px-1.5 text-[10px] font-semibold leading-4 text-brand-fg tnum">{t.unread}</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">{t.last?.text}</span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <StatusChip status={t.status} size="sm" />
                        {t.pendingUpdate && <span className="rounded-full bg-st-needs/15 px-1.5 py-0.5 text-2xs font-medium text-st-needs">Update to apply</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {selected ? <Conversation key={selected} id={selected} /> : <section className="card hidden lg:block" />}
      </div>
    </div>
  );
}

function PartnerLink({ id }: { id?: string }) {
  const navigate = useNavigate();
  if (!id) return null;
  return (
    <Button size="sm" onClick={() => navigate(`/partner/${id}`)}>
      <StoreIcon /> Open a partner view to send one
    </Button>
  );
}

function Conversation({ id }: { id: string }) {
  const profile = usePartnerProfile(id);
  const apps = useApplicants();
  const row = apps.data?.find((r) => r.app.id === id);
  const act = useEngineActions();
  const suggest = useSuggestReply();
  const toast = useUi((s) => s.toast);
  const { openApp } = useAppDrawer();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [aiUsed, setAiUsed] = useState<'rules' | 'gemini' | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const msgs = useMemo<ChatMessage[]>(() => profile.data?.messages ?? [], [profile.data]);

  useEffect(() => {
    void act.markRead(id);
    // mark read once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs.length]);

  const send = async () => {
    if (!text.trim()) return;
    await act.sendBrand(id, text);
    setText('');
    setAiUsed(null);
  };

  return (
    <section className="card flex min-h-[520px] flex-col lg:h-[calc(100vh-180px)]" aria-label="Conversation">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        {row && <Avatar name={row.app.name} />}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{row?.app.name ?? id}</div>
          <div className="text-2xs text-subtle tnum">
            {id} · {row?.decision.text.outcome}
            {row?.decision.text.sub ? ` · ${row.decision.text.sub}` : ''} · writes in {row?.app.language}
          </div>
        </div>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" onClick={() => openApp(id)}>
            <ExternalLink /> Applicant
          </Button>
          <Button size="sm" onClick={() => navigate(`/partner/${id}`)}>
            <StoreIcon /> Partner view
          </Button>
        </div>
      </header>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin" aria-live="polite">
        <AnimatePresence initial={false}>
          {msgs.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('flex', m.from === 'partner' ? 'justify-start' : 'justify-end')}>
              <div className="max-w-[80%] space-y-1.5">
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2 text-sm',
                    m.from === 'partner' ? 'rounded-bl-md bg-raised text-fg' : m.from === 'brand' ? 'rounded-br-md bg-brand text-brand-fg' : 'rounded-br-md border border-dashed bg-surface text-fg',
                  )}
                >
                  {m.from === 'assistant' && (
                    <span className="mb-0.5 flex items-center gap-1 text-2xs font-medium text-subtle">
                      <Bot className="h-3 w-3" /> Auto-reply (from the engine)
                    </span>
                  )}
                  {m.text}
                  <div className={cn('mt-1 text-[10px]', m.from === 'brand' ? 'text-brand-fg/70' : 'text-subtle')}>{time(m.at)}</div>
                </div>
                {m.detected && (
                  <div className="rounded-lg border border-st-needs/30 bg-st-needs/[0.06] p-2.5 text-xs">
                    <div className="font-medium text-st-needs">Update detected</div>
                    <div className="mt-0.5 text-muted">{m.detected.understood}</div>
                    {m.detected.applied ? (
                      <div className="mt-1.5 text-st-approved">✓ Applied — decision re-run</div>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        className="mt-2"
                        disabled={act.busy}
                        onClick={async () => {
                          const diff = await act.applyDetected(id, m.id);
                          toast(diff.length ? `Applied — ${diff.length} applicant${diff.length > 1 ? 's' : ''} changed` : 'Applied — no decision changed', 'success');
                        }}
                      >
                        Apply update &amp; re-run
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="space-y-2 border-t p-3"
      >
        <label htmlFor="brand-reply" className="sr-only">
          Reply
        </label>
        <textarea
          id="brand-reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={`Reply to ${row?.app.name.split(' ')[0] ?? 'partner'} as the relationship manager…`}
          className="w-full resize-none rounded-md border bg-surface px-3 py-2 text-sm shadow-soft placeholder:text-subtle focus-ring"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={suggest.loading}
            onClick={async () => {
              const r = await suggest.run(id);
              setText(r.text);
              setAiUsed(r.source);
            }}
          >
            {suggest.loading ? <Sparkles className="animate-pulse" /> : <Wand2 />} Suggest reply
          </Button>
          {aiUsed && <span className="text-2xs text-subtle">{aiUsed === 'gemini' ? 'Drafted by Gemini from the decision — check before sending' : 'Drafted from the decision (rules)'}</span>}
          <Button type="submit" variant="primary" size="sm" className="ml-auto" disabled={!text.trim() || act.busy}>
            <SendHorizontal /> Send
          </Button>
        </div>
      </form>
    </section>
  );
}
