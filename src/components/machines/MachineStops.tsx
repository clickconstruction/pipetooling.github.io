/**
 * Equipment pre-use check (punch list #270): the five small pieces that put machines on a job's day.
 *
 * - `BlockMachinesRow`: the row in Dispatch's block editor, *Equipment on this job*, with the picker that reads where
 *   each machine is that day and draws red when one is already planned on another job.
 * - `BlockMachineChips`: the chips under a block on the week board and the day's agenda.
 * - `MachineArrivalStop`: the morning's question, *Is E-12 here?*, in the I'm here sheet.
 * - `ClockOutMachinesStop`: the leaving check as a stop in the clock-out review.
 * - `RailMachineStops`: the two stops under a job's row in the day rail.
 *
 * The plan is `machine_assignments` through `assignmentsIo.ts`, one read a day shared by every block; the stops read
 * the job's machines through `useJobMachines`.
 */
import { useState, type CSSProperties } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useDayPlan } from '../../hooks/useDayPlan'
import { useJobMachines } from '../../hooks/useJobMachines'
import {
  LEFT_WHERE_WORDS,
  arrivalWords,
  assignmentClash,
  assignmentsFor,
  clockWords,
  hoursWords,
  isHeld,
  leaveState,
  lineState,
  machineName,
  machinesOnJob,
  rentalWords,
  todayDay,
  type ArrivalAnswer,
  type CheckKind,
  type Machine,
  type MachineCheck,
  type MachineOnJob,
} from '../../lib/machines/machines'
import { addAssignment, patchAssignment, removeAssignment, forgetDay } from '../../lib/machines/assignmentsIo'
import { answerArrival } from '../../lib/machines/checksIo'
import { MachineCheckSheet } from './MachineCheckSheet'

const chip: CSSProperties = { display: 'inline-block', padding: '0 0.45rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, lineHeight: '1.2rem', whiteSpace: 'nowrap' }
const chipBlue: CSSProperties = { ...chip, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' }
const chipRed: CSSProperties = { ...chip, background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
const chipAmber: CSSProperties = { ...chip, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
const chipGreen: CSSProperties = { ...chip, background: 'var(--bg-green-100)', color: 'var(--text-green-700)' }
const press: CSSProperties = { minHeight: 32, padding: '0 0.6rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }
const quiet: CSSProperties = { ...press, borderStyle: 'dashed', color: 'var(--text-muted)' }
const field: CSSProperties = { minHeight: 32, padding: '0.25rem 0.5rem', borderRadius: 8, border: '1px solid var(--border-strong)', font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0 }

/** Where a machine is, for the picker: the yard, a job, held, a rental's due-back. */
function placeChip(m: Machine, checks: readonly MachineCheck[], today: string) {
  if (isHeld(checks, m.id)) return <span style={chipRed}>held</span>
  if (m.rental) {
    const r = rentalWords(m.rental, today)
    return <span style={r.late ? chipRed : chipAmber}>{r.late ? 'rental · over' : r.soon ? 'rental · due back soon' : 'rental'}</span>
  }
  if (m.jobId) return <span style={chipBlue}>on {m.jobWords?.split(' · ')[0] ?? 'a job'}</span>
  return <span style={chipGreen}>in the yard</span>
}

/* ------------------------------------------------------------------ the block editor's row */

export function BlockMachinesRow({ jobId, day, userId }: { jobId: string | null; day: string; userId: string | null }) {
  const { plan, problem } = useDayPlan(jobId && day ? day : null)
  const [picking, setPicking] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const today = todayDay()
  if (!jobId || !day) return null
  const job = jobId
  const planned = plan ? assignmentsFor(plan.assignments, job, day) : []
  const rest = plan ? plan.machines.filter((m) => !planned.some((a) => a.machineId === m.id)) : []
  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setFailed(null)
    try {
      await fn()
    } catch (e) {
      setFailed(formatErrorMessage(e, 'That did not save.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ border: '1.5px solid var(--border-strong)', borderRadius: 10, padding: '0.5rem 0.65rem', marginBottom: '0.75rem', display: 'grid', gap: '0.4rem' }} data-block-machines={planned.length}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.875rem' }}>Equipment on this job</b>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>saves as you add it, whether or not the block is saved</span>
      </div>
      {problem ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{problem}</span> : null}
      {failed ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{failed}</span> : null}
      {planned.map((a) => {
        const m = plan?.machines.find((x) => x.id === a.machineId)
        if (!m || !plan) return null
        const clash = assignmentClash(plan.assignments, m.id, day, job)
        return (
          <div key={a.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.2rem 0.5rem', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }} data-block-machine={m.unitLabel}>
            <b style={{ fontSize: '0.875rem', gridColumn: 1, gridRow: 1 }}>
              {m.kind === 'directional_drill' ? '🛠' : '🚜'} {machineName(m)}
            </b>
            <button type="button" style={{ ...quiet, gridColumn: 2, gridRow: '1 / span 2' }} disabled={busy} onClick={() => void run(() => removeAssignment(a))}>
              Remove
            </button>
            <span style={{ gridColumn: 1, gridRow: 2, fontSize: '0.75rem', color: 'var(--text-700)', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {placeChip(m, plan.checks, today)}
              {clash ? <span style={chipRed}>also on {clash.jobWords.split(' · ')[0]} that day</span> : null}
              <BroughtBy value={a.broughtBy} onSave={(v) => void run(() => patchAssignment(a, { broughtBy: v }))} />
            </span>
          </div>
        )
      })}
      {picking && plan ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, display: 'grid' }} data-machine-picker>
          {rest.map((m) => {
            const clash = assignmentClash(plan.assignments, m.id, day, job)
            return (
              <button key={m.id} type="button" disabled={busy} style={{ ...press, minHeight: 40, borderRadius: 0, border: 'none', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', textAlign: 'left', alignItems: 'center' }} onClick={() => void run(async () => { await addAssignment({ machineId: m.id, jobId: job, day, createdBy: userId }); setPicking(false) })}>
                <span>
                  <span style={{ display: 'block' }}>{machineName(m)}</span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {m.rental ? rentalWords(m.rental, today).words : m.jobId ? `On ${m.jobWords}` : 'In the yard'}
                    {clash ? ` · planned on ${clash.jobWords} that day` : ''}
                  </span>
                </span>
                {clash ? <span style={chipRed}>on {clash.jobWords.split(' · ')[0]}</span> : placeChip(m, plan.checks, today)}
              </button>
            )
          })}
          {rest.length === 0 ? <span style={{ padding: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Every machine on the board is already on this job.</span> : null}
          <button type="button" style={{ ...quiet, borderRadius: '0 0 8px 8px', border: 'none', borderTop: '1px solid var(--border)' }} onClick={() => setPicking(false)}>
            Not now
          </button>
        </div>
      ) : (
        <button type="button" style={{ ...press, justifySelf: 'start' }} disabled={!plan} onClick={() => setPicking(true)}>
          + Add a machine
        </button>
      )}
    </div>
  )
}

/** Who brings it: typed, saved on blur or Enter. */
function BroughtBy({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onSave(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      placeholder="Who brings it"
      aria-label="Who brings it"
      style={{ ...field, minHeight: 28, flex: '1 1 8rem' }}
    />
  )
}

/* ------------------------------------------------------------------ the chips under a block */

export function BlockMachineChips({ jobId, day }: { jobId: string | null; day: string }) {
  const { plan } = useDayPlan(jobId ? day : null)
  if (!jobId || !plan) return null
  const planned = assignmentsFor(plan.assignments, jobId, day)
  if (planned.length === 0) return null
  return (
    <span style={{ display: 'inline-flex', gap: '0.2rem', flexWrap: 'wrap', marginTop: 3 }} data-block-machine-chips={planned.length}>
      {planned.map((a) => {
        const m = plan.machines.find((x) => x.id === a.machineId)
        if (!m) return null
        const clash = assignmentClash(plan.assignments, m.id, day, jobId)
        return (
          <span key={a.id} style={clash ? chipRed : chipBlue} title={clash ? `also on ${clash.jobWords} that day` : a.broughtBy ? `${a.broughtBy} brings it` : machineName(m)}>
            {m.unitLabel}
            {clash ? ` · also on ${clash.jobWords.split(' · ')[0]}` : a.broughtBy ? ` · ${a.broughtBy.split(' ')[0]}` : ''}
          </span>
        )
      })}
    </span>
  )
}

/* ------------------------------------------------------------------ the morning's question */

const ANSWER_WORDS: Record<ArrivalAnswer, string> = { here: 'Here, check it', later: 'Coming later', not_coming: 'Not coming' }

/** Who is pressing, from the host: the stops never read auth themselves, so a host drawn without the provider still draws. */
export interface StopWho {
  userId: string | null
  byName: string | null
}

/** *Is E-12 here?* for each machine planned today with no answer yet. Here opens the walk. Nothing when none wait. */
export function MachineArrivalStop({ jobId, jobWords, compact, userId, byName }: { jobId: string; jobWords: string; compact?: boolean } & StopWho) {
  const { data, reload } = useJobMachines(jobId)
  const today = todayDay()
  const [open, setOpen] = useState<Machine | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const waiting = data ? machinesOnJob(data, jobId, today).filter((x) => x.assignment && x.assignment.answer == null && lineState(data.checks, x.machine.id, today).kind === 'unchecked') : []
  // once Here is answered nothing waits, but the walk it opened stays up
  if (!data || (waiting.length === 0 && !open)) return null
  function answer(x: MachineOnJob, a: ArrivalAnswer) {
    if (!x.assignment) return
    answerArrival(x.assignment, x.machine, a)
      .then(() => {
        forgetDay(today)
        reload()
        if (a === 'here') setOpen({ ...x.machine, jobId, jobWords })
      })
      .catch((e) => setFailed(formatErrorMessage(e, 'The answer did not save.')))
  }
  return (
    <div data-machine-arrival={waiting.length} style={{ display: 'grid', gap: '0.4rem', marginTop: compact ? '0.35rem' : '0.75rem' }}>
      {failed ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{failed}</span> : null}
      {waiting.map((x) => (
        <div key={x.machine.id} style={{ border: '1.5px solid #d97706', background: 'var(--bg-amber-100)', borderRadius: 12, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.4rem' }}>
          <b style={{ fontSize: '0.9375rem' }}>Is {x.machine.unitLabel} here?</b>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
            {machineName(x.machine)} · {arrivalWords(x)}
          </span>
          <div role="group" aria-label={`Is ${x.machine.unitLabel} here`} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.35rem' }}>
            {(['here', 'later', 'not_coming'] as ArrivalAnswer[]).map((a) => (
              <button key={a} type="button" style={{ ...press, minHeight: 40, fontSize: '0.8125rem', ...(a === 'here' ? { background: '#16a34a', borderColor: '#16a34a', color: '#fff' } : {}) }} onClick={() => answer(x, a)}>
                {ANSWER_WORDS[a]}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not coming tells Dispatch; Coming later leaves the stop on the rail.</span>
        </div>
      ))}
      {open ? <MachineCheckSheet machine={open} questions={data.questions} checks={data.checks} kind="pre" jobId={jobId} jobWords={jobWords} userId={userId} byName={byName ?? 'Someone on the job'} zIndex={1300} onChanged={reload} onClose={() => { setOpen(null); reload() }} /> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ the leaving stop in the clock-out review */

/** One stop per machine on this job: the leaving check for a checked one, the walk for one never checked today. */
export function ClockOutMachinesStop({ jobId, jobWords, userId, byName }: { jobId: string | null; jobWords?: string } & StopWho) {
  const { data, reload } = useJobMachines(jobId ?? '')
  const today = todayDay()
  const [open, setOpen] = useState<{ m: Machine; kind: CheckKind } | null>(null)
  if (!jobId || !data) return null
  const on = machinesOnJob(data, jobId, today).filter((x) => lineState(data.checks, x.machine.id, today).kind !== 'unchecked' || x.placed)
  if (on.length === 0) return null
  return (
    <div style={{ display: 'grid', gap: '0.4rem', margin: '0.75rem 0' }} data-clock-out-machines={on.length}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Machines on this job</div>
      {on.map((x) => {
        const m = x.machine
        const lv = leaveState(data.checks, m.id, today)
        const st = lineState(data.checks, m.id, today)
        const left = lv.kind === 'left'
        return (
          <button
            key={m.id}
            type="button"
            style={{ ...press, minHeight: 52, textAlign: 'left', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.1rem 0.5rem', alignItems: 'center', padding: '0.4rem 0.7rem', borderRadius: 10, ...(left ? { borderColor: '#16a34a', background: 'var(--bg-green-100)' } : { borderColor: '#d97706', background: 'var(--bg-amber-100)' }) }}
            onClick={() => setOpen({ m, kind: st.kind === 'unchecked' ? 'pre' : 'post' })}
            data-clock-out-machine={lv.kind}
          >
            <b style={{ fontSize: '0.9375rem', gridColumn: 1, gridRow: 1 }}>{left ? `Left ${m.unitLabel}` : st.kind === 'unchecked' ? `${m.unitLabel} was never checked today` : `Leaving ${m.unitLabel}`}</b>
            <span style={{ gridColumn: 2, gridRow: '1 / span 2', fontWeight: 700, fontSize: '0.8125rem', color: left ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>{left ? 'Done ✓' : 'Open ›'}</span>
            <span style={{ gridColumn: 1, gridRow: 2, fontSize: '0.8125rem', color: 'var(--text-700)', fontWeight: 500 }}>
              {left && lv.kind === 'left'
                ? `${lv.check.byName} · ${clockWords(lv.check.signedAt ?? lv.check.startedAt)}${lv.check.hours != null ? ` · ${hoursWords(lv.check.hours)}` : ''}${lv.check.leftWhere ? ` · ${LEFT_WHERE_WORDS[lv.check.leftWhere].toLowerCase()}` : ''}`
                : st.kind === 'unchecked'
                  ? 'Walk it now, or leave it and the morning walk catches it'
                  : 'Hours, fuel, anything new wrong, and where it is tonight'}
            </span>
          </button>
        )
      })}
      {open ? <MachineCheckSheet machine={open.m} questions={data.questions} checks={data.checks} kind={open.kind} jobId={jobId} jobWords={jobWords ?? open.m.jobWords ?? ''} userId={userId} byName={byName ?? 'Someone on the job'} zIndex={1300} onChanged={reload} onClose={() => { setOpen(null); reload() }} /> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ the day rail's stops */

const railRow: CSSProperties = { display: 'grid', gridTemplateColumns: '14px minmax(0, 1fr) auto', gap: '0.4rem', alignItems: 'center', padding: '0.15rem 0.3rem 0.15rem 1.6rem', border: 'none', background: 'transparent', font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-700)', textAlign: 'left', cursor: 'pointer', width: '100%' }
const dot: CSSProperties = { width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border-strong)', display: 'inline-block', boxSizing: 'border-box' }

/** Under a job's row: *Check E-12 before you run it*, then *Leaving E-12 · hours and fuel*, each a press into its sheet. */
export function RailMachineStops({ jobId, jobWords, day, userId, byName }: { jobId: string | null; jobWords: string; day: string } & StopWho) {
  const { data, reload } = useJobMachines(jobId ?? '')
  const [open, setOpen] = useState<{ m: Machine; kind: CheckKind } | null>(null)
  if (!jobId || !data) return null
  const on = machinesOnJob(data, jobId, day).filter((x) => x.assignment?.answer !== 'not_coming')
  if (on.length === 0) return null
  return (
    <>
      {on.map((x) => {
        const m = x.machine
        const st = lineState(data.checks, m.id, day)
        const lv = leaveState(data.checks, m.id, day)
        const checked = st.kind === 'checked'
        const held = st.kind === 'held'
        return (
          <div key={m.id} data-rail-machine={m.unitLabel}>
            <button type="button" style={railRow} onClick={() => setOpen({ m, kind: 'pre' })}>
              <span style={checked ? { ...dot, background: '#16a34a', borderColor: '#16a34a' } : held ? { ...dot, borderColor: '#dc2626' } : { ...dot, borderColor: '#d97706' }} aria-hidden />
              <span>{checked && st.kind === 'checked' ? `${m.unitLabel} checked · ${st.check.byName} ${clockWords(st.check.signedAt ?? st.check.startedAt)}` : held ? `${m.unitLabel} held` : `Check ${m.unitLabel} before you run it`}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{checked ? '' : x.assignment?.broughtBy ? `${x.assignment.broughtBy.split(' ')[0]} brings it` : ''}</span>
            </button>
            {checked || lv.kind !== 'none' ? (
              <button type="button" style={railRow} onClick={() => setOpen({ m, kind: 'post' })}>
                <span style={lv.kind === 'left' ? { ...dot, background: '#16a34a', borderColor: '#16a34a' } : lv.kind === 'open' ? { ...dot, borderColor: '#d97706' } : dot} aria-hidden />
                <span>{lv.kind === 'left' ? `Left ${m.unitLabel} · ${clockWords(lv.check.signedAt ?? lv.check.startedAt)}${lv.check.leftWhere ? ` · ${LEFT_WHERE_WORDS[lv.check.leftWhere].toLowerCase()}` : ''}` : `Leaving ${m.unitLabel} · hours and fuel`}</span>
              </button>
            ) : null}
          </div>
        )
      })}
      {open ? <MachineCheckSheet machine={open.m} questions={data.questions} checks={data.checks} kind={open.kind} jobId={jobId} jobWords={jobWords} userId={userId} byName={byName ?? 'Someone on the job'} onChanged={reload} onClose={() => { setOpen(null); reload() }} /> : null}
    </>
  )
}
