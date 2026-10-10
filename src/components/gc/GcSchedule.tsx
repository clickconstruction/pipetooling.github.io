/**
 * GC mode, the real build, the schedule's PR 7b: one job's schedule on real data (the plan is
 * to-dos/gc-mode/mockups/schedule-pr7.md on branch spike/gc-mode). It reads the schedule's own rows
 * over the board's job (`loadSchedule`) and draws what the prototype's Schedule tab draws: the
 * measures, the chart with its links, spare days and holds, the list on a phone, Print or PDF,
 * Export, and the bar pressed (`GcScheduleBar`). Its presses are Draw a first draft, closed while we
 * bid and on a lost job, and for those who may move a bar, a move through Why it moved with Undo and
 * Redo (PR 8a), and the bar's form and a part's own move (PR 8b). Grouped by company on a job being
 * built, the chart draws who to call, with Call (`GcCallList`, 7c-ii). Since PR 9a, the same people
 * record an inspection passed or failed, put the job's own work on the chart and keep the dates to
 * meet (`GcScheduleCards`). Since PR 9b, they keep what the work waits on and a new baseline
 * (`GcScheduleCards`), where each bar's work is (`GcPlaces`), and a line in parts (`GcSplitBars`). Since PR 9d, the
 * window reads the job's submittals and RFIs first, so they hold bars as they hold a start, and the same people walk the
 * week (`GcScheduleWalk`), see a trade not ready in the bar's form (`GcNotReady`), and, a dev while Building is built
 * (`canPull`), pull work in when it finished early (`GcPullEarlier`) and get days back on a late job (`GcRecovery`).
 * Since PR 11, the same people try moves on their own what-if copy (`GcWhatIf`, G-81) through the copy's own presses,
 * never the real move save, and keep them as real moves or throw the copy away.
 * The window frames it (`GcScheduleWindow`); a project page mounts it unchanged the day the doors
 * bring one.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { barCaller, callList } from '../../lib/gc/schedule/callList'
import { changeOrderTails } from '../../lib/gc/schedule/changeOrderDays'
import { chartHolds } from '../../lib/gc/schedule/chartHolds'
import { crewCountsNow } from '../../lib/gc/schedule/crewCounts'
import { customerDoneWords, customerSchedulePicture, customerStanding } from '../../lib/gc/schedule/customerSchedule'
import { lostDaysByLine } from '../../lib/gc/schedule/daysLost'
import { lateFinish } from '../../lib/gc/lateFinish'
import { draftTimeExtension } from '../../lib/gc/gcIo'
import type { TimeExtensionAsk } from '../../lib/gc/timeExtension'
import { planBillingShift, shiftWords } from '../../lib/gc/billingForecast'
import { scheduleMoneyState, type ScheduleMoney } from '../../lib/gc/scheduleMoney'
import type { MovePlan } from '../../lib/gc/schedule/moves'
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
import { planPull } from '../../lib/gc/schedule/pullEarlier'
import { recoveryOffers } from '../../lib/gc/schedule/recovery'
import { savedMoveId } from '../../lib/gc/schedule/savedMove'
import { partMoveOf } from '../../lib/gc/schedule/splitBars'
import { draftSchedule, scheduleMeasures } from '../../lib/gc/schedule/schedule'
import { draftRefusal, draftStart, draftWords, ownWorkOffWords, redoWords, undoWords } from '../../lib/gc/schedule/scheduleWindow'
import type { PlaceChange } from '../../lib/gc/schedule/places'
import type { ActivityPart, InspectionFailure, ProjectSchedule, ScheduleActivity, ScheduleMilestone, ScheduleMove, ScheduleWait, ScheduleWalk } from '../../lib/gc/schedule/types'
import type { WaitStep } from '../../lib/gc/schedule/writes'
import { drawnFromWords } from '../../lib/gc/schedule/templates'
import { whatIfCopy, whatIfGhosts, whatIfProject } from '../../lib/gc/schedule/whatIf'
import { copyRedone, copyUndone, tryInCopy, whatIfKeepWords } from '../../lib/gc/schedule/whatIfWindow'
import { scheduleChangedRefusal, type ScheduleChange } from '../../lib/gc/schedule/versionRefusal'
import { waitRows } from '../../lib/gc/schedule/waits'
import {
  addScheduleActivity,
  addScheduleWait,
  drawSchedule,
  failScheduleInspection,
  joinScheduleBar,
  keepScheduleWhatIf,
  loadScheduleWithHolds,
  passScheduleInspection,
  recordScheduleWalk,
  redoScheduleMove,
  removeScheduleActivity,
  removeScheduleMilestone,
  removeScheduleWait,
  saveScheduleMove,
  setActualDates,
  setOwnWorkDone,
  setScheduleBaseline,
  setScheduleMilestone,
  setSchedulePlaces,
  setScheduleWaitStep,
  splitScheduleBar,
  startWhatIf,
  throwAwayWhatIf,
  tryInWhatIf,
  undoScheduleMove,
  type SchedulePress,
  type ScheduleReads,
  loadScheduleMoney,
} from '../../lib/gc/scheduleIo'
import type { GcProject, GcState } from '../../lib/gc/types'
import { formatErrorMessage } from '../../utils/errorHandling'
import { GcGantt } from './GcGantt'
import { GcActivityEditor } from './GcActivityEditor'
import { GcBarCaller, GcCallList } from './GcCallList'
import { GcPlaceLine, GcPlacesCard } from './GcPlaces'
import { GcAddOwnWork, GcBaseline, GcInspectionCheck, GcMilestones, GcOwnWorkButtons, GcWaits } from './GcScheduleCards'
import { GcPartsCard } from './GcSplitBars'
import { GcNotReady } from './GcNotReady'
import { GcPullBox, GcPullLine, GcPullWindow, type ScheduleSave } from './GcPullEarlier'
import { GcDaysBack, GcRecoveryWindow } from './GcRecovery'
import { GcScheduleWalk, GcWalkLine } from './GcScheduleWalk'
import { GcScheduleBar } from './GcScheduleBar'
import { GcMoveExplain, GcMoveHistory, type PendingMove } from './GcScheduleMoves'
import { LookAhead, Measures, ScheduleWhy, finishSentence } from './GcScheduleMeasures'
import { GcWhatIfButton, GcWhatIfKeep, GcWhatIfLine } from './GcWhatIf'
import { Btn, Card, input } from './gcUi'

/** No reads past the board's (the default): the schedule's own rows, its submittals and RFIs. */
const NO_READS: ScheduleReads = {}

/**
 * The board's state (`boardStateFromRows`), the job to read, who prints and moves (the paper's foot, the move's name),
 * and whether this person may move a bar (a dev's until the schedule's PR 10). `canPull`: whether they may also pull work
 * in and get days back (G-37, G-82), which read Building's submittals and RFIs, so a dev's until Building's door.
 */
export function GcSchedule({
  state,
  projectId,
  by,
  canMove = false,
  canPull = false,
  reads = NO_READS,
}: {
  state: GcState
  projectId: string
  by: string
  canMove?: boolean
  canPull?: boolean
  /** What this reader may read over the schedule (PR 16): the page memoizes it, since a new one reads again. */
  reads?: ScheduleReads
}) {
  const [read, setRead] = useState<ScheduleRead | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'gone' | 'failed'>('loading')
  const [problem, setProblem] = useState<string | null>(null)
  // Try again, and a draw someone else beat, read the schedule again.
  const [reloads, setReloads] = useState(0)
  const [drawing, setDrawing] = useState(false)
  const [drawProblem, setDrawProblem] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setStatus('loading')
    setProblem(null)
    loadScheduleWithHolds(state, projectId, reads)
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
  }, [state, projectId, reads, reloads])

  /** The first draft (call 2): the kernel's draft on the board's job, sent with no version and the log's words. */
  const draw = useCallback(
    async (project: GcProject, start: string) => {
      const draft = draftSchedule(project, start)
      setDrawing(true)
      setDrawProblem(null)
      try {
        // The read's state carries the job's submittals and RFIs, so the drawn schedule keeps their holds.
        const next = await drawSchedule(read?.state ?? state, projectId, { version: null, words: draftWords(project, draft, start) }, draft)
        if (next) setRead(next)
      } catch (e) {
        setDrawProblem(formatErrorMessage(e, 'The first draft did not save.'))
        // Someone drew it first: read it again, so the window shows theirs under the refusal.
        if (scheduleChangedRefusal(e)) setReloads((n) => n + 1)
      } finally {
        setDrawing(false)
      }
    },
    [state, read, projectId],
  )

  /**
   * A move with why (PR 8a): the kernel's record and the bars it leaves, against the version this window read.
   * It throws the database's refusal, which the move's window shows. `read.state` carries the bars the move
   * was worked out from, which the io measures the answer against. It answers the saved move's id, found in the read
   * after it (`savedMoveId`, PR 9d), for the walk's record.
   */
  const saveMove = useCallback(
    async (move: ScheduleMove, activities: ScheduleActivity[], words: string): Promise<string | null> => {
      if (!read || read.version === null) throw new Error('Nothing is drawn yet.')
      const next = await saveScheduleMove(read.state, projectId, { version: read.version, words }, move, activities)
      if (next) setRead(next)
      return savedMoveId(read.project.schedule, next?.project.schedule, move)
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
  /**
   * A plan write of 9a's (the job's own work put on or taken off, a failed inspection): against the version this window
   * read, with its line in the log. It throws the database's refusal, which the card shows. `read.state` carries the
   * bars the press was worked out from.
   */
  const planWrite = useCallback(
    async (write: (st: GcState, press: SchedulePress) => Promise<ScheduleRead | null>, words: string) => {
      if (!read || read.version === null) throw new Error('Nothing is drawn yet.')
      const next = await write(read.state, { version: read.version, words })
      if (next) setRead(next)
    },
    [read],
  )
  /** A record of 9a's (an inspection passed, the work done, a date to meet): no version, so two people never collide. */
  const record = useCallback(
    async (write: (st: GcState) => Promise<ScheduleRead | null>) => {
      if (!read) return
      const next = await write(read.state)
      if (next) setRead(next)
    },
    [read],
  )
  // Undo and Redo (G-40): replayed on the server from the move's own record, against the version read.
  // The money team's own lines (16c): the bills, the full change orders and the trades' money, read once per open beside
  // the schedule. A failed read leaves the chart whole with today's words.
  const moneyOn = reads.money === true
  const packageKey = state.projects.find((p) => p.id === projectId)?.packages.map((k) => k.id).join(',') ?? ''
  const [money, setMoney] = useState<ScheduleMoney | null>(null)
  useEffect(() => {
    if (!moneyOn) return
    let live = true
    loadScheduleMoney(projectId, packageKey ? packageKey.split(',') : [])
      .then((m) => {
        if (live) setMoney(m)
      })
      .catch(() => {
        if (live) setMoney(null)
      })
    return () => {
      live = false
    }
  }, [moneyOn, projectId, packageKey])

  // Ask for the days (G-141, the schedule's PR 16b-ii): the money team's press drafts the time extension on Bill the
  // customer, then reads again, so the asked moves leave the ask.
  const [asking, setAsking] = useState(false)
  const [askSaid, setAskSaid] = useState<string | null>(null)
  const askForDays = useCallback(
    async (ask: TimeExtensionAsk) => {
      if (asking) return
      setAsking(true)
      setAskSaid(null)
      try {
        await draftTimeExtension(projectId, ask)
        setAskSaid(`A change order for ${ask.days} ${ask.days === 1 ? 'day' : 'days'} is drafted on Bill the customer. Nothing went to the customer.`)
        setReloads((n) => n + 1)
      } catch (e) {
        setAskSaid(formatErrorMessage(e, 'The change order was not drafted.'))
      } finally {
        setAsking(false)
      }
    },
    [asking, projectId],
  )
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
          setReloads((n) => n + 1)
        } else setReplayProblem(formatErrorMessage(e, kind === 'undo' ? 'The undo did not save.' : 'The redo did not save.'))
      } finally {
        setReplaying(false)
      }
    },
    [read, projectId, by],
  )

  // The what-if copy (G-81, PR 11): its own presses, never the real move save (call 3). Each writes the person's own copy
  // and answers with the schedule read again. A move tried, and Keep, throw for the window that pressed them; the rest
  // say their refusal on the line over the chart.
  const [shown, setShown] = useState(false)
  const [copyBusy, setCopyBusy] = useState(false)
  const [copyProblem, setCopyProblem] = useState<string | null>(null)
  const copyWrite = useCallback(
    async (write: (st: GcState) => Promise<ScheduleRead | null>, failed: string): Promise<boolean> => {
      if (!read) return false
      setCopyBusy(true)
      setCopyProblem(null)
      try {
        const next = await write(read.state)
        if (next) setRead(next)
        return true
      } catch (e) {
        setCopyProblem(formatErrorMessage(e, failed))
        return false
      } finally {
        setCopyBusy(false)
      }
    },
    [read],
  )
  const copy = useMemo<CopyPresses | null>(() => {
    if (!read || read.version === null) return null
    const { state: st, project, version } = read
    return {
      start: () => {
        const made = whatIfCopy(project, by, st.today)
        if (made) void copyWrite((s) => startWhatIf(s, projectId, version, made), 'The copy was not made.').then((ok) => ok && setShown(true))
      },
      save: async (move, activities) => {
        const tried = tryInCopy(project, move, activities)
        if (!tried) throw new Error('There is no what-if open.')
        const next = await tryInWhatIf(st, projectId, tried)
        if (next) setRead(next)
        return null
      },
      undo: (move) => {
        const back = copyUndone(project, move.id, by, st.today)
        if (back) void copyWrite((s) => tryInWhatIf(s, projectId, back), 'The undo did not save.')
      },
      redo: (move) => {
        const forward = copyRedone(project, move.id)
        if (forward) void copyWrite((s) => tryInWhatIf(s, projectId, forward), 'The redo did not save.')
      },
      throwAway: () => void copyWrite((s) => throwAwayWhatIf(s, projectId), 'The copy was not thrown away.').then((ok) => ok && setShown(false)),
      keep: async (kept) => {
        const next = await keepScheduleWhatIf(st, projectId, { version, words: whatIfKeepWords(project, kept.kept, by) }, kept)
        if (next) setRead(next)
        setShown(false)
      },
      reload: () => setReloads((n) => n + 1),
      busy: copyBusy,
      problem: copyProblem,
    }
  }, [read, by, projectId, copyWrite, copyBusy, copyProblem])

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
                reload: () => setReloads((n) => n + 1),
                undo: (move) => void replay('undo', move),
                redo: (move) => void replay('redo', move),
                busy: replaying,
                refused: replayRefused,
                problem: replayProblem,
                addOwn: (activities, words) => planWrite((st, press) => addScheduleActivity(st, projectId, press, activities), words),
                removeOwn: (lineId, words) => planWrite((st, press) => removeScheduleActivity(st, projectId, press, lineId), words),
                ownDone: (lineId, on) => record((st) => setOwnWorkDone(st, projectId, lineId, on)),
                pass: (lineId) => record((st) => passScheduleInspection(st, projectId, lineId)),
                fail: (lineId, failure, activities, words) => planWrite((st, press) => failScheduleInspection(st, projectId, press, lineId, failure, activities), words),
                milestone: (m) => record((st) => setScheduleMilestone(st, projectId, m)),
                removeMilestone: (id) => record((st) => removeScheduleMilestone(st, projectId, id)),
                addWait: (wait) => record((st) => addScheduleWait(st, projectId, wait)),
                waitStep: (waitId, step, on, note) => record((st) => setScheduleWaitStep(st, projectId, waitId, step, on, note)),
                removeWait: (waitId) => record((st) => removeScheduleWait(st, projectId, waitId)),
                places: (changes) => record((st) => setSchedulePlaces(st, projectId, changes)),
                split: (lineId, parts, words) => planWrite((st, press) => splitScheduleBar(st, projectId, press, lineId, parts), words),
                join: (lineId, words) => planWrite((st, press) => joinScheduleBar(st, projectId, press, lineId), words),
                baseline: (name, why, words) => planWrite((st, press) => setScheduleBaseline(st, projectId, press, name, why), words),
                walk: (w) => record((st) => recordScheduleWalk(st, projectId, w)),
              }
            : null
        }
        canPull={canMove && canPull}
        ask={reads.money && canMove ? { onAsk: (ask) => void askForDays(ask), said: askSaid } : null}
        money={moneyOn ? money : null}
        copy={canMove ? copy : null}
        shown={shown}
        onShow={setShown}
      />
    )
  if (status === 'gone') return <div style={{ fontSize: '0.875rem' }}>That job is not on the board. Reload the board and try again.</div>
  if (status === 'failed')
    return (
      <div role="alert" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
        <span style={{ color: 'var(--text-red-700)' }}>{problem}</span>
        <Btn onClick={() => setReloads((n) => n + 1)}>Try again</Btn>
      </div>
    )
  return <div style={{ fontSize: '0.875rem' }}>Loading the schedule…</div>
}

/**
 * What a person who may move a bar presses (PR 8a): a move with why, reading again after a refusal, Undo and Redo. Since
 * 9a, the job's own work, an inspection passed or failed, and the dates to meet; since 9b, waits, places, parts and the
 * baseline.
 */
interface MovePresses {
  /** A move with why: answers the saved move's id when the read after it shows it (PR 9d). */
  save: ScheduleSave
  /** The real days (G-55, PR 8b). */
  actual: (lineId: string, actualStart: string | null, actualFinish: string | null) => Promise<void>
  reload: () => void
  undo: (move: ScheduleMove) => void
  redo: (move: ScheduleMove) => void
  busy: boolean
  refused: ScheduleChange[] | null
  problem: string | null
  /** The job's own work put on the chart (G-38, PR 9a): the bars as it leaves them, a plan write. */
  addOwn: (activities: ScheduleActivity[], words: string) => Promise<void>
  /** The job's own work taken off, a plan write. */
  removeOwn: (lineId: string, words: string) => Promise<void>
  /** The job's own work done that day, or not done after all (null): a record. */
  ownDone: (lineId: string, on: string | null) => Promise<void>
  /** An inspection passed today: a record. */
  pass: (lineId: string) => Promise<void>
  /** An inspection failed: the failure and the bars as it leaves them, a plan write. */
  fail: (lineId: string, failure: InspectionFailure, activities: ScheduleActivity[], words: string) => Promise<void>
  /** A date to meet set, new or changed, or taken off: records. */
  milestone: (m: ScheduleMilestone) => Promise<void>
  removeMilestone: (id: string) => Promise<void>
  /** What the work waits on (G-73 to G-75, PR 9b): added, a step, taken off. Records. */
  addWait: (wait: ScheduleWait) => Promise<void>
  waitStep: (waitId: string, step: WaitStep, on: string, note?: string) => Promise<void>
  removeWait: (waitId: string) => Promise<void>
  /** Where bars' work is (G-83): a record, refused whole. */
  places: (changes: PlaceChange[]) => Promise<void>
  /** A line split into parts, or one bar again (G-39): plan writes. */
  split: (lineId: string, parts: ActivityPart[], words: string) => Promise<void>
  join: (lineId: string, words: string) => Promise<void>
  /** A new baseline (G-41): a plan write. */
  baseline: (name: string, why: string, words: string) => Promise<void>
  /** The week walked (G-52, PR 9d): what was kept, the moves made, what was not looked at. A record. */
  walk: (walk: Pick<ScheduleWalk, 'on' | 'kept' | 'moveIds' | 'skipped' | 'keptEarly'>) => Promise<void>
}

/** The what-if copy's own presses (G-81, PR 11, call 3), apart from `MovePresses`: a move tried is not a move until Keep. */
interface CopyPresses {
  /** The person's own copy, made from the schedule as read, with the version it copied. */
  start: () => void
  /** A move tried on the copy: `ScheduleSave`'s shape, so Why it moved, Pull earlier and Days back take it. Answers null. */
  save: ScheduleSave
  undo: (move: ScheduleMove) => void
  redo: (move: ScheduleMove) => void
  throwAway: () => void
  /** Keep: the kernel's answer, against the version read. Throws the database's refusal for the window. */
  keep: (kept: { schedule: ProjectSchedule; kept: ScheduleMove[] }) => Promise<void>
  reload: () => void
  busy: boolean
  problem: string | null
}

/**
 * The schedule as read: the first draft's card while nothing is drawn, else the measures, the chart, the bar pressed
 * and the record of moves. With `moves`, a bar dragged, pulled at an end or linked, a part dragged, or a change in the
 * bar's form opens Why it moved.
 */
function ScheduleView({
  read,
  by,
  drawing,
  drawProblem,
  onDraw,
  moves,
  canPull,
  ask,
  money,
  copy,
  shown,
  onShow,
}: {
  read: ScheduleRead
  by: string
  drawing: boolean
  drawProblem: string | null
  onDraw: (start: string) => void
  moves: MovePresses | null
  /** Pull earlier and Days back too (PR 9d's call 1): only with `moves`. */
  canPull: boolean
  /** Ask for the days (PR 16b-ii): the money team's press and what it last said. Null: the line says who asks. */
  ask: { onAsk: (ask: TimeExtensionAsk) => void; said: string | null } | null
  /** The money team's rows (16c). Null: no dollar on this chart. */
  money: ScheduleMoney | null
  /** The what-if copy's presses (PR 11): only with `moves`. */
  copy: CopyPresses | null
  /** The copy is shown: the window reads it, and its presses go to the copy. */
  shown: boolean
  onShow: (copy: boolean) => void
}) {
  const { state, project: realProject } = read
  // The what-if copy (G-81, PR 11, call 6): while it is shown, the window reads the copy, and every move goes to the copy.
  const copyProject = useMemo(() => whatIfProject(realProject), [realProject])
  const inCopy = Boolean(copy && shown && copyProject)
  const project = inCopy && copyProject ? copyProject : realProject
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
  // The finish with weather and crews (G-57). The late finish's whose-days line (G-98) reads the change orders through the
  // office's view (PR 16b-ii); its money and the best offer wait for the money team's own state (16c).
  const outlook = useMemo(() => (building ? finishOutlook(state, project) : null), [state, project, building])
  // The money team's own state (16c, call 3): the chart's read with the money laid over it. Every dollar reads it, never the
  // chart's state: the late fee, what a way to get days back saves, the billing line.
  const moneyState = useMemo(() => (money ? scheduleMoneyState(state, project.id, money) : null), [money, state, project.id])
  const moneyProject = moneyState?.projects.find((p) => p.id === project.id) ?? null
  const late = useMemo(
    () => (building ? (moneyState && moneyProject && !inCopy ? lateFinish(moneyState, moneyProject) : lateFinish(state, project)) : null),
    [state, project, building, moneyState, moneyProject, inCopy],
  )
  const asked = late?.ask ?? null
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
  // The weekly walk (G-52), work that finished early (G-37) and days back on a late job (G-82), PR 9d: for those who may
  // move a bar on a job being built; the pull and the days back only with `canPull`.
  const walkable = building && moves !== null
  // The walk records the real week, so it is not in the copy (PR 11, call 2); the pull and days back are moves, so they are.
  const walkShown = walkable && !inCopy
  const pullable = walkable && canPull
  const offer = useMemo(() => (pullable ? planPull(state, project) : null), [state, project, pullable])
  const daysBack = useMemo(
    () => (pullable && (lateFinish(state, project).late ?? 0) > 0 ? (moneyState && moneyProject && !inCopy ? recoveryOffers(moneyState, moneyProject) : recoveryOffers(state, project)) : null),
    [state, project, pullable, moneyState, moneyProject, inCopy],
  )
  // The billing line under a pull or a days-back move (9d's, 16c): the money team's only, and never in the copy, whose
  // plan the money state's real schedule cannot measure (PR 11, call 7).
  const billingOf = useMemo(
    () => (moneyState && moneyProject && !inCopy ? (plan: Pick<MovePlan, 'activities'>) => shiftWords(planBillingShift(moneyState, moneyProject, plan), 'will') : undefined),
    [moneyState, moneyProject, inCopy],
  )
  // What the whole copy does to the bills against the real schedule (call 7): the money team's sentence on the copy's line.
  const copyBills = useMemo(
    () => (inCopy && moneyState && moneyProject && copyProject?.schedule ? shiftWords(planBillingShift(moneyState, moneyProject, { activities: copyProject.schedule.activities }), 'will') : null),
    [inCopy, moneyState, moneyProject, copyProject],
  )
  const ghosts = useMemo(() => (inCopy ? whatIfGhosts(realProject) : null), [inCopy, realProject])
  const [keeping, setKeeping] = useState(false)
  const [walking, setWalking] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [recovering, setRecovering] = useState<string | null>(null)
  // A move waiting on why it moved (PR 8a): every drag, pulled end and link goes through the window first.
  const [pending, setPending] = useState<PendingMove | null>(null)
  // In or out of the copy: a window open on the other schedule closes, so nothing it shows is the wrong one's.
  const showCopy = (on: boolean) => {
    setPending(null)
    setPulling(false)
    setRecovering(null)
    setWalking(false)
    setKeeping(false)
    onShow(on)
  }
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
        <>
          <Measures
            m={m}
            {...(outlook ? { outlook } : {})}
            {...(late ? { late } : {})}
            {...(moneyState && daysBack?.[0] && !inCopy ? { best: daysBack[0] } : {})}
            // Ask for the days drafts a real change order, so never from the copy (PR 11, call 2).
            {...(inCopy ? {} : ask && asked ? { onAsk: () => ask.onAsk(asked) } : { askNote: 'The money team asks the customer for these days on Bill the customer.' })}
          />
          {ask?.said && (
            <div data-ask-said role="status" style={{ fontSize: '0.85rem' }}>
              {ask.said}
            </div>
          )}
        </>
      ) : (
        <Card>
          <strong>Drawing the schedule.</strong> <span style={{ color: 'var(--text-muted)' }}>Start locks this plan as the baseline. The measures read against it from then on.</span>
          {/* The first draft against the weeks we bid (G-45), and the template it was drawn from (G-44). */}
          {firstDraftAgainstBid(project) && <div style={{ marginTop: '0.35rem' }}>{firstDraftAgainstBid(project)}</div>}
          {schedule.template && <div style={{ marginTop: '0.35rem' }}>{drawnFromWords(schedule.template)}</div>}
        </Card>
      )}
      {/* Days back on a late job (G-82, PR 9d): under the measures. */}
      {daysBack && <GcDaysBack state={!inCopy && moneyState ? moneyState : state} project={!inCopy && moneyProject ? moneyProject : project} offers={daysBack} onLook={setRecovering} />}
      <Card>
        {/* The walk's line and the pull's (G-52, G-37, PR 9d), over the chart. */}
        {/* The copy's line (G-81, PR 11): what it does against the real schedule, Keep and Throw it away. */}
        {inCopy && copy && (
          <GcWhatIfLine project={realProject} bills={copyBills} busy={copy.busy} problem={copy.problem} onKeep={() => setKeeping(true)} onThrowAway={copy.throwAway} onReal={() => showCopy(false)} />
        )}
        {!inCopy && copy?.problem && (
          <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem', padding: '0 0 0.4rem' }}>
            {copy.problem}
          </div>
        )}
        {walkShown && <GcWalkLine state={state} project={project} holds={holds} canPull={pullable} onWalk={() => setWalking(true)} />}
        {offer && <GcPullLine offer={offer} onPull={() => setPulling(true)} />}
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
          {...(printJob && !inCopy ? { print: printJob } : {})}
          {...(ghosts ? { real: ghosts } : {})}
          {...(copy ? { toolbarExtra: <GcWhatIfButton project={realProject} shown={inCopy} busy={copy.busy} onStart={copy.start} onShow={showCopy} /> } : {})}
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
          // In the copy (PR 11, call 2): its dates and waits only; the real days, a place, the own work's and an inspection's buttons record what happened.
          {...(inCopy ? {} : { onActual: (actualStart: string | null, actualFinish: string | null) => moves.actual(pickedBar.id, actualStart, actualFinish) })}
          // Its trade not ready to start, or at work uninsured (G-77, G-138, PR 9d): first, under its name.
          ready={<GcNotReady state={state} project={project} lineId={pickedBar.id} />}
          place={
            // Where its work is (G-83, PR 9b): a trade's line only.
            !inCopy && pickedBar.item.pkg ? <GcPlaceLine project={project} lineId={pickedBar.id} trade={pickedBar.item.trade} label={pickedBar.item.label} onPlaces={moves.places} /> : undefined
          }
          extra={
            // The job's own work's buttons (G-38, PR 9a): done, not done, off the schedule.
            !inCopy && pickedBar.item.activity.added ? (
              <GcOwnWorkButtons
                activity={pickedBar.item.activity}
                today={state.today}
                onDone={(on) => moves.ownDone(pickedBar.id, on)}
                onRemove={async () => {
                  await moves.removeOwn(pickedBar.id, ownWorkOffWords(project, pickedBar.id))
                  setPicked(null)
                }}
                onReload={moves.reload}
              />
            ) : undefined
          }
          check={
            // An inspection not passed yet, on a job being built (PR 9a): passed or failed, today.
            !inCopy && building && pickedBar.item.activity.inspection && !pickedBar.item.activity.inspection.passedOn ? (
              <GcInspectionCheck
                project={project}
                activity={pickedBar.item.activity}
                today={state.today}
                hint="Our superintendent records it. A pass meets the milestone with the same name."
                onPass={() => moves.pass(pickedBar.id)}
                onFail={(failure, activities, words) => moves.fail(pickedBar.id, failure, activities, words)}
                onReload={moves.reload}
              />
            ) : undefined
          }
          onClose={() => setPicked(null)}
        />
      )}
      {/* The opened bar finished early, or right behind work that did (G-37, PR 9d). */}
      {pickedBar && offer && <GcPullBox offer={offer} lineId={pickedBar.id} onPull={() => setPulling(true)} />}
      {/* The opened line's parts (G-39, PR 9b): split, a part's dates through Why it moved, one bar again. */}
      {pickedBar && moves && !inCopy && !pickedBar.item.activity.inspection && !pickedBar.item.activity.added && (
        <GcPartsCard
          key={`parts:${pickedBar.id}`}
          project={project}
          activity={pickedBar.item.activity}
          pct={pickedBar.item.actual}
          by={by}
          onSplit={(parts, words) => moves.split(pickedBar.id, parts, words)}
          onJoin={(words) => moves.join(pickedBar.id, words)}
          onMovePart={setPending}
          onReload={moves.reload}
        />
      )}
      {pickedBar && (
        <GcScheduleBar bar={pickedBar} all={bars} today={state.today} building={building} caller={caller ? <GcBarCaller caller={caller} /> : undefined} onClose={() => setPicked(null)} />
      )}
      {inCopy && copy ? (
        <GcMoveHistory project={project} onUndo={copy.undo} onRedo={copy.redo} busy={copy.busy} trying />
      ) : moves ? (
        <GcMoveHistory project={project} onUndo={moves.undo} onRedo={moves.redo} busy={moves.busy} refused={moves.refused} problem={moves.problem} />
      ) : (
        <GcMoveHistory project={project} />
      )}
      {/* What the work waits on and where it is (PR 9b), the job's own work and the dates to meet (PR 9a), and the baseline (9b), for those who may move a bar. */}
      {moves && !inCopy && (
        <>
          <GcWaits state={state} project={project} rows={waits} items={m.items} onAdd={moves.addWait} onStep={moves.waitStep} onRemove={moves.removeWait} />
          <GcPlacesCard state={state} project={project} crowded={crowded} onPlaces={moves.places} />
          <GcAddOwnWork project={project} items={m.items} today={state.today} by={by} onAdd={moves.addOwn} onReload={moves.reload} />
          <GcMilestones project={project} milestones={schedule.milestones} onSave={moves.milestone} onRemove={moves.removeMilestone} />
          {schedule.baseline && <GcBaseline project={project} today={state.today} by={by} onBaseline={moves.baseline} onReload={moves.reload} />}
        </>
      )}
      {/* The window keeps its reason and words while the schedule reads again under it: keyed by the bar only. */}
      {moves && pending && (
        <GcMoveExplain key={pending.lineId} state={state} project={project} pending={pending} by={by} today={state.today} trying={inCopy} onSave={async (move, activities, words) => {
            await (inCopy && copy ? copy.save : moves.save)(move, activities, words)
          }} onReload={moves.reload} onClose={() => setPending(null)} />
      )}
      {/* The walk, a pull and days back (PR 9d): each saves through the one move save, and the walk keeps its record. */}
      {moves && walking && !inCopy && (
        <GcScheduleWalk state={state} project={project} holds={holds} by={by} canPull={pullable} presses={{ save: moves.save, actual: moves.actual, walk: moves.walk, reload: moves.reload }} onClose={() => setWalking(false)} />
      )}
      {moves && pulling && (
        <GcPullWindow state={state} project={project} by={by} onSave={inCopy && copy ? copy.save : moves.save} onReload={moves.reload} onClose={() => setPulling(false)} trying={inCopy} {...(billingOf ? { billingOf } : {})} />
      )}
      {moves && recovering && (
        <GcRecoveryWindow
          key={recovering}
          state={!inCopy && moneyState ? moneyState : state}
          project={!inCopy && moneyProject ? moneyProject : project}
          offerKey={recovering}
          by={by}
          onSave={inCopy && copy ? copy.save : moves.save}
          onReload={moves.reload}
          onClose={() => setRecovering(null)}
          trying={inCopy}
          {...(billingOf ? { billingOf } : {})}
        />
      )}
      {/* Keep (G-81, PR 11): the kernel first, then the moves on the real schedule against the version read. */}
      {inCopy && copy && keeping && (
        <GcWhatIfKeep
          project={realProject}
          by={by}
          today={state.today}
          onKeep={copy.keep}
          onThrowAway={() => {
            setKeeping(false)
            copy.throwAway()
          }}
          onReload={copy.reload}
          onClose={() => setKeeping(false)}
        />
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
