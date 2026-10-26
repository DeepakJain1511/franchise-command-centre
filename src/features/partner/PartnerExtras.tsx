import { AnimatePresence, motion } from 'framer-motion';
import { Mail, MessageCircle, PhoneCall, SendHorizontal, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/controls';
import { usePartnerProfile, useSendPartnerMessage } from '@/engine/hooks';
import type { ChatMessage, PartnerProfile } from '@/engine/types';
import { cn } from '@/lib/cn';
import { inrLakh } from '@/lib/format';
import { useColors } from '@/lib/hooks';
import { useUi } from '@/store/ui';

function Card({ title, icon, children, aside, className }: { title: string; icon: ReactNode; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={cn('card p-5', className)}>
      <header className="mb-4 flex items-center gap-2">
        <span className="text-brand [&_svg]:size-4">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="ml-auto">{aside}</div>
      </header>
      {children}
    </section>
  );
}

/* ---------------- Payback ---------------- */

/** Payback estimate with a cash-recovery curve; the partner can drag expected monthly sales. */
export function PaybackCard({ profile }: { profile: PartnerProfile }) {
  const c = useColors();
  const e = profile.economics;
  const [sales, setSales] = useState(e.monthlySalesLakh);
  const profit = sales * e.grossMargin - e.monthlyCostsLakh;
  const months = profit > 0 ? e.investmentLakh / profit : Infinity;
  const horizon = Math.min(60, Math.max(24, Number.isFinite(months) ? Math.ceil(months * 1.4) : 36));
  const data = useMemo(
    () => Array.from({ length: horizon + 1 }, (_, m) => ({ m, cash: Math.round((-e.investmentLakh + profit * m) * 10) / 10 })),
    [horizon, profit, e.investmentLakh],
  );
  const changed = Math.abs(sales - e.monthlySalesLakh) > 0.05;
  const label = !Number.isFinite(months) ? 'Not at these sales' : months < 12 ? `${Math.ceil(months)} months` : `${(months / 12).toFixed(1)} years`;

  return (
    <Card title="Payback period" icon={<TrendingUp />} aside={<span className="text-2xs text-subtle">Estimate · {e.basis}</span>}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <div className="text-3xl font-semibold tracking-tight tnum">
            {Number.isFinite(months) ? '≈ ' : ''}
            {label}
          </div>
          <div className="text-xs text-muted">to earn back {inrLakh(e.investmentLakh)}</div>
        </div>
        <div className="grid grid-cols-3 gap-5 text-xs">
          <div>
            <div className="font-semibold tnum">{inrLakh(sales)}</div>
            <div className="text-subtle">sales / month</div>
          </div>
          <div>
            <div className="font-semibold tnum">{inrLakh(e.monthlyCostsLakh)}</div>
            <div className="text-subtle">running costs / month</div>
          </div>
          <div>
            <div className={cn('font-semibold tnum', profit > 0 ? 'text-st-approved' : 'text-st-rejected')}>{inrLakh(Math.round(profit * 10) / 10)}</div>
            <div className="text-subtle">profit / month</div>
          </div>
        </div>
      </div>

      <div className="mt-4 h-44" role="img" aria-label={`Cash recovery over ${horizon} months, break-even ${label}`}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="pb-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={c('st-approved')} stopOpacity={0.35} />
                <stop offset="1" stopColor={c('st-approved')} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={c('border')} />
            <XAxis dataKey="m" tick={{ fill: c('subtle'), fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(m: number) => (m % 6 === 0 ? `${m}m` : '')} interval={0} />
            <YAxis tick={{ fill: c('subtle'), fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}L`} />
            <ReferenceLine y={0} stroke={c('fg', 0.4)} strokeDasharray="3 3" />
            <RTooltip
              cursor={{ stroke: c('brand'), strokeDasharray: '3 3' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-md border bg-surface px-2.5 py-1.5 text-xs shadow-pop tnum">
                    Month {payload[0].payload.m}: {payload[0].payload.cash >= 0 ? '+' : ''}
                    {inrLakh(Math.abs(payload[0].payload.cash))} {payload[0].payload.cash >= 0 ? 'ahead' : 'still to recover'}
                  </div>
                ) : null
              }
            />
            <Area type="monotone" dataKey="cash" stroke={c('st-approved')} strokeWidth={2} fill="url(#pb-fill)" isAnimationActive animationDuration={500} />
            {Number.isFinite(months) && months <= horizon && <ReferenceDot x={Math.round(months)} y={0} r={5} fill={c('st-approved')} stroke={c('surface')} strokeWidth={2} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 rounded-xl bg-raised/60 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">What if monthly sales are…</span>
          <span className="font-semibold tnum">{inrLakh(sales)}</span>
        </div>
        <Slider
          min={Math.max(1, Math.round(e.monthlySalesLakh * 0.4))}
          max={Math.round(e.monthlySalesLakh * 1.8)}
          step={0.1}
          value={[sales]}
          onValueChange={([v]) => setSales(Math.round(v * 10) / 10)}
          thumbLabel="Expected monthly sales in lakh"
        />
        <div className="flex justify-between text-2xs text-subtle">
          <span>Slower month</span>
          {changed ? (
            <button type="button" onClick={() => setSales(e.monthlySalesLakh)} className="text-brand hover:underline focus-ring">
              Back to typical
            </button>
          ) : (
            <span>Typical for {e.basis}</span>
          )}
          <span>Busier month</span>
        </div>
      </div>
      <p className="mt-2 text-2xs text-subtle">Illustrative only — your relationship manager will share the detailed plan.</p>
    </Card>
  );
}

/* ---------------- Relationship manager + chat ---------------- */

export function ManagerCard({ profile }: { profile: PartnerProfile }) {
  const m = profile.manager;
  const toast = useUi((s) => s.toast);
  const initials = m.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return (
    <Card title="Your relationship manager" icon={<MessageCircle />}>
      <div className="flex items-center gap-3">
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-fg">
          {initials}
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-st-approved ring-2 ring-surface" aria-label="Online" />
        </span>
        <div className="min-w-0">
          <div className="font-semibold">{m.name}</div>
          <div className="text-xs text-muted">{m.role}</div>
          <div className="text-2xs text-subtle">Speaks {m.languages.join(', ')}</div>
        </div>
      </div>
      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Phone</dt>
          <dd className="font-medium tnum">{m.phone}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Email</dt>
          <dd className="truncate font-medium">{m.email}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Hours</dt>
          <dd className="font-medium">{m.hours}</dd>
        </div>
      </dl>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={() => toast(`Calling ${m.name.split(' ')[0]} opens in the full version`)}>
          <PhoneCall /> Call
        </Button>
        <Button onClick={() => toast('Email opens in the full version')}>
          <Mail /> Email
        </Button>
      </div>
      <p className="mt-2 text-2xs text-subtle">Demo contact details.</p>
    </Card>
  );
}

const SUGGESTIONS = ['When will my store open?', 'How do I finish training?', 'Can you check my shop space?', 'Explain my payback'];

export function ChatCard({ profile }: { profile: PartnerProfile }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>(profile.messages);
  const [text, setText] = useState('');
  const send = useSendPartnerMessage();
  const listRef = useRef<HTMLDivElement>(null);
  const first = profile.manager.name.split(' ')[0];

  useEffect(() => setMsgs(profile.messages), [profile]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, send.loading]);

  const submit = async (t: string) => {
    const body = t.trim();
    if (!body || send.loading) return;
    setText('');
    setMsgs((m) => [...m, { id: `local-${m.length}`, from: 'partner', text: body, at: new Date().toISOString() }]);
    const reply = await send.run(profile.applicationId, body);
    setMsgs((m) => [...m, reply]);
  };

  const time = (at: string) => new Date(at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <Card title={`Chat with ${first}`} icon={<MessageCircle />} aside={<span className="flex items-center gap-1 text-2xs text-st-approved"><span className="h-1.5 w-1.5 rounded-full bg-st-approved" /> replies in minutes</span>} className="flex flex-col">
      <div ref={listRef} className="h-72 space-y-3 overflow-y-auto pr-1 scrollbar-thin" aria-live="polite">
        <AnimatePresence initial={false}>
          {msgs.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('flex', m.from === 'partner' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm', m.from === 'partner' ? 'rounded-br-md bg-brand text-brand-fg' : 'rounded-bl-md bg-raised text-fg')}>
                {m.text}
                <div className={cn('mt-1 text-[10px]', m.from === 'partner' ? 'text-brand-fg/70' : 'text-subtle')}>{time(m.at)}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {send.loading && (
          <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-raised px-3.5 py-3" aria-label={`${first} is typing`}>
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-subtle" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => submit(s)} disabled={send.loading} className="rounded-full border bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:border-brand/40 hover:text-fg focus-ring disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(text);
        }}
        className="mt-3 flex items-center gap-2"
      >
        <label htmlFor="partner-chat" className="sr-only">
          Message {first}
        </label>
        <input
          id="partner-chat"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${first}…`}
          className="h-10 flex-1 rounded-xl border bg-surface px-3 text-sm shadow-soft placeholder:text-subtle focus-ring"
        />
        <Button type="submit" variant="primary" size="icon" disabled={!text.trim() || send.loading} aria-label="Send">
          <SendHorizontal />
        </Button>
      </form>
    </Card>
  );
}

/** Loads the partner profile once and renders the extras that need it. */
export function useProfile(id: string) {
  return usePartnerProfile(id);
}

export function ExtrasSkeleton() {
  return <Skeleton className="h-64 rounded-2xl" />;
}
