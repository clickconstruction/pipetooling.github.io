/**
 * GC mode, the real build, the schedule's PR 7b: one job's schedule on real data, read only (the
 * plan is to-dos/gc-mode/mockups/schedule-pr7.md on branch spike/gc-mode). It reads the schedule's
 * own rows over the board's job (`loadSchedule`) and draws what the prototype's Schedule tab draws
 * to look at: the measures, the chart with its links, spare days and holds, the list on a phone,
 * Print or PDF, Export, and the bar pressed (`GcScheduleBar`). Nothing moves yet (the schedule's
 * PR 8). Its one press is Draw a first draft, closed while we bid and on a lost job. The window
 * frames it (`GcScheduleWindow`); a project page mounts it unchanged the day the doors bring one.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { changeOrderTails } from '../../lib/gc/schedule/changeOrderDays'
import { chartHolds } from '../../lib/gc/schedule/chartHolds'
import { crewCountsNow } from '../../lib/gc/schedule/crewCounts'
import { customerDoneWords, customerSchedulePicture, customerStanding } from '../../lib/gc/schedule/customerSchedule'
import { lostDaysByLine } from '../../lib/gc/schedule/daysLost'
import { finishOutlook } from '../../lib/gc/schedule/finishOutlook'
import { ganttBars } from '../../lib/gc/schedule/gantt'
import type { GanttPrintJob } from '../../lib/gc/schedule/ganttPrint'
import { lateNoticeTails } from '../../lib/gc/schedule/lateNotices'
import { logChartGaps, logChartNotes } from '../../lib/gc/schedule/logVsChart'
import { uninsuredNotes } from '../../lib/gc/schedule/notReady'
import { peopleOnSite } from '../../lib/gc/schedule/peopleOnSite'
import { crowdedWeeks } from '../../lib/gc/schedule/places'
import { firstDraftAgainstBid, roughFirstDraftWords } from '../../lib/gc/schedule/rough'
import type { ScheduleRead } from '../../lib/gc/schedule/rows'
import { draftSchedule, scheduleMeasures } from '../../lib/gc/schedule/schedule'
import { draftRefusal, draftStart, draftWords } from '../../lib/gc/schedule/scheduleWindow'
import { drawnFromWords } from '../../lib/gc/schedule/templates'
import { scheduleChangedRefusal } from '../../lib/gc/schedule/versionRefusal'
import { waitRows } from '../../lib/gc/schedule/waits'
import { drawSchedule, loadSchedule } from '../../lib/gc/scheduleIo'
import type { GcProject, GcState } from '../../lib/gc/types'
import { formatErrorMessage } from '../../utils/errorHandling'
import { GcGantt } from './GcGantt'
import { GcScheduleBar } from './GcScheduleBar'
import { LookAhead, Measures, ScheduleWhy, finishSentence } from './GcScheduleMeasures'
import { Btn, Card, input } from './gcUi'

/** The board's state (`boardStateFromRows`), the job to read, and who prints, for the paper's foot. */
export function GcSchedule({ state, projectId, by }: { state: GcState; projectId: string; by: string }) {
  const [read, setRead] = useState<ScheduleRead | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'gone' | 'failed'>('loading')
  const [problem, setProblem] = useState<string | null>(null)
  // Try again, and a draw someone else beat, read the schedule again.
  const [reads, setReads] = useState(0)
  const [drawing, setDrawing] = useState(false)
  const [drawProblem, setDrawProblem] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setStatus('loading')
    setProblem(null)
    loadSchedule(state, projectId)
      .then((r) => {
        if (!live) return
        setRead(r)
        setStatus(r ? 'ready' : 'gone')
      })
      .catch((e) => {
        if (!live) return
        setProblem(formatErrorMessage(e, 'The schedule did not load.'))
        setStatus('failed')
      })
    return () => {
      live = false
    }
  }, [state, projectId, reads])

  /** The first draft (call 2): the kernel's draft on the board's job, sent with no version and the log's words. */
  const draw = useCallback(
    async (project: GcProject, start: string) => {
      const draft = draftSchedule(project, start)
      setDrawing(true)
      setDrawProblem(null)
      try {
        const next = await drawSchedule(state, projectId, { version: null, words: draftWords(project, draft, start) }, draft)
        if (next) setRead(next)
      } catch (e) {
        setDrawProblem(formatErrorMessage(e, 'The first draft did not save.'))
        // Someone drew it first: read it again, so the window shows theirs under the refusal.
        if (scheduleChangedRefusal(e)) setReads((n) => n + 1)
      } finally {
        setDrawing(false)
      }
    },
    [state, projectId],
  )

  // What it last read stays on screen while it reads again.
  if (read) return <ScheduleView read={read} by={by} drawing={drawing} drawProblem={drawProblem} onDraw={(start) => void draw(read.project, start)} />
  if (status === 'gone') return <div style={{ fontSize: '0.875rem' }}>That job is not on the board. Reload the board and try again.</div>
  if (status === 'failed')
    return (
      <div role="alert" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
        <span style={{ color: 'var(--text-red-700)' }}>{problem}</span>
        <Btn onClick={() => setReads((n) => n + 1)}>Try again</Btn>
      </div>
    )
  return <div style={{ fontSize: '0.875rem' }}>Loading the schedule…</div>
}

/** The schedule as read: the first draft's card while nothing is drawn, else the measures, the chart and the bar pressed. */
function ScheduleView({ read, by, drawing, drawProblem, onDraw }: { read: ScheduleRead; by: string; drawing: boolean; drawProblem: string | null; onDraw: (start: string) => void }) {
  const { state, project } = read
  const building = project.stage === 'building'
  const m = useMemo(() => scheduleMeasures(state, project), [state, project])
  // What holds each bar: RFIs, submittals, waits, and a trade's papers not in (G-77).
  const holds = useMemo(() => chartHolds(state, project), [state, project])
  // Days a signed change order adds that are not on the dates yet (G-76). Empty until the schedule reads change orders (PR 16).
  const tails = useMemo(() => changeOrderTails(project, state.today), [project, state.today])
  // What the work waits on from outside the trades (G-73 to G-75).
  const waits = useMemo(() => waitRows(state, project), [state, project])
  // Days the daily log says were lost to the weather (G-58), a trade's own late day (G-117), the log against the chart (G-60).
  const lost = useMemo(() => lostDaysByLine(project), [project])
  const lateSaid = useMemo(() => lateNoticeTails(state, project), [state, project])
  const logNotes = useMemo(() => logChartNotes(logChartGaps(state, project, holds)), [state, project, holds])
  // A trade at work with its insurance run out (G-138), and too many trades in one place (G-83).
  const uninsured = useMemo(() => uninsuredNotes(state, project), [state, project])
  const crowded = useMemo(() => crowdedWeeks(state, project), [state, project])
  // The finish with weather and crews (G-57). The late finish's money, the best offer and Ask for the days stay off (call 4).
  const outlook = useMemo(() => (building ? finishOutlook(state, project) : null), [state, project, building])
  const peopleOf = useCallback((from: string, to: string) => peopleOnSite(state, project, from, to, crewCountsNow(project)), [state, project])
  // The chart's bars, for the card of the bar pressed: the chart draws the same ones.
  const bars = useMemo(() => ganttBars(m.items, m.float, holds, state.today, building, tails), [m, holds, state.today, building, tails])
  const [picked, setPicked] = useState<string | null>(null)
  // The chart's one company (G-13), held here so the call list (7c) can pick it.
  const [company, setCompany] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (picked) window.setTimeout(() => document.querySelector('[data-gc-opened-activity]')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 0)
  }, [picked])
  // Print or PDF (G-21): the job's words, and the customer's picture as their portal reads it.
  const printJob = useMemo<GanttPrintJob | null>(
    () =>
      m.finish
        ? {
            name: project.name,
            place: project.address,
            company: GC_COMPANY.name,
            by,
            finishWords: finishSentence(m.finish, m.contract),
            doneWords: building ? customerDoneWords(customerStanding(state, project)) : null,
            customer: customerSchedulePicture(state, project),
          }
        : null,
    [state, project, m, by, building],
  )

  const schedule = project.schedule
  if (!schedule || m.rows.length === 0) {
    const refusal = draftRefusal(project)
    return (
      <div style={{ display: 'grid', gap: '0.9rem' }}>
        <ScheduleWhy />
        {refusal ? (
          <Card>
            <div data-gc-draft-closed style={{ fontSize: '0.9rem' }}>
              <strong>No schedule is drawn.</strong> {refusal}
            </div>
          </Card>
        ) : (
          <DraftCard project={project} today={state.today} busy={drawing} problem={drawProblem} onDraw={onDraw} />
        )}
      </div>
    )
  }

  const pickedBar = bars.find((b) => b.id === picked) ?? null
  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <ScheduleWhy />
      {building ? (
        <Measures m={m} {...(outlook ? { outlook } : {})} />
      ) : (
        <Card>
          <strong>Drawing the schedule.</strong> <span style={{ color: 'var(--text-muted)' }}>Start locks this plan as the baseline. The measures read against it from then on.</span>
          {/* The first draft against the weeks we bid (G-45), and the template it was drawn from (G-44). */}
          {firstDraftAgainstBid(project) && <div style={{ marginTop: '0.35rem' }}>{firstDraftAgainstBid(project)}</div>}
          {schedule.template && <div style={{ marginTop: '0.35rem' }}>{drawnFromWords(schedule.template)}</div>}
        </Card>
      )}
      <Card>
        <GcGantt
          items={m.items}
          float={m.float}
          milestones={m.milestones}
          holds={holds}
          tails={tails}
          waits={waits}
          lost={lost}
          lateSaid={lateSaid}
          logNotes={logNotes}
          uninsured={uninsured}
          peopleOf={peopleOf}
          crowded={crowded}
          {...(printJob ? { print: printJob } : {})}
          company={company}
          onCompany={setCompany}
          today={state.today}
          building={building}
          picked={picked}
          onPick={setPicked}
        />
      </Card>
      {pickedBar && <GcScheduleBar bar={pickedBar} all={bars} today={state.today} building={building} onClose={() => setPicked(null)} />}
      {building && <LookAhead weeks={m.lookAhead} />}
    </div>
  )
}

/** Nothing drawn yet: the day the work starts, and a first draft from every line of every trade. */
function DraftCard({ project, today, busy, problem, onDraw }: { project: GcProject; today: string; busy: boolean; problem: string | null; onDraw: (start: string) => void }) {
  const [start, setStart] = useState(() => draftStart(project, today))
  const rough = roughFirstDraftWords(project)
  return (
    <Card>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
        <div>
          <strong>No schedule is drawn yet.</strong> A first draft draws every line of every trade, the trades in build order. Each line waits on the one before it.
        </div>
        {rough && <div style={{ color: 'var(--text-600)' }}>{rough}</div>}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Work starts</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' }} />
          </label>
          <Btn kind="primary" disabled={!start || busy} onClick={() => onDraw(start)}>
            {busy ? 'Drawing…' : 'Draw a first draft'}
          </Btn>
        </div>
        {problem && (
          <div role="alert" style={{ color: 'var(--text-red-700)' }}>
            {problem}
          </div>
        )}
      </div>
    </Card>
  )
}
