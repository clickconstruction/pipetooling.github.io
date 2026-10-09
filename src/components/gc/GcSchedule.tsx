/**
 * GC mode, the real build, the schedule's PR 7b: one job's schedule on real data (the plan is
 * to-dos/gc-mode/mockups/schedule-pr7.md on branch spike/gc-mode). It reads the schedule's own rows
 * over the board's job (`loadSchedule`) and draws what the prototype's Schedule tab draws: the
 * measures, the chart with its links, spare days and holds, the list on a phone, Print or PDF,
 * Export, and the bar pressed (`GcScheduleBar`). Its presses are Draw a first draft, closed while we
 * bid and on a lost job, and for those who may move a bar, a move through Why it moved with Undo and
 * Redo (PR 8a), and the bar's form and a part's own move (PR 8b). Grouped by company on a job being
 * built, the chart draws who to call, with Call (`GcCallList`, 7c-ii). The window frames it
 * (`GcScheduleWindow`); a project page mounts it unchanged the day the doors bring one.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { barCaller, callList } from '../../lib/gc/schedule/callList'
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
import { planMove } from '../../lib/gc/schedule/moves'
import { partMoveOf } from '../../lib/gc/schedule/splitBars'
import { draftSchedule, scheduleMeasures } from '../../lib/gc/schedule/schedule'
import { draftRefusal, draftStart, draftWords, redoWords, undoWords } from '../../lib/gc/schedule/scheduleWindow'
import type { ScheduleActivity, ScheduleMove } from '../../lib/gc/schedule/types'
import { drawnFromWords } from '../../lib/gc/schedule/templates'
import { scheduleChangedRefusal, type ScheduleChange } from '../../lib/gc/schedule/versionRefusal'
import { waitRows } from '../../lib/gc/schedule/waits'
import { drawSchedule, loadSchedule, redoScheduleMove, saveScheduleMove, setActualDates, undoScheduleMove } from '../../lib/gc/scheduleIo'
import type { GcProject, GcState } from '../../lib/gc/types'
import { formatErrorMessage } from '../../utils/errorHandling'
import { GcGantt } from './GcGantt'
import { GcActivityEditor } from './GcActivityEditor'
import { GcBarCaller, GcCallList } from './GcCallList'
import { GcScheduleBar } from './GcScheduleBar'
import { GcMoveExplain, GcMoveHistory, type PendingMove } from './GcScheduleMoves'
import { LookAhead, Measures, ScheduleWhy, finishSentence } from './GcScheduleMeasures'
import { Btn, Card, input } from './gcUi'

/**
 * The board's state (`boardStateFromRows`), the job to read, who prints and moves (the paper's foot, the move's name),
 * and whether this person may move a bar (a dev's until the schedule's PR 10).
 */
export function GcSchedule({ state, projectId, by, canMove = false }: { state: GcState; projectId: string; by: string; canMove?: boolean }) {
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

  /**
   * A move with why (PR 8a): the kernel's record and the bars it leaves, against the version this window read.
   * It throws the database's refusal, which the move's window shows. `read.state` carries the bars the move
   * was worked out from, which the io measures the answer against.
   */
  const saveMove = useCallback(
    async (move: ScheduleMove, activities: ScheduleActivity[], words: string) => {
      if (!read || read.version === null) throw new Error('Nothing is drawn yet.')
      const next = await saveScheduleMove(read.state, projectId, { version: read.version, words }, move, activities)
      if (next) setRead(next)
    },
    [read, projectId],
  )
  /** The real days a bar ran (G-55, PR 8b): a record, so no version. A refusal comes back in words for the form. */
  const keepActual = useCallback(
    async (lineId: string, actualStart: string | null, actualFinish: string | null) => {
      if (!read) return
      try {
        const next = await setActualDates(read.state, projectId, lineId, { actualStart, actualFinish })
        if (next) setRead(next)
      } catch (e) {
        throw new Error(formatErrorMessage(e, 'The real days did not save.'))
      }
    },
    [read, projectId],
  )
  // Undo and Redo (G-40): replayed on the server from the move's own record, against the version read.
  const [replaying, setReplaying] = useState(false)
  const [replayRefused, setReplayRefused] = useState<ScheduleChange[] | null>(null)
  const [replayProblem, setReplayProblem] = useState<string | null>(null)
  const replay = useCallback(
    async (kind: 'undo' | 'redo', move: ScheduleMove) => {
      if (!read || read.version === null) return
      setReplaying(true)
      setReplayRefused(null)
      setReplayProblem(null)
      try {
        const press = { version: read.version, words: kind === 'undo' ? undoWords(read.project, move, by) : redoWords(read.project, move, by) }
        const next = await (kind === 'undo' ? undoScheduleMove : redoScheduleMove)(read.state, projectId, press, move.id)
        if (next) setRead(next)
      } catch (e) {
        const refusal = scheduleChangedRefusal(e)
        if (refusal) {
          // Someone saved first: say what, and read the schedule again.
          setReplayRefused(refusal.changes)
          setReads((n) => n + 1)
        } else setReplayProblem(formatErrorMessage(e, kind === 'undo' ? 'The undo did not save.' : 'The redo did not save.'))
      } finally {
        setReplaying(false)
      }
    },
    [read, projectId, by],
  )

  // What it last read stays on screen while it reads again.
  if (read)
    return (
      <ScheduleView
        read={read}
        by={by}
        drawing={drawing}
        drawProblem={drawProblem}
        onDraw={(start) => void draw(read.project, start)}
        moves={
          canMove
            ? {
                save: saveMove,
                actual: keepActual,
                reload: () => setReads((n) => n + 1),
                undo: (move) => void replay('undo', move),
                redo: (move) => void replay('redo', move),
                busy: replaying,
                refused: replayRefused,
                problem: replayProblem,
              }
            : null
        }
      />
    )
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

/** What a person who may move a bar presses (PR 8a): a move with why, reading again after a refusal, Undo and Redo. */
interface MovePresses {
  save: (move: ScheduleMove, activities: ScheduleActivity[], words: string) => Promise<void>
  /** The real days (G-55, PR 8b). */
  actual: (lineId: string, actualStart: string | null, actualFinish: string | null) => Promise<void>
  reload: () => void
  undo: (move: ScheduleMove) => void
  redo: (move: ScheduleMove) => void
  busy: boolean
  refused: ScheduleChange[] | null
  problem: string | null
}

/**
 * The schedule as read: the first draft's card while nothing is drawn, else the measures, the chart, the bar pressed
 * and the record of moves. With `moves`, a bar dragged, pulled at an end or linked, a part dragged, or a change in the
 * bar's form opens Why it moved.
 */
function ScheduleView({ read, by, drawing, drawProblem, onDraw, moves }: { read: ScheduleRead; by: string; drawing: boolean; drawProblem: string | null; onDraw: (start: string) => void; moves: MovePresses | null }) {
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
  // The chart's one company (G-13): its picker and the call list's Their work share it.
  const [company, setCompany] = useState<string | undefined>(undefined)
  const chartCompanies = useMemo(() => new Set(m.items.map((i) => i.company)), [m.items])
  // By company as a call list (G-115, 7c-ii): whoever's answer moves the chart, from the chart's own holds, on a job being
  // built. The Follow up sheet is the Board lane's and not here yet, so Call only dials.
  const calls = useMemo(() => (building ? callList(state, project, holds) : null), [state, project, holds, building])
  // A move waiting on why it moved (PR 8a): every drag, pulled end and link goes through the window first.
  const [pending, setPending] = useState<PendingMove | null>(null)
  // What a dragged bar would push and do to the finish, drawn while it is dragged.
  const planOf = useCallback(
    (lineId: string, start: string, finish: string) => {
      const plan = planMove(project, lineId, start, finish)
      return plan && !plan.problem ? { pushed: plan.pushed.map((p) => ({ lineId: p.lineId, start: p.to.start, finish: p.to.finish })), words: plan.words } : null
    },
    [project],
  )
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
  // The opened bar's company, with Call (G-115), while its work is not done.
  const caller = calls && pickedBar && pickedBar.item.actual < 100 ? barCaller(state, project, pickedBar.id) : null
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
          callList={
            calls ? (
              // A line about a bar opens it; Their work shows only that company on the chart (G-13).
              <GcCallList list={calls} onReason={setPicked} theirWork={(person) => (chartCompanies.has(person.company) ? () => setCompany(person.company) : null)} />
            ) : undefined
          }
          {...(moves && project.schedule
            ? {
                onMove: (lineId: string, start: string, finish: string) => setPending({ lineId, start, finish, after: project.schedule?.activities.find((a) => a.lineId === lineId)?.after ?? [] }),
                planOf,
                onLink: (from: string, to: string) => {
                  const a = project.schedule?.activities.find((x) => x.lineId === to)
                  if (a && !a.after.includes(from)) setPending({ lineId: to, start: a.start, finish: a.finish, after: [...a.after, from] })
                },
                onUnlink: (from: string, to: string) => {
                  const a = project.schedule?.activities.find((x) => x.lineId === to)
                  if (a) setPending({ lineId: to, start: a.start, finish: a.finish, after: a.after.filter((id) => id !== from) })
                },
                // A part of a split line dragged (G-39, PR 8b): its line's new span, and the part's days before and after.
                onMovePart: (lineId: string, partId: string, start: string, finish: string) => {
                  const a = project.schedule?.activities.find((x) => x.lineId === lineId)
                  const move = a ? partMoveOf(a, partId, start, finish) : null
                  if (move) setPending(move)
                },
              }
            : {})}
        />
      </Card>
      {/* The bar's form (PR 8b), for those who may move a bar: a change goes through Why it moved like a drag. */}
      {pickedBar && moves && (
        <GcActivityEditor
          key={pickedBar.id}
          project={project}
          row={pickedBar.item}
          rows={m.items}
          started={Boolean(project.startedOn)}
          today={state.today}
          onSave={(start, finish, after, limits) => setPending({ lineId: pickedBar.id, start, finish, after, limits })}
          onActual={(actualStart, actualFinish) => moves.actual(pickedBar.id, actualStart, actualFinish)}
          onClose={() => setPicked(null)}
        />
      )}
      {pickedBar && (
        <GcScheduleBar bar={pickedBar} all={bars} today={state.today} building={building} caller={caller ? <GcBarCaller caller={caller} /> : undefined} onClose={() => setPicked(null)} />
      )}
      {moves ? (
        <GcMoveHistory project={project} onUndo={moves.undo} onRedo={moves.redo} busy={moves.busy} refused={moves.refused} problem={moves.problem} />
      ) : (
        <GcMoveHistory project={project} />
      )}
      {/* The window keeps its reason and words while the schedule reads again under it: keyed by the bar only. */}
      {moves && pending && (
        <GcMoveExplain key={pending.lineId} state={state} project={project} pending={pending} by={by} today={state.today} onSave={moves.save} onReload={moves.reload} onClose={() => setPending(null)} />
      )}
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
