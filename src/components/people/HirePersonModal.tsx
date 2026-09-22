import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useOptionalPersonDesk } from '../../contexts/PersonDeskContext'
import type { PersonKind } from '../../hooks/usePeopleRoster'
import { KINDS, KIND_LABELS } from './peopleUsersTabShared'
import { denverWorkDateToday } from '../../lib/salaryScheduleSync'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  assignPacketToPerson,
  createRosterRow,
  findNameCollision,
  hirePlan,
  inviteHire,
  saveSalaryTemplate,
  upsertPayConfigRow,
  type HireInput,
  type HireStep,
  type HireStepId,
} from '../../lib/people/hireWrites'
import { BTN, BTN_BLUE, BTN_QUIET, DESK_EDITOR_Z, deskBtn } from '../personDesk/personDeskShared'

type StepState = { state: 'pending' | 'running' | 'done' | 'failed'; message?: string }

/**
 * Hire (People spine PR 3, v2.3701): one form for a new person — who, from when, paid how, with
 * which paperwork — run as an ordered list of writes with a result per step and Retry on the one
 * that failed. Nothing is written until Hire is pressed; the plan's problems block it before that.
 */
export function HirePersonModal({
  authUserId,
  isDev,
  canAccessPay,
  canAccessContracts,
  onClose,
  onHired,
}: {
  authUserId: string
  isDev: boolean
  canAccessPay: boolean
  canAccessContracts: boolean
  onClose: () => void
  /** Rosters reload after a run that wrote anything. */
  onHired: () => void
}) {
  const personDesk = useOptionalPersonDesk()
  const [input, setInput] = useState<HireInput>({
    name: '',
    kind: 'helper',
    email: '',
    invite: isDev,
    startInTraining: false,
    startDate: denverWorkDateToday(),
    hourlyWage: null,
    isSalary: false,
    workdayStart: '08:00',
    packetTemplateId: null,
  })
  const [wageText, setWageText] = useState('')
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([])
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Partial<Record<HireStepId, StepState>>>({})
  const [context, setContext] = useState<{ userId: string | null; personId: string | null; wrote: boolean }>({ userId: null, personId: null, wrote: false })
  const [collision, setCollision] = useState<string | null>(null)

  const caps = useMemo(() => ({ canInvite: isDev, canAccessPay, canAccessContracts }), [isDev, canAccessPay, canAccessContracts])
  const plan = useMemo(() => hirePlan(input, caps), [input, caps])
  const started = Object.keys(results).length > 0
  const allDone = started && plan.steps.every((s) => results[s.id]?.state === 'done')

  useEffect(() => {
    if (!canAccessContracts) return
    let cancelled = false
    void supabase
      .from('contract_templates')
      .select('id, name')
      .order('sequence_order')
      .then(({ data }) => {
        if (!cancelled) setTemplates((data ?? []) as Array<{ id: string; name: string }>)
      })
    return () => {
      cancelled = true
    }
  }, [canAccessContracts])

  function set<K extends keyof HireInput>(k: K, v: HireInput[K]) {
    setInput((prev) => ({ ...prev, [k]: v }))
  }

  async function runStep(step: HireStep, ctx: { userId: string | null; personId: string | null }): Promise<{ userId: string | null; personId: string | null }> {
    const name = input.name.trim()
    switch (step.id) {
      case 'account': {
        const r = await inviteHire(supabase, {
          email: input.email,
          kind: input.kind,
          name,
          startInTraining: input.startInTraining,
          startDate: input.startDate,
          redirectTo: new URL('accept-invite', window.location.href).href,
        })
        let personId = r.personId
        // A function deployed before v2.3701 answers without the roster row: make it here, linked.
        if (!personId) personId = await createRosterRow(supabase, { masterUserId: authUserId, kind: input.kind, name, email: input.email, accountUserId: r.userId, startDate: input.startDate })
        return { userId: r.userId, personId }
      }
      case 'roster': {
        const personId = await createRosterRow(supabase, { masterUserId: authUserId, kind: input.kind, name, email: input.email || null, accountUserId: null, startDate: input.startDate })
        return { ...ctx, personId }
      }
      case 'pay':
        await upsertPayConfigRow(supabase, { payName: name, personId: ctx.personId, hourlyWage: input.hourlyWage, officeWage: null, isSalary: input.isSalary, recordHoursButSalary: false })
        return ctx
      case 'workday':
        if (!ctx.userId) throw new Error('No login was made, so there is no account to hold the workday template.')
        await saveSalaryTemplate(supabase, { userId: ctx.userId, startLocal: input.workdayStart, timezone: APP_CALENDAR_TZ })
        return ctx
      case 'packet':
        if (!input.packetTemplateId) return ctx
        await assignPacketToPerson(supabase, { payName: name, templateId: input.packetTemplateId })
        return ctx
    }
  }

  async function run(from: HireStepId | null) {
    if (running || plan.problems.length > 0) return
    setRunning(true)
    let ctx = { userId: context.userId, personId: context.personId }
    let wrote = context.wrote
    try {
      if (!started) {
        const c = await findNameCollision(supabase, input.name)
        if (c) {
          setCollision(c.where === 'account' ? 'An account with this exact name already exists — open their desk instead, or use a distinguishing name (pay is keyed by name).' : 'A roster row with this exact name already exists — open their desk instead, or use a distinguishing name (pay is keyed by name).')
          return
        }
        setCollision(null)
      }
      const order = plan.steps
      const startIdx = from ? order.findIndex((s) => s.id === from) : 0
      for (let i = Math.max(0, startIdx); i < order.length; i++) {
        const step = order[i]!
        if (results[step.id]?.state === 'done') continue
        setResults((r) => ({ ...r, [step.id]: { state: 'running' } }))
        try {
          ctx = await runStep(step, ctx)
          wrote = true
          setResults((r) => ({ ...r, [step.id]: { state: 'done' } }))
        } catch (e) {
          setResults((r) => ({ ...r, [step.id]: { state: 'failed', message: e instanceof Error ? e.message : 'That did not save' } }))
          break
        }
      }
    } finally {
      setContext({ ...ctx, wrote })
      setRunning(false)
      if (wrote) onHired()
    }
  }

  function openDesk() {
    if (personDesk && (context.userId || context.personId)) {
      personDesk.open({ userId: context.userId, personId: context.personId, displayName: input.name.trim() })
    }
    onClose()
  }

  const nameField = input.name.trim()
  const kindOptions: PersonKind[] = KINDS

  return (
    <div role="dialog" aria-modal="true" aria-label="Hire someone" style={{ position: 'fixed', inset: 0, zIndex: DESK_EDITOR_Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseDown={(e) => e.target === e.currentTarget && !running && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(640px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1rem 0.55rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>Hire someone</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>one form, every row a new person needs</span>
          <button type="button" aria-label="Close" onClick={onClose} disabled={running} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }}>
            ×
          </button>
        </div>

        <div style={{ overflow: 'auto', flex: 1, padding: '0.75rem 1rem', display: 'grid', gap: '0.6rem', fontSize: '0.8125rem' }}>
          {!started ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 180px', gap: '0.5rem' }}>
                <label style={{ display: 'grid', gap: '0.2rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Name</span>
                  <input type="text" value={input.name} onChange={(e) => set('name', e.target.value)} placeholder="First name, as they will be called" style={{ fontSize: '0.875rem', padding: '0.3rem 0.5rem' }} aria-label="Name" />
                </label>
                <label style={{ display: 'grid', gap: '0.2rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Kind</span>
                  <select value={input.kind} onChange={(e) => set('kind', e.target.value as PersonKind)} style={{ fontSize: '0.875rem', padding: '0.3rem 0.5rem' }} aria-label="Kind">
                    {kindOptions.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 180px', gap: '0.5rem' }}>
                <label style={{ display: 'grid', gap: '0.2rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Email {isDev ? '' : '(optional — a dev sends the invite later)'}</span>
                  <input type="email" value={input.email} onChange={(e) => set('email', e.target.value)} placeholder="them@example.com" style={{ fontSize: '0.875rem', padding: '0.3rem 0.5rem' }} aria-label="Email" />
                </label>
                <label style={{ display: 'grid', gap: '0.2rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Starts</span>
                  <input type="date" value={input.startDate} onChange={(e) => set('startDate', e.target.value)} style={{ fontSize: '0.875rem', padding: '0.3rem 0.5rem' }} aria-label="Start date" />
                </label>
              </div>
              {isDev ? (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input type="checkbox" checked={input.invite} onChange={(e) => set('invite', e.target.checked)} /> Send the invite (makes their login)
                  </label>
                  {input.invite ? (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <input type="checkbox" checked={input.startInTraining} onChange={(e) => set('startInTraining', e.target.checked)} /> Start in training mode (read-only)
                    </label>
                  ) : null}
                </div>
              ) : null}

              {canAccessPay ? (
                <div style={{ display: 'grid', gap: '0.4rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-700)' }}>Pay</div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      $
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={wageText}
                        onChange={(e) => {
                          setWageText(e.target.value)
                          const n = Number.parseFloat(e.target.value)
                          set('hourlyWage', Number.isFinite(n) ? n : null)
                        }}
                        style={{ fontSize: '0.875rem', width: 90, padding: '0.25rem 0.4rem' }}
                        aria-label="Hourly wage"
                      />
                      /h
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <input type="checkbox" checked={input.isSalary} onChange={(e) => set('isSalary', e.target.checked)} /> Salaried — a flat 8-hour day, weekdays
                    </label>
                    {input.isSalary ? (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        from <input type="time" value={input.workdayStart} onChange={(e) => set('workdayStart', e.target.value)} step={900} style={{ fontSize: '0.875rem', padding: '0.25rem 0.4rem' }} aria-label="Workday start" />
                      </label>
                    ) : null}
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>A pay row always carries a wage — salaried days are priced at it. Office rate and the vehicle deal are set on their desk after.</span>
                </div>
              ) : null}

              {canAccessContracts && templates.length > 0 ? (
                <label style={{ display: 'grid', gap: '0.2rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Paperwork packet (optional)</span>
                  <select value={input.packetTemplateId ?? ''} onChange={(e) => set('packetTemplateId', e.target.value || null)} style={{ fontSize: '0.875rem', padding: '0.3rem 0.5rem' }} aria-label="Paperwork packet">
                    <option value="">None yet</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {collision ? (
                <p role="alert" style={{ margin: 0, color: 'var(--text-red-600)' }}>
                  {collision}
                </p>
              ) : null}
              {nameField && plan.problems.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-amber-800)' }}>
                  {plan.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

          <div style={{ display: 'grid', gap: '0.3rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-700)' }}>{started ? 'What happened' : 'What will happen, in order'}</div>
            {plan.steps.map((s, i) => {
              const r = results[s.id]
              const dot: React.CSSProperties =
                r?.state === 'done'
                  ? { background: '#22c55e', border: '2px solid #22c55e' }
                  : r?.state === 'failed'
                    ? { background: '#dc2626', border: '2px solid #dc2626' }
                    : r?.state === 'running'
                      ? { border: '2px solid #3b82f6', background: 'transparent' }
                      : { border: '2px solid var(--border-strong)', background: 'transparent' }
              return (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', display: 'inline-block', ...dot }} />
                  <span>
                    <span style={{ fontWeight: 700 }}>
                      {i + 1}. {s.label}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}> · {s.detail}</span>
                    {r?.state === 'failed' ? <span style={{ color: 'var(--text-red-600)' }}> · {r.message}</span> : null}
                  </span>
                  <span>
                    {r?.state === 'failed' ? (
                      <button type="button" style={deskBtn(BTN, running)} disabled={running} onClick={() => void run(s.id)}>
                        Retry
                      </button>
                    ) : r?.state === 'running' ? (
                      <span style={{ color: 'var(--text-muted)' }}>Working…</span>
                    ) : null}
                  </span>
                </div>
              )
            })}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Each step is its own write; one that fails stops the run and can be retried without redoing the others. Vehicle, housing and the office rate live on their desk.</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center', padding: '0.7rem 1rem', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
          {allDone ? (
            <>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginRight: 'auto' }}>{input.name.trim()} is on the roster.</span>
              <button type="button" style={BTN_BLUE} onClick={openDesk}>
                Open their desk
              </button>
            </>
          ) : (
            <>
              <button type="button" style={BTN_QUIET} onClick={onClose} disabled={running}>
                {started ? 'Close' : 'Cancel'}
              </button>
              {!started ? (
                <button type="button" style={deskBtn(BTN_BLUE, running || plan.problems.length > 0 || !nameField)} disabled={running || plan.problems.length > 0 || !nameField} onClick={() => void run(null)}>
                  {running ? 'Hiring…' : `Hire ${nameField || ''}`.trim()}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
