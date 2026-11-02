import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { pageGate } from '../lib/roleGate'
import { fetchJobWithDetailsById } from '../lib/fetchJobWithDetailsById'
import type { JobWithDetails } from '../types/jobWithDetails'
import { CostBatchJobPicker } from '../components/costBatches/CostBatchJobPicker'
import { useJobChargesTimelineInputs } from '../hooks/useJobChargesTimelineInputs'
import { useChecklistDocuments } from '../hooks/useChecklistDocuments'
import { checklistProgress, checklistStagesOf, progressWords } from '../lib/jobs/checklistDocument'
import { DEFAULT_LINE_BUDGET_SETTINGS, lineBudgetEntryOf, lineBudgetFor, sumLineBudgets } from '../lib/jobs/lineBudgets'
import { superintendentLine, laborDaysOf } from '../lib/jobs/superintendentLine'
import { useJobBudget } from '../hooks/useJobBudget'
import { useExpectedHours } from '../hooks/useExpectedHours'
import { resolveJobBudget, spendByComponent } from '../lib/jobs/jobBudget'
import { readTargetMarginPct } from '../lib/jobs/jobBurnForVerdict'
import { buildJobModePressBar, DAY_PRESS_COLORS, DAY_PRESS_TEXT, pickJobModeDayPress, type PressBarRows } from '../lib/jobMode/pressBar'
import type { JobModeState } from '../lib/jobModePickCurrentNext'
import type { Leg } from '../lib/jobMode/onMyWay'
import type { UserRole } from '../hooks/useAuth'
import { ChecklistDocumentSheet, type SheetStage } from '../components/stageChecklists/ChecklistDocumentSheet'
import JobModeDetailsSection from '../components/jobMode/JobModeDetailsSection'
import { PaceStrip } from '../components/jobMode/PaceStrip'
import { DayDetailsModal, DayHoverCard } from '../components/jobMode/DayDetailsModal'

/**
 * See job mode (design spike, punch list #234 PR 3 and #237 PR 5): a dev-only
 * page that draws the phone as one teammate would see it on one job — pick the
 * job, pick who is looking, pick where their day stands — with the new visuals
 * in place: the superintendent's line (ahead or behind at this pace, the bars,
 * the planned finish, the proof, the one move) and the stage checklists' count
 * on the crew's card. The pieces are the real ones where they take a job id
 * (the details section, the press bar's kernel); the card's own reads (the
 * clock, today's schedule) are stood in for by the day chips.
 */
type Persona = 'technician' | 'helpers' | 'subcontractor' | 'superintendent'
const PERSONAS: Array<{ id: Persona; words: string }> = [
  { id: 'technician', words: 'Technician' },
  { id: 'helpers', words: 'Helper' },
  { id: 'subcontractor', words: 'Sub' },
  { id: 'superintendent', words: 'Superintendent' },
]
type Day = { id: string; words: string; leg: Leg; state: JobModeState; sessionOpen: boolean; hasNext: boolean }
const DAYS: Day[] = [
  { id: 'start', words: 'Not clocked in', leg: 'unmarked', state: 'not-clocked-in-with-schedule', sessionOpen: false, hasNext: true },
  { id: 'way', words: 'On the way', leg: 'on-the-way', state: 'not-clocked-in-with-schedule', sessionOpen: true, hasNext: true },
  { id: 'here', words: 'On the job', leg: 'on-site', state: 'on-scheduled-job-not-last', sessionOpen: true, hasNext: true },
  { id: 'last', words: 'Last job today', leg: 'on-site', state: 'on-scheduled-job-last', sessionOpen: true, hasNext: false },
]

const chip = (on: boolean): CSSProperties => ({ borderRadius: 999, border: `1.5px solid ${on ? 'var(--text-strong)' : 'var(--border)'}`, background: on ? 'var(--text-strong)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--text-700)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.25rem 0.7rem', cursor: 'pointer' })
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }

export default function DevJobModePreview() {
  const { loading, user, role } = useAuth()
  const [job, setJob] = useState<JobWithDetails | null>(null)
  const [persona, setPersona] = useState<Persona>('superintendent')
  const [day, setDay] = useState<Day>(DAYS[2]!)
  const [pending, setPending] = useState<string | null>(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('job') : null))

  useEffect(() => {
    if (!pending) return
    let gone = false
    void fetchJobWithDetailsById(pending).then((j) => {
      if (!gone) setJob(j)
    })
    return () => {
      gone = true
    }
  }, [pending])

  const gate = pageGate({ loading, user, role }, (r) => r === 'dev')
  if (gate === 'wait') return null
  if (gate === 'away') return <Navigate to="/dashboard" replace />

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem', display: 'grid', gap: '1rem' }} data-testid="dev-job-mode-preview">
      <div>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>See job mode</h1>
        <p style={{ ...muted, margin: '0.2rem 0 0' }}>Pick a job, pick who is looking and where their day stands, and read the phone as they would. Spike: the superintendent's line and the checklist count are new; the clock and the schedule are stood in for by the day chips.</p>
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '1rem', flex: '1 1 320px', minWidth: 0 }}>
          <CostBatchJobPicker title="Job" placeholder="Search a job by number, name or address" onPick={(j) => setPending(j.id)} autoFocus />
          <div>
            <div style={muted}>Who is looking</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {PERSONAS.map((p) => (
                <button key={p.id} type="button" style={chip(persona === p.id)} onClick={() => setPersona(p.id)} aria-pressed={persona === p.id}>{p.words}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={muted}>Where their day stands</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {DAYS.map((d) => (
                <button key={d.id} type="button" style={chip(day.id === d.id)} onClick={() => setDay(d)} aria-pressed={day.id === d.id}>{d.words}</button>
              ))}
            </div>
          </div>
          {job ? <div style={muted}>{job.job_name} · J{job.hcp_number || job.click_number} · {job.status} · {job.pct_complete ?? '—'}% done on the job</div> : <div style={muted}>No job picked yet.</div>}
        </div>
        <PhoneFrame>{job ? <Phone key={`${job.id}-${persona}-${day.id}`} job={job} persona={persona} day={day} /> : <div style={{ ...muted, padding: '2rem 1rem', textAlign: 'center' }}>Pick a job to draw the phone.</div>}</PhoneFrame>
      </div>
    </div>
  )
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 390, height: 800, border: '10px solid #111', borderRadius: 36, background: 'var(--bg)', overflow: 'hidden', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }} data-testid="phone-frame">
      <div style={{ height: 24, background: '#111', flex: 'none' }} />
      {/* The phone scrolls under a bar pinned to its foot, the way the real card's press bar fixes itself to the viewport. */}
      <div style={{ padding: '0.75rem 0.75rem 7rem', display: 'grid', gap: '0.75rem', minWidth: 0, overflowX: 'hidden', overflowY: 'auto', overflowWrap: 'anywhere', flex: 1, alignContent: 'start' }}>{children}</div>
    </div>
  )
}

function Phone({ job, persona, day }: { job: JobWithDetails; persona: Persona; day: Day }) {
  const inputs = useJobChargesTimelineInputs(job, true)
  const teamHours = inputs.kind === 'ready' ? inputs.inputs.teamHours : null
  const api = useChecklistDocuments(job.id)
  const stages: SheetStage[] = useMemo(() => checklistStagesOf(job.fixtures ?? []), [job.fixtures])
  const [sheet, setSheet] = useState<SheetStage | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [hover, setHover] = useState<{ ymd: string; x: number; y: number } | null>(null)
  const settings = DEFAULT_LINE_BUDGET_SETTINGS
  const budget = useMemo(() => {
    const lines = (job.fixtures ?? [])
      .filter((f) => f.line_kind !== 'discount')
      .map((f) => ({ priceUsd: (Number(f.line_unit_price) || 0) * (Number(f.count) || 1), entry: lineBudgetFor(lineBudgetEntryOf(f), f.name, settings), pctDone: f.progress_pct != null ? Number(f.progress_pct) : null }))
    return sumLineBudgets(lines, settings)
  }, [job.fixtures, settings])
  const checklist = useMemo(() => {
    let answered = 0
    let asked = 0
    for (const s of stages) {
      const p = checklistProgress(api.stageItems(s.kind, s.fixtureId), api.stageAnswers(s.fixtureId))
      answered += p.answered
      asked += p.asked
    }
    return { answered, asked }
  }, [stages, api])
  // The Costs tab's baseline, resolved the way the tab resolves it: the bid's hours, the typed hours, else assumed.
  const jobBudget = useJobBudget(job.id, job.bid_id ?? null, true)
  // The price the Costs tab reads: the timeline's revenue, else the job's, else the lines' sum.
  const priceUsd = (inputs.kind === 'ready' ? inputs.inputs.revenue : null) ?? (job.revenue != null ? Number(job.revenue) : null) ?? (budget.priceUsd > 0 ? budget.priceUsd : null)
  const resolved = useMemo(() => resolveJobBudget({ row: jobBudget.row, priceUsd, targetMarginPct: readTargetMarginPct() }), [jobBudget.row, priceUsd])
  const targets = useExpectedHours()
  const expected = targets.byJob[job.id]
  const baseHours = resolved.components && resolved.components.laborHours > 0 ? resolved.components.laborHours : budget.laborHours
  const hoursBudget = expected ? expected.hours : baseHours
  const budgetSource = expected ? ('target' as const) : resolved.components && resolved.components.laborHours > 0 ? resolved.source : 'assumed'
  const spentUsd = inputs.kind === 'ready' ? spendByComponent(inputs.inputs.chargeEvents).totalUsd : null
  // A budget row with no total (a bid that carried hours only) reads its dollars the assumed way, as the Costs tab's partial rule does.
  const target = readTargetMarginPct() ?? 20
  const budgetUsd = resolved.directUsd ?? (priceUsd != null ? priceUsd * (1 - target / 100) : null)
  const money = spentUsd != null && budgetUsd != null ? { spentUsd, budgetUsd } : null
  const line = superintendentLine({ pctDone: job.pct_complete != null ? Number(job.pct_complete) : null, hoursUsed: teamHours, laborDays: inputs.kind === 'ready' ? laborDaysOf(inputs.inputs.chargeEvents) : [], hoursBudget, budgetSource, target: expected ? { by: expected.by, at: expected.at, from: expected.from, why: expected.why } : null, money, plannedFinishYmd: null, checklist, certifiedPct: null })
  const role = persona as UserRole
  const dayPress = pickJobModeDayPress({ leg: day.leg, state: day.state, hasNextBlock: day.hasNext, canClockOut: persona !== 'superintendent' })
  const rows = buildJobModePressBar({ dayPress, role, sessionOpen: day.sessionOpen, canClockOut: persona !== 'superintendent', hasCurrentJob: day.sessionOpen })
  const nextOpenStage = stages.find((s) => api.stageState(s.fixtureId).open && api.stageItems(s.kind, s.fixtureId).length > 0) ?? stages[0] ?? null
  const jobLabel = `J${job.hcp_number || job.click_number}`

  return (
    <>
      <div>
        <div style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{persona === 'superintendent' ? 'Your projects' : 'Today'}</div>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.25 }}>{jobLabel} · {job.job_name}</div>
        <div style={{ ...muted }}>{job.job_address}</div>
        <div style={muted} data-testid="job-mode-leg">{day.leg === 'on-the-way' ? 'On your way · say when you are there' : day.sessionOpen ? 'On site · clocked in' : 'Not clocked in yet'}</div>
      </div>

      {persona === 'superintendent' ? (
        <>
          <SuperintendentCard line={line} hoursBudget={hoursBudget} days={inputs.kind === 'ready' ? laborDaysOf(inputs.inputs.chargeEvents) : []} onDay={setOpenDay} onDayHover={(ymd, px, py) => setHover(ymd ? { ymd, x: px, y: py } : null)} jobName={job.job_name} onSetPct={() => undefined} onOpenChecklist={() => nextOpenStage && setSheet(nextOpenStage)} />
          {openDay && inputs.kind === 'ready' ? <DayDetailsModal jobLabel={`${jobLabel} · ${job.job_name}`} ymd={openDay} events={inputs.inputs.chargeEvents} valueEvents={inputs.inputs.valueEvents} onClose={() => setOpenDay(null)} /> : null}
          {hover && inputs.kind === 'ready' ? <DayHoverCard jobLabel={`${jobLabel} · ${job.job_name}`} ymd={hover.ymd} x={hover.x} y={hover.y} events={inputs.inputs.chargeEvents} valueEvents={inputs.inputs.valueEvents} /> : null}
          <div style={{ ...muted, fontSize: '0.7rem' }} data-testid="superintendent-debug">
            spike reading · price {priceUsd != null ? `$${Math.round(priceUsd).toLocaleString()}` : '—'} · budget {budgetUsd != null ? `$${Math.round(budgetUsd).toLocaleString()} ${resolved.glyph} ${resolved.source}${jobBudget.row ? ` (row ${jobBudget.row.kind})` : ''}` : '—'} · spent {spentUsd != null ? `$${Math.round(spentUsd).toLocaleString()}` : `${inputs.kind}`}
          </div>
        </>
      ) : null}

      {stages.length > 0 ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '0.6rem 0.75rem', display: 'grid', gap: 6 }} data-testid="checklist-count-card">
          <div style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Checklists</div>
          {stages.map((s) => {
            const p = checklistProgress(api.stageItems(s.kind, s.fixtureId), api.stageAnswers(s.fixtureId))
            const st = api.stageState(s.fixtureId)
            const tone = st.filed ? 'var(--text-green-700)' : p.asked === 0 ? 'var(--text-muted)' : 'var(--text-amber-800)'
            return (
              <button key={s.fixtureId} type="button" onClick={() => setSheet(s)} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', gap: 8, alignItems: 'baseline', background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', minHeight: 32, color: 'inherit' }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span style={{ fontSize: '0.8rem', color: tone, minWidth: 0 }}>{st.filed ? 'filed ✓' : p.asked === 0 ? 'no list' : `${progressWords(p)}${p.next ? ` · next: ${p.next.words.slice(0, 40)}…` : ''}`}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {persona !== 'superintendent' ? <JobModeDetailsSection jobId={job.id} jobAddress={job.job_address} /> : null}

      <PressBar rows={rows} tone={dayPress.tone} />
      {sheet ? <ChecklistDocumentSheet jobLabel={jobLabel} stage={sheet} stages={stages} onSwitch={setSheet} plansUrl={job.job_plans_link ?? null} who={{ userId: null, name: PERSONAS.find((p) => p.id === persona)?.words ?? '' }} canAdd={persona === 'superintendent'} api={api} onClose={() => setSheet(null)} /> : null}
    </>
  )
}

/** The superintendent's line, the mock-up's card drawn from the job's own numbers. */
function SuperintendentCard({ line, hoursBudget, days, onDay, onDayHover, jobName, onSetPct, onOpenChecklist }: { line: ReturnType<typeof superintendentLine>; hoursBudget: number; days: ReadonlyArray<{ ymd: string; hours: number }>; onDay: (ymd: string) => void; onDayHover: (ymd: string | null, x: number, y: number) => void; jobName: string; onSetPct: () => void; onOpenChecklist: () => void }) {
  const border = line.tone === 'ahead' ? '#16a34a' : line.tone === 'behind' ? '#dc2626' : 'var(--border-strong)'
  const headColor = line.tone === 'ahead' ? 'var(--text-green-700)' : line.tone === 'behind' ? 'var(--text-red-700)' : 'var(--text-700)'
  return (
    <div style={{ border: `2px solid ${border}`, borderRadius: 12, padding: '0.7rem 0.8rem', display: 'grid', gap: 8, background: 'var(--surface)' }} data-testid="superintendent-line">
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{jobName} · {line.hoursWords}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: headColor }}>{line.headline}</div>
      <PaceStrip line={line} hoursBudget={hoursBudget} days={days} onDay={onDay} onDayHover={onDayHover} />
      {/* The strip's legend carries the money; the words stay for a plan that exists, a target that was set, and money that leads. */}
      {line.finishWords.startsWith('Planned') ? <div style={{ fontSize: '0.8rem' }}>{line.finishWords}</div> : null}
      {line.targetLine ? <div style={{ fontSize: '0.78rem', color: 'var(--text-700)', background: 'var(--bg-subtle)', borderRadius: 6, padding: '0.3rem 0.45rem' }} data-testid="superintendent-target">🎯 {line.targetLine}</div> : null}
      {line.money?.leads ? <div style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }} data-testid="superintendent-money">{line.money.words}</div> : null}
      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>{line.proofWords}</div>
      {line.move ? (
        <>
          <div style={{ fontSize: '0.85rem' }}>{line.move.why}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onSetPct} style={{ flex: 1, minHeight: 44, borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', font: 'inherit', fontWeight: 700, fontSize: '0.85rem' }}>Set the %</button>
            <button type="button" onClick={onOpenChecklist} style={{ flex: 1, minHeight: 44, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.85rem' }}>Open the checklist</button>
          </div>
        </>
      ) : null}
    </div>
  )
}

/** The press bar's rows drawn inside the frame (the real bar fixes itself to the viewport). */
function PressBar({ rows, tone }: { rows: PressBarRows; tone: keyof typeof DAY_PRESS_COLORS }) {
  const btn = (_label: string, disabled: boolean, primary = false): CSSProperties => ({ flex: 1, minHeight: 44, borderRadius: 10, border: primary ? 'none' : '1px solid var(--border-strong)', background: primary ? DAY_PRESS_COLORS[tone] : 'var(--surface)', color: primary ? DAY_PRESS_TEXT[tone] : 'var(--text-700)', font: 'inherit', fontWeight: 700, fontSize: '0.82rem', opacity: disabled ? 0.45 : 1 })
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0.5rem 0.6rem 0.7rem', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'grid', gap: 6 }} data-testid="press-bar">
      <div style={{ display: 'flex', gap: 6 }}>{rows.top.map((b) => <button key={b.id} type="button" disabled={b.disabled} style={btn(b.label, b.disabled)}>{b.label}</button>)}</div>
      <div style={{ display: 'flex', gap: 6 }}>{rows.bottom.map((b) => <button key={b.id} type="button" disabled={b.disabled} style={btn(b.label, b.disabled, b.id === 'day-press')}>{b.label}</button>)}</div>
    </div>
  )
}
