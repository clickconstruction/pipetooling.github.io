import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { pageGate } from '../lib/roleGate'
import { useBidVsActualBurnInputs } from '../hooks/useBidVsActualBurnInputs'
import { useExpectedHours } from '../hooks/useExpectedHours'
import { useChecklistDocuments } from '../hooks/useChecklistDocuments'
import { checklistProgress, checklistStagesOf } from '../lib/jobs/checklistDocument'
import { DEFAULT_LINE_BUDGET_SETTINGS, lineBudgetEntryOf, lineBudgetFor, sumLineBudgets } from '../lib/jobs/lineBudgets'
import { resolveJobBudget, spendByComponent, type JobBudgetRowLike } from '../lib/jobs/jobBudget'
import { stageSharesOf, type StageShare } from '../lib/jobs/stageShares'
import { readTargetMarginPct } from '../lib/jobs/jobBurnForVerdict'
import { superintendentLine, laborDaysOf, BUDGET_SOURCE_WORDS, type SuperintendentLine, type SuperintendentLineInput } from '../lib/jobs/superintendentLine'
import { EmptyState } from '../components/EmptyState'
import { PaceStrip } from '../components/jobMode/PaceStrip'
import { DayDetailsModal, DayHoverCard } from '../components/jobMode/DayDetailsModal'
import ResponsiveModalShell from '../components/ResponsiveModalShell'
import type { JobChargeEvent, JobValueEvent } from '../lib/jobChargesTimeline'

/**
 * The projects board (design spike, punch list #234): one row per working
 * project for the leader and the office — where it stands at this pace, the
 * money beside the hours, the budget's source — with the expected hours edited
 * in the row, in the open: who, when, from → to and why, a history strip with
 * Undo, and a door to the phone as the superintendent sees it. The spike reads
 * the projects and their hours the way the Costs tab does and keeps the targets
 * in browser storage; the build writes them as the job's typed budget with a
 * change log, and the bonus baseline stays frozen apart from them.
 */
type ProjectRow = {
  id: string
  hcp_number: string
  click_number: string
  job_name: string
  job_address: string
  status: string
  pct_complete: number | null
  revenue: number | null
  bid_id: string | null
  last_work_date: string | null
  fixtures: Array<{ id: string; name: string; stage_kind: string | null; line_kind: string; line_unit_price: number | null; count: number; progress_pct: number | null; sequence_order: number }>
}

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem' }
const field: CSSProperties = { padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.85rem' }

async function loadWorkingProjects(): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from('jobs_ledger')
    .select('id, hcp_number, click_number, job_name, job_address, status, pct_complete, revenue, bid_id, last_work_date, fixtures:jobs_ledger_fixtures(id, name, stage_kind, line_kind, line_unit_price, count, progress_pct, sequence_order)')
    .eq('status', 'working')
    .order('hcp_number', { ascending: false })
    .limit(200)
  if (error) throw error
  const rows = (data ?? []) as unknown as ProjectRow[]
  // A project, until #238's kind lands: a stage line In order, or a working job priced at $25k and up.
  return rows.filter((r) => (r.fixtures ?? []).some((f) => f.stage_kind === 'order') || (r.revenue != null && Number(r.revenue) >= 25000))
}

export default function DevProjectsBoard() {
  const { loading, user, role, profileName } = useAuth()
  const [rows, setRows] = useState<ProjectRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    let gone = false
    loadWorkingProjects()
      .then((r) => {
        if (!gone) setRows(r)
      })
      .catch((e: unknown) => {
        if (!gone) setLoadError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      gone = true
    }
  }, [])
  const ids = useMemo(() => (rows ?? []).map((r) => r.id), [rows])
  const burn = useBidVsActualBurnInputs(ids.length > 0, ids)
  const [budgets, setBudgets] = useState<Map<string, JobBudgetRowLike>>(new Map())
  useEffect(() => {
    if (ids.length === 0) return
    let gone = false
    void supabase
      .from('job_budgets')
      .select('job_id, kind, labor_hours, labor_rate, labor_usd, materials_usd, subs_usd, other_usd, total_direct_usd, completeness')
      .in('job_id', ids)
      .then(({ data }) => {
        if (gone) return
        const m = new Map<string, JobBudgetRowLike>()
        for (const r of (data ?? []) as Array<JobBudgetRowLike & { job_id: string }>) m.set(r.job_id, r)
        setBudgets(m)
      })
    return () => {
      gone = true
    }
  }, [ids])
  const targets = useExpectedHours()
  const who = profileName ?? 'the office'

  const gate = pageGate({ loading, user, role }, (r) => r === 'dev' || r === 'master_technician' || r === 'assistant' || r === 'controller')
  if (gate === 'wait') return null
  if (gate === 'away') return <Navigate to="/dashboard" replace />

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem', display: 'grid', gap: '1rem' }} data-testid="dev-projects-board">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Projects · where each one stands</h1>
          <p style={{ ...muted, margin: '0.2rem 0 0' }}>Every working project with a stage In order, worst first. Expected hours is the leader's target, set in the open: who, when, from what and why, and the superintendent's phone says so. Spike: targets live in this browser.</p>
        </div>
        <span style={muted}>{rows ? `${rows.length} projects` : loadError ? 'could not load' : 'loading…'}</span>
      </div>
      {targets.history.length ? (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} data-testid="targets-history">
          <span style={{ fontWeight: 600 }}>Recent changes</span>
          {targets.history.slice(0, 4).map((h, i) => (
            <span key={i} style={muted}>
              {rows?.find((r) => r.id === h.jobId)?.job_name ?? h.jobId} · {h.from != null ? `${Math.round(h.from)} → ` : ''}{h.hours ? `${h.hours} h` : 'budget'} · {h.by} · {h.why}
            </span>
          ))}
          <button type="button" style={{ ...link, marginLeft: 'auto' }} onClick={targets.undoLatest}>Undo the last change</button>
        </div>
      ) : null}
      {loadError ? <p style={{ color: 'var(--text-red-700)' }}>{loadError}</p> : null}
      {rows && rows.length === 0 ? <EmptyState compact main="No working project carries a stage In order yet. Set stages on a job's Bill tab and it lands here." /> : null}
      {rows && rows.length > 0 ? <Board rows={rows} burn={burn.inputsByJob} budgets={budgets} targets={targets} who={who} canEdit={role !== 'superintendent'} /> : null}
    </div>
  )
}

type Targets = ReturnType<typeof useExpectedHours>

function Board({ rows, burn, budgets, targets, who, canEdit }: { rows: ProjectRow[]; burn: ReturnType<typeof useBidVsActualBurnInputs>['inputsByJob']; budgets: Map<string, JobBudgetRowLike>; targets: Targets; who: string; canEdit: boolean }) {
  const settings = DEFAULT_LINE_BUDGET_SETTINGS
  const target = readTargetMarginPct() ?? 20
  const checklists = useChecklistDocumentsAll(rows)
  const cards = rows.map((r) => {
    const inputs = burn.get(r.id)
    const ready = inputs && inputs !== 'error' ? inputs : null
    const sums = sumLineBudgets(
      (r.fixtures ?? []).filter((f) => f.line_kind !== 'discount').map((f) => ({ priceUsd: (Number(f.line_unit_price) || 0) * (Number(f.count) || 1), entry: lineBudgetFor(lineBudgetEntryOf(f as Parameters<typeof lineBudgetEntryOf>[0]), f.name, settings), pctDone: f.progress_pct != null ? Number(f.progress_pct) : null })),
      settings,
    )
    const priceUsd = ready?.revenue ?? (r.revenue != null ? Number(r.revenue) : null) ?? (sums.priceUsd > 0 ? sums.priceUsd : null)
    const resolved = resolveJobBudget({ row: budgets.get(r.id), priceUsd, targetMarginPct: target })
    const baseHours = resolved.components && resolved.components.laborHours > 0 ? resolved.components.laborHours : sums.laborHours
    const baseSource: SuperintendentLineInput['budgetSource'] = resolved.components && resolved.components.laborHours > 0 ? resolved.source : 'assumed'
    const t = targets.byJob[r.id]
    // The stages' shares of the labor budget, in order; the strip divides its track by them.
    const stages = stageSharesOf(r.fixtures ?? [], settings)
    const spentUsd = ready ? spendByComponent(ready.chargeEvents).totalUsd : null
    const budgetUsd = resolved.directUsd ?? (priceUsd != null ? priceUsd * (1 - target / 100) : null)
    // The line's input, kept so a drag on the slider re-reads it live.
    const input: SuperintendentLineInput = {
      pctDone: r.pct_complete != null ? Number(r.pct_complete) : null,
      hoursUsed: ready ? ready.teamHours : null,
      laborDays: ready ? laborDaysOf(ready.chargeEvents) : [],
      hoursBudget: t ? t.hours : baseHours,
      budgetSource: t ? 'target' : baseSource,
      target: t ? { by: t.by, at: t.at, from: t.from, why: t.why } : null,
      money: spentUsd != null && budgetUsd != null ? { spentUsd, budgetUsd } : null,
      plannedFinishYmd: null,
      checklist: checklists.get(r.id) ?? { answered: 0, asked: 0 },
      certifiedPct: null,
    }
    return { row: r, input, line: superintendentLine(input), baseHours, baseSource, stages, target: t, loading: inputs == null, failed: inputs === 'error', events: ready?.chargeEvents ?? [], valueEvents: ready?.valueEvents ?? [] }
  })
  // Worst first: money leading, then behind by days, then the rest; early (no reading) last.
  const rank = (l: SuperintendentLine) => (l.tone === 'behind' ? (l.money?.leads ? 0 : 1) : l.tone === 'even' ? 2 : l.tone === 'ahead' ? 3 : 4)
  cards.sort((a, b) => rank(a.line) - rank(b.line) || a.line.days - b.line.days)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }} data-testid="projects-cards">
      {cards.map((x) => (
        <BoardCard key={x.row.id} x={x} targets={targets} who={who} canEdit={canEdit} />
      ))}
    </div>
  )
}

type CardInput = { row: ProjectRow; input: SuperintendentLineInput; line: SuperintendentLine; baseHours: number; baseSource: SuperintendentLineInput['budgetSource']; stages: StageShare[]; target: Targets['byJob'][string] | undefined; loading: boolean; failed: boolean; events: readonly JobChargeEvent[]; valueEvents: readonly JobValueEvent[] }

/**
 * One project as one picture: the pace strip, the expected hours as a slider
 * under it whose drag re-reads the strip live, and a reason box that appears
 * only once the handle moved. Hover a day and the day comes off the cursor;
 * a press on the title or on the space around the controls opens the same
 * card large, with a long slider, a typed number and a day either way, for a
 * finer hand. The words stay small and at the edges.
 */
function CardBody({ x, targets, who, canEdit, big = false, onExpand }: { x: CardInput; targets: Targets; who: string; canEdit: boolean; big?: boolean; onExpand?: () => void }) {
  const { row } = x
  const current = Math.round(x.target?.hours ?? x.baseHours)
  const [draft, setDraft] = useState<number | null>(null)
  const [why, setWhy] = useState('')
  const [day, setDay] = useState<string | null>(null)
  const [hover, setHover] = useState<{ ymd: string; x: number; y: number } | null>(null)
  const hours = draft ?? current
  const line = draft != null ? superintendentLine({ ...x.input, hoursBudget: draft, budgetSource: 'target', target: null }) : x.line
  const used = x.input.hoursUsed ?? 0
  // The slider is the labor budget's range: from the hours already in to the budget's edge. Past the edge is over
  // budget, and there is nothing to set there; under the edge is the whole point.
  const budgetEdge = Math.max(1, Math.round(x.baseHours))
  const min = Math.min(budgetEdge, Math.floor(used))
  const max = budgetEdge
  // Within an hour of the edge counts as at it: a one-hour slider sets nothing.
  const overBudget = x.baseHours > 0 && used + 1 > x.baseHours
  const overBy = Math.max(0, Math.round(used - x.baseHours))
  const moved = draft != null && draft !== current
  const ok = moved && why.trim().length > 2
  const jobNo = `J${row.hcp_number || row.click_number}`
  const jobLabel = `${jobNo} · ${row.job_name}`
  const toneBorder = line.tone === 'behind' ? '#dc2626' : line.tone === 'ahead' ? '#16a34a' : 'var(--border)'
  const dayStep = line.hoursPerDayRead ? Math.max(1, Math.round(line.hoursPerDay)) : 1
  const nudge = (d: number) => setDraft(Math.max(min, Math.min(max, hours + d)))
  const keep = () => {
    targets.setTarget(row.id, hours, current, who, why.trim())
    setDraft(null)
    setWhy('')
  }
  // The whole card is the door to the large view: a press on the title or on any space around the
  // controls opens it; a press on a control (the slider, a day, a link, a press) does what it says.
  const opens = !big && onExpand
  const openUnlessControl = (e: MouseEvent<HTMLDivElement>) => {
    if (!opens) return
    const el = e.target as HTMLElement
    if (el.closest('button, a, input, textarea, select, label, [role="dialog"]')) return
    onExpand()
  }
  return (
    <div data-testid={big ? 'board-card-big' : 'board-card'} onClick={openUnlessControl} title={opens ? 'Open this project large' : undefined} style={{ border: big ? 'none' : `1.5px solid ${toneBorder}`, borderRadius: 12, padding: big ? 0 : '0.7rem 0.8rem', display: 'grid', gap: big ? 14 : 8, background: 'var(--surface)', cursor: opens ? 'pointer' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {opens ? (
          <button type="button" onClick={onExpand} aria-label={`Open ${row.job_name} large`} style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}>{jobLabel}</button>
        ) : (
          <span style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: big ? '1.1rem' : undefined }}>{jobLabel}</span>
        )}
        {big ? <span style={{ ...muted }}>{row.job_address}</span> : null}
        <Link to={`/dev/job-mode-preview?job=${row.id}`} style={link} title="The superintendent's phone on this job">📱</Link>
      </div>
      {x.loading ? <div style={{ ...muted, height: 22 }}>loading…</div> : x.failed ? <div style={{ ...muted, height: 22 }}>read failed</div> : (
        <PaceStrip line={line} hoursBudget={Math.max(budgetEdge, used)} targetHours={hours} days={x.input.laborDays ?? []} stages={x.stages.map((s) => ({ name: s.name, hours: (s.sharePct / 100) * budgetEdge, laborUsd: s.laborUsd, pctDone: s.pctDone }))} stageWords={big} onDay={setDay} onDayHover={(ymd, px, py) => setHover(ymd ? { ymd, x: px, y: py } : null)} height={big ? 40 : 22} />
      )}
      {hover ? <DayHoverCard jobLabel={jobLabel} ymd={hover.ymd} x={hover.x} y={hover.y} events={x.events} valueEvents={x.valueEvents} /> : null}
      {day ? <DayDetailsModal jobLabel={jobLabel} ymd={day} events={x.events} valueEvents={x.valueEvents} onClose={() => setDay(null)} /> : null}
      <div style={{ display: 'grid', gap: big ? 8 : 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: big ? '0.9rem' : '0.78rem' }}>
          <span style={{ flex: '0 0 auto', color: 'var(--text-muted)' }}>expected</span>
          {big && canEdit ? <button type="button" style={{ ...link, fontSize: '1rem', fontWeight: 700 }} onClick={() => nudge(-dayStep)} aria-label="One day less">−</button> : null}
          {/* The handle snaps to this job's crew days once it has worked two, so a drag reads as days added or taken away. */}
          <input type="range" min={min} max={max} step={dayStep} value={Math.max(min, Math.min(max, hours))} disabled={!canEdit || overBudget} title={overBudget ? 'Over the labor budget already; the budget is the lever now, not the target' : `${min} h in · the labor budget ends at ${max} h`} aria-label={`Expected hours for ${row.job_name}`} onChange={(e) => setDraft(Number(e.target.value))} style={{ flex: 1, margin: 0, accentColor: moved ? '#2563eb' : '#9ca3af', height: big ? 36 : 24 }} />
          {big && canEdit ? <button type="button" style={{ ...link, fontSize: '1rem', fontWeight: 700 }} onClick={() => nudge(dayStep)} aria-label="One day more">+</button> : null}
          {big && canEdit ? (
            <input type="text" inputMode="numeric" value={hours} aria-label="Expected hours, typed" onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v !== '') setDraft(Math.max(min, Math.min(max, Number(v)))) }} style={{ ...field, width: 72, textAlign: 'right', fontWeight: 700 }} />
          ) : (
            <span style={{ flex: '0 0 auto', fontVariantNumeric: 'tabular-nums', fontWeight: 700, minWidth: 56, textAlign: 'right' }}>{hours} h</span>
          )}
          <span style={{ flex: '0 0 auto', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }} title={line.daysLeft != null ? `${Math.round(line.daysLeft)} days left at ${Math.round(line.hoursPerDay)} h a day` : undefined}>
            {big ? 'h' : ''}{line.daysLeft != null && line.tone !== 'early' ? ` · ${Math.round(line.daysLeft)} d left` : ''}
          </span>
          <span style={{ flex: '0 0 auto', color: 'var(--text-muted)' }} title={BUDGET_SOURCE_WORDS[moved || x.target ? 'target' : x.baseSource]}>{BUDGET_SOURCE_WORDS[moved || x.target ? 'target' : x.baseSource].split(' ')[0]}</span>
        </div>
        {overBudget ? <div style={{ fontSize: big ? '0.84rem' : '0.74rem', color: 'var(--text-red-700)' }}>{overBy > 0 ? `Over the labor budget by ${overBy} h.` : 'At the labor budget’s edge.'} The budget is the lever now, on the Costs tab, not the target.</div> : null}
        {big ? <div style={{ ...muted }}>{budgetEdge} h labor budget · expected {hours} h · {Math.round(used)} h in · {Math.round(line.hoursPerDay)} h a day{line.hoursPerDayRead ? ' on this job' : ' assumed'}{line.daysUsed != null ? ` · ${Math.round(line.daysUsed)} days in` : ''} · the slider runs from {min} h in to the budget's edge at {max} h</div> : null}
        {moved ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }} data-testid="target-edit">
            <input type="text" value={why} onChange={(e) => setWhy(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ok) keep() }} maxLength={120} aria-label="Why" placeholder={`why ${current} → ${hours} h · the superintendent reads this`} style={{ ...field, flex: '1 1 200px' }} autoFocus />
            <button type="button" disabled={!ok} style={{ ...link, fontWeight: 700, opacity: ok ? 1 : 0.45 }} onClick={keep}>Keep it</button>
            <button type="button" style={{ ...link, color: 'var(--text-muted)' }} onClick={() => { setDraft(null); setWhy('') }}>Put it back</button>
          </div>
        ) : x.line.targetLine ? (
          <div style={{ ...muted, fontSize: big ? '0.84rem' : '0.74rem' }}>🎯 {x.line.targetLine}{canEdit ? <> · <button type="button" style={{ ...link, fontSize: 'inherit' }} onClick={() => targets.clearTarget(row.id, who)}>back to the budget</button></> : null}</div>
        ) : null}
      </div>
      {line.move && !moved ? <div style={{ fontSize: big ? '0.9rem' : '0.76rem', color: 'var(--text-700)' }}>{line.move.why}</div> : null}
      {big ? <div style={{ ...muted }}>{line.proofWords}</div> : null}
    </div>
  )
}

function BoardCard({ x, targets, who, canEdit }: { x: CardInput; targets: Targets; who: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <CardBody x={x} targets={targets} who={who} canEdit={canEdit} onExpand={() => setOpen(true)} />
      {open ? (
        <ResponsiveModalShell title="Project, large" onRequestClose={() => setOpen(false)} maxWidthDesktop={960} zIndex={1150}>
          <CardBody x={x} targets={targets} who={who} canEdit={canEdit} big />
        </ResponsiveModalShell>
      ) : null}
    </>
  )
}

/** The checklist counts per job from the spike's store, read once for the board. */
function useChecklistDocumentsAll(rows: ProjectRow[]): Map<string, { answered: number; asked: number }> {
  // The store is one snapshot for every job; one hook call per job would be a loop of hooks, so read the store's company items through a single job and count by hand.
  const first = rows[0]?.id ?? '_'
  const api = useChecklistDocuments(first)
  return useMemo(() => {
    const m = new Map<string, { answered: number; asked: number }>()
    for (const r of rows) {
      let answered = 0
      let asked = 0
      for (const s of checklistStagesOf(r.fixtures ?? [])) {
        // Only the first job's own items are in `api`; company items apply to every job, which is what the board counts.
        const items = api.companyItems.filter((i) => i.retiredAt == null && i.kind === s.kind)
        const p = checklistProgress(items, r.id === first ? api.stageAnswers(s.fixtureId) : new Map())
        answered += p.answered
        asked += p.asked
      }
      m.set(r.id, { answered, asked })
    }
    return m
  }, [rows, api, first])
}
