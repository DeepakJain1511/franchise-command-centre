import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Check, Hexagon, Loader2, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LanguageBadge } from '@/components/chips';
import { Skeleton } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/controls';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/overlay';
import { useStaffActions, useStaffRoster } from '@/engine/hooks';
import { STAFF_ROLES, type Language, type StaffMember, type StaffModule, type StaffRole, type StaffRoster } from '@/engine/types';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateLong } from '@/lib/time';
import { useUi } from '@/store/ui';

const LANGS: Language[] = ['Kannada', 'English', 'Hindi'];

/** Partner's own staff: add people, assign modules, track completion, award certificates. */
export function StaffTraining({ appId, storeName, partnerLanguage, managerName }: { appId: string; storeName: string; partnerLanguage: Language; managerName: string }) {
  const q = useStaffRoster(appId);
  const actions = useStaffActions();
  const toast = useUi((s) => s.toast);
  const [roster, setRoster] = useState<StaffRoster | null>(null);
  const [adding, setAdding] = useState(false);
  const [cert, setCert] = useState<StaffMember | null>(null);

  useEffect(() => {
    if (q.data) setRoster(q.data);
  }, [q.data]);

  if (!roster) return <Skeleton className="h-64 rounded-2xl" />;

  const byId = new Map(roster.catalog.map((c) => [c.id, c]));
  const assigned = roster.members.reduce((n, m) => n + m.modules.length, 0);
  const done = roster.members.reduce((n, m) => n + m.modules.filter((x) => x.progress >= 1).length, 0);
  const certified = roster.members.filter((m) => m.certifiedAt).length;

  return (
    <section className="card p-5" aria-label="Your staff">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-brand [&_svg]:size-4">
          <Users />
        </span>
        <h2 className="text-sm font-semibold">Your staff</h2>
        <span className="text-xs text-muted tnum">
          · {roster.members.length} people · {done}/{assigned} modules · {certified} certified
        </span>
        <Button size="sm" variant="primary" className="ml-auto" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
          {adding ? <X /> : <UserPlus />} {adding ? 'Cancel' : 'Add staff'}
        </Button>
      </header>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <AddStaffForm
              defaultLanguage={partnerLanguage}
              busy={actions.busy}
              onAdd={async (s) => {
                setRoster(await actions.add(appId, s));
                setAdding(false);
                toast(`${s.name} added — role modules assigned`, 'success');
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {roster.members.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
          <Users className="h-6 w-6 text-subtle" />
          <p className="text-sm text-muted">No staff yet. Add your team to start their training.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {roster.members.map((m) => {
            const total = m.modules.length;
            const fin = m.modules.filter((x) => x.progress >= 1).length;
            const pct = total ? (m.modules.reduce((n, x) => n + x.progress, 0) / total) * 100 : 0;
            const unassigned = roster.catalog.filter((c) => !m.modules.some((x) => x.moduleId === c.id));
            return (
              <motion.li layout key={m.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-semibold text-muted">
                    {m.name.replace('Dr. ', '').split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{m.name}</span>
                      {m.certifiedAt && (
                        <button type="button" onClick={() => setCert(m)} className="inline-flex items-center gap-1 rounded-full bg-st-approved/10 px-2 py-0.5 text-2xs font-semibold text-st-approved hover:bg-st-approved/20 focus-ring">
                          <Award className="h-3 w-3" /> Certified · view
                        </button>
                      )}
                    </div>
                    <div className="text-2xs text-subtle">
                      {m.role} · joined {fmtDate(m.joinedAt)}
                    </div>
                  </div>
                  <LanguageBadge language={m.language} size="sm" />
                  <div className="w-36">
                    <div className="mb-1 flex justify-between text-2xs text-muted tnum">
                      <span>
                        {fin}/{total} modules
                      </span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-raised">
                      <motion.div className={cn('h-full rounded-full', m.certifiedAt ? 'bg-st-approved' : 'bg-brand')} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                    </div>
                  </div>
                  <Tooltip content="Remove from staff">
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label={`Remove ${m.name}`}
                      onClick={async () => {
                        setRoster(await actions.remove(appId, m.id));
                        toast(`${m.name} removed`);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </Tooltip>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {m.modules.map((x) => {
                    const mod = byId.get(x.moduleId)!;
                    return (
                      <ModuleChip
                        key={x.moduleId}
                        mod={mod}
                        progress={x.progress}
                        score={x.quizScore}
                        completedAt={x.completedAt}
                        passMark={roster.passMark}
                        busy={actions.busy}
                        onComplete={async () => {
                          const r = await actions.complete(appId, m.id, x.moduleId);
                          setRoster(r);
                          const after = r.members.find((y) => y.id === m.id);
                          const sc = after?.modules.find((y) => y.moduleId === x.moduleId)?.quizScore;
                          toast(`${m.name.split(' ')[0]} finished "${mod.title}" · quiz ${sc}%`, 'success');
                          if (after?.certifiedAt && !m.certifiedAt) {
                            setTimeout(() => setCert(after), 400);
                          }
                        }}
                      />
                    );
                  })}
                  {unassigned.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs text-muted hover:border-brand/50 hover:text-fg focus-ring">
                          <Plus className="h-3.5 w-3.5" /> Assign
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-1.5">
                        <p className="label px-2 pb-1 pt-1">Assign a module</p>
                        {unassigned.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={async () => {
                              setRoster(await actions.assign(appId, m.id, c.id));
                              toast(`"${c.title}" assigned to ${m.name.split(' ')[0]}`);
                            }}
                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-raised focus-ring"
                          >
                            {c.title}
                            <span className="text-2xs text-subtle tnum">{c.hours} h</span>
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-2xs text-subtle">Pass mark {roster.passMark}% per module quiz. A certificate is issued when every assigned module is passed.</p>

      <Certificate member={cert} onClose={() => setCert(null)} storeName={storeName} managerName={managerName} catalog={roster.catalog} />
    </section>
  );
}

function ModuleChip({ mod, progress, score, completedAt, passMark, busy, onComplete }: {
  mod: StaffModule;
  progress: number;
  score: number | null;
  completedAt: string | null;
  passMark: number;
  busy: boolean;
  onComplete: () => void;
}) {
  const done = progress >= 1;
  const passed = done && (score ?? 0) >= passMark;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors focus-ring',
            passed ? 'border-st-approved/30 bg-st-approved/10 text-fg' : progress > 0 ? 'border-brand/30 bg-brand-soft text-fg' : 'bg-surface text-muted hover:text-fg',
          )}
        >
          {passed ? (
            <Check className="h-3 w-3 text-st-approved" strokeWidth={3} />
          ) : (
            <span className="relative h-3 w-3 rounded-full border border-current">
              {progress > 0 && <span className="absolute inset-0 rounded-full bg-current" style={{ clipPath: `inset(0 ${100 - progress * 100}% 0 0)` }} />}
            </span>
          )}
          {mod.title}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="text-sm font-semibold">{mod.title}</div>
        <div className="text-2xs text-subtle tnum">{mod.hours} h · for {mod.forRoles.join(', ').toLowerCase()}</div>
        {done ? (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-raised/70 px-3 py-2 text-xs">
            <span>Quiz score</span>
            <span className={cn('font-semibold tnum', passed ? 'text-st-approved' : 'text-st-rejected')}>
              {score}% {passed ? '· passed' : '· retake'}
            </span>
          </div>
        ) : (
          <div className="mt-3 text-xs text-muted">{progress > 0 ? `${Math.round(progress * 100)}% watched` : 'Not started yet'}</div>
        )}
        {completedAt && <div className="mt-1 text-2xs text-subtle">Completed {fmtDateLong(completedAt)}</div>}
        {!passed && (
          <Button size="sm" variant="primary" className="mt-3 w-full" disabled={busy} onClick={onComplete}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />} Mark complete (take quiz)
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AddStaffForm({ defaultLanguage, busy, onAdd }: { defaultLanguage: Language; busy: boolean; onAdd: (s: { name: string; role: StaffRole; language: Language }) => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('Sales associate');
  const [language, setLanguage] = useState<Language>(defaultLanguage);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onAdd({ name, role, language });
      }}
      className="mb-4 grid gap-2 rounded-xl bg-raised/60 p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
    >
      <label className="sr-only" htmlFor="staff-name">
        Staff name
      </label>
      <input
        id="staff-name"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        className="h-9 rounded-md border bg-surface px-3 text-sm shadow-soft placeholder:text-subtle focus-ring"
      />
      <Select ariaLabel="Role" value={role} onChange={setRole} options={STAFF_ROLES.map((r) => ({ value: r, label: r }))} />
      <Select ariaLabel="Training language" value={language} onChange={setLanguage} options={LANGS.map((l) => ({ value: l, label: l }))} />
      <Button type="submit" variant="primary" disabled={!name.trim() || busy}>
        <UserPlus /> Add
      </Button>
    </form>
  );
}

function Certificate({ member, onClose, storeName, managerName, catalog }: {
  member: StaffMember | null;
  onClose: () => void;
  storeName: string;
  managerName: string;
  catalog: StaffModule[];
}) {
  const toast = useUi((s) => s.toast);
  const titles = new Map(catalog.map((c) => [c.id, c.title]));
  return (
    <Dialog.Root open={!!member} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[85] w-[min(94vw,640px)] -translate-x-1/2 -translate-y-1/2 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          {member && (
            <motion.div initial={{ rotateX: 8, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ duration: 0.4 }} className="rounded-2xl bg-surface p-2 shadow-pop">
              <div className="relative overflow-hidden rounded-xl border-2 border-[hsl(38_60%_70%)] bg-[radial-gradient(120%_80%_at_50%_0%,hsl(40_60%_96%),hsl(var(--surface)))] px-8 py-9 text-center">
                <div aria-hidden className="pointer-events-none absolute inset-2 rounded-lg border border-[hsl(38_60%_80%)]" />
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-fg">
                  <Hexagon className="h-5 w-5" strokeWidth={2.5} />
                </span>
                <Dialog.Title className="mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-subtle">Certificate of completion</Dialog.Title>
                <Dialog.Description className="sr-only">Training certificate for {member.name}</Dialog.Description>
                <p className="mt-4 text-sm text-muted">This certifies that</p>
                <p className="mt-1 font-serif text-3xl font-semibold tracking-tight text-fg">{member.name}</p>
                <p className="mt-2 text-sm text-muted">
                  {member.role} at {storeName} has completed the Bunty store training
                </p>
                <ul className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-1.5">
                  {member.modules.map((x) => (
                    <li key={x.moduleId} className="rounded-full bg-raised px-2.5 py-0.5 text-2xs text-muted">
                      {titles.get(x.moduleId)} · {x.quizScore}%
                    </li>
                  ))}
                </ul>
                <div className="mt-7 flex items-end justify-between text-left text-xs">
                  <div>
                    <div className="font-serif text-base italic text-fg">{managerName}</div>
                    <div className="border-t pt-0.5 text-subtle">Relationship manager, Bunty Consulting</div>
                  </div>
                  <Award className="h-10 w-10 text-[hsl(38_70%_55%)]" aria-hidden />
                  <div className="text-right">
                    <div className="text-base text-fg tnum">{member.certifiedAt ? fmtDateLong(member.certifiedAt) : ''}</div>
                    <div className="border-t pt-0.5 text-subtle">Date</div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 p-2 pt-3">
                <Button onClick={() => toast('PDF download comes with the full version')}>Download PDF</Button>
                <Dialog.Close asChild>
                  <Button variant="primary">Done</Button>
                </Dialog.Close>
              </div>
            </motion.div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
