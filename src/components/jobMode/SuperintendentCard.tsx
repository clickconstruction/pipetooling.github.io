import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useJobStageChecklists } from '../../hooks/useJobStageChecklists'
import { useExpectedHours } from '../../hooks/useExpectedHours'
import { loadProjectBoardRead } from '../../hooks/useProjectsBoard'
import { useLineBudgetSettings } from '../../hooks/useLineBudgetSettings'
import { useSuperintendentScores } from '../../hooks/useSuperintendentScores'
import { bonusWords, daysWords, hoursUnderWords, monthOf, monthRange, superintendentScores } from '../../lib/people/superintendentScores'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { isWorkingProject, projectLabel, projectNumber, projectPace, stagedFixtures } from '../../lib/jobs/projectsBoard'
import { laborEventsOf, valueEventsOf, type ProjectBoardJob } from '../../lib/jobs/projectBoardRead'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import type { JobStageChecklist } from '../../lib/jobs/stageChecklist'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { PaceStrip } from './PaceStrip'
import { PaceBar, PaceRail } from './PaceRail'
import { jobNameWithPlainDates } from '../../lib/jobNameDate'
import { AskMasterSheet } from './AskMasterSheet'
import { FinishDateSheet } from './FinishDateSheet'
import { FINISH_CALL_WORDS, finishAsk, latestFinishCall, saidRow, type FinishCall } from '../../lib/jobMode/finishCall'
import { loadFinishCalls, saveFinishCall } from '../../lib/jobMode/finishCallIo'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ASK_MASTER_WORDS, askedLine } from '../../lib/jobMode/askMaster'
import { canTagInJobNotes } from '../../lib/jobs/noteTags'
import { useJobNoteTags } from '../../hooks/useJobNoteTags'
import { PACE_CARD_WORDS, paceDayWords, paceFinish, paceHours, paceRailStages, paceRowNote, paceStageCheck, paceStagePrices, paceStageRail } from '../../lib/jobMode/paceCard'
import { PACE_READING_WORDS, paceReading, type PaceReadingTone } from '../../lib/jobMode/paceReading'
import { sayPercentStill } from '../../lib/jobMode/paceStillIo'
import { PACE_NEXT_STOP_WORDS } from '../../lib/jobMode/paceNextStop'
import { PaceReadingFace, PaceWhatFold } from './PaceReadingFace'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'
import { JobModeShortRow } from './JobModeShortRow'
import { JOB_MODE_SHORT_WORDS } from '../../lib/jobMode/jobModeShort'
import { DayDetailsModal } from './DayDetailsModal'
import { StageChecklistSheet } from '../stageChecklists/StageChecklistSheet'

/**
 * The superintendent's card on Job Mode (punch list #242, PR 4): the project's line, the same
 * strip the office's Projects board draws from the same read and the same `projectPace`, so the
 * two can never disagree — the headline (ahead or behind at this pace), the pace strip with the
 * real days and the stages, the target line when the office set one, the money only when it
 * leads, the proof, and the one move with its two presses: *Set the %* (the Dashboard's stepper)
 * and *Open the checklist* (the next stage with questions left). A tap on a day opens the day as
 * a window, in hours: a superintendent's read carries no wages (`list_project_board`). Drawn only
 * for a job that is a project; otherwise the card says nothing.
 *
 * `short` (punch list #384, the short Job Mode page): the card sits behind its own headline as one
 * row, ahead or behind in one line. A press opens the card, with a press to fold it again.
 *
 * Shown, not told (punch list #396): the card's face is the headline, the job's stages top to bottom
 * as a rail that ends in the finish day (`PaceRail`), the hours used as one bar, and **Set the %** on
 * the stage in hand. Everything the card used to say, the budget's source, the strip with its days,
 * the finish sentence, the target, the money, the proof and the month's score, sits behind **How this
 * is figured**. The folded row carries two thin bars and the finish day, so the reading is there
 * before a press. `lib/jobMode/paceCard.ts` works out the rows and the words.
 *
 * Job pace (the owner's walk of 2026-11-20): the face has a name and compares two things, **Hours used** and
 * **Work done**, as two bars on one scale with the gap hatched (`PaceReadingFace`, `lib/jobMode/paceReading.ts`).
 * The headline is in hours, never money: money that leads is one calm line. A gap is amber and asks *Is 40% still
 * right?* while hours have gone in since the percent was set, with **Still 40%** to say it again today, and red
 * only on a percent said since. **What is this?** says what the card compares, and opens by itself once.
 *
 * `nextStop` (the walk as a real superintendent, 2026-11-20): the Job Mode card draws this card for his next
 * stop when it has no job of its own, clocked in with no job linked or onto a bid, and the face says whose pace
 * it is, *Next stop: PLUM 1044 · Maple Court* (`lib/jobMode/paceNextStop.ts`).
 *
 * **Ask a master** (PR 2) opens `AskMasterSheet`: a question to the master on the job, sent as a job note
 * that tags him, with the card's numbers attached. The card then says who the question waits on, and that
 * an answer landed. `onAsked` tells the page a note was posted, so the job's feed reads again.
 *
 * **My finish date** (PR 3) opens `FinishDateSheet`: the day he says the job finishes, kept as a row of
 * `job_finish_calls`. His day is a row on the rail's foot, *You said*. Two days before the day in force, and
 * when the job is behind before he has said a day, the card asks on top, *Still finishing Fri, Nov 20?*, with
 * **Yes** and **Pick a day** (`lib/jobMode/finishCall.ts`). It moves neither the plan nor the score.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem' }
/** The card's border for each tone. Calm is the neutral border: nothing is red until the gap is real. */
const TONE_BORDER: Record<PaceReadingTone, string> = { red: '#dc2626', amber: '#d97706', green: '#16a34a', calm: 'var(--border-strong)' }

export type SuperintendentPctJob = { id: string; hcpNumber: string; jobName: string; label: string }

export function SuperintendentCard({ jobId, onSetPct, rev = 0, short = false, onAsked, nextStop }: {
  jobId: string
  onSetPct: (job: SuperintendentPctJob) => void
  rev?: number
  short?: boolean
  onAsked?: () => void
  /** The stop's label when the card is for his next stop, not the job on the Job Mode card (`lib/jobMode/paceNextStop.ts`). */
  nextStop?: string
}) {
  const [job, setJob] = useState<ProjectBoardJob | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const retry = useCallback(() => setTick((t) => t + 1), [])
  useEffect(() => {
    let gone = false
    setBusy(true)
    loadProjectBoardRead([jobId])
      .then((r) => {
        if (gone) return
        setJob(r.jobs[0] ?? null)
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (!gone) setFailure(recoveryFailureFromError(e, "This project's line could not be read."))
      })
      .finally(() => {
        if (!gone) setBusy(false)
      })
    return () => {
      gone = true
    }
  }, [jobId, rev, tick])
  if (failure && !job) return <OfflineRetryPanel failure={failure} onRetry={retry} surface="superintendent-line" idempotent busy={busy} />
  if (!job || job.id !== jobId || !isWorkingProject(job)) return null
  return <SuperintendentLineCard key={job.id} job={job} onSetPct={onSetPct} rev={rev} short={short} onAsked={onAsked} nextStop={nextStop} />
}

function SuperintendentLineCard({ job, onSetPct, rev, short, onAsked, nextStop }: { job: ProjectBoardJob; onSetPct: (job: SuperintendentPctJob) => void; rev: number; short: boolean; onAsked?: () => void; nextStop?: string }) {
  const [paceOpen, setPaceOpen] = useState(false)
  const [figuredOpen, setFiguredOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishCalls, setFinishCalls] = useState<FinishCall[]>([])
  const [finishRev, setFinishRev] = useState(0)
  const [finishBusy, setFinishBusy] = useState(false)
  // Still 40%: the percent said again in this sitting, held until the read comes back with its day.
  const [saidToday, setSaidToday] = useState(false)
  const [stillBusy, setStillBusy] = useState(false)
  const { showToast } = useToastContext()
  // What was said on this job. A read that fails leaves the card as it reads without it: his day is an addition to
  // a card that is whole, and a refusal here must never take the pace away.
  useEffect(() => {
    let alive = true
    loadFinishCalls(job.id).then(
      (rows) => {
        if (alive) setFinishCalls(rows)
      },
      () => {
        if (alive) setFinishCalls([])
      },
    )
    return () => {
      alive = false
    }
  }, [job.id, finishRev])
  const { user, profileName, role } = useAuth()
  // His own question on this job: who it waits on, or that an answer landed.
  const noteTags = useJobNoteTags(canTagInJobNotes(role) ? job.id : null, rev)
  const asked = useMemo(() => askedLine([...noteTags.values()].flat(), user?.id, Date.now()), [noteTags, user?.id])
  const checklists = useJobStageChecklists(job.id, undefined, rev)
  const ids = useMemo(() => [job.id], [job.id])
  const targets = useExpectedHours(ids, true)
  const { settings: lineBudgetSettings } = useLineBudgetSettings()
  // The score this month (punch list #234 PR 4): his own row, hours and days and the bonus, no wage.
  const today = todayYmdInAppTz()
  const scoreRange = useMemo(() => monthRange(monthOf(today)), [today])
  const scores = useSuperintendentScores({ fromYmd: scoreRange.fromYmd, toYmd: scoreRange.toYmd, jobIds: ids })
  const myScore = useMemo(() => (scores.read ? superintendentScores(scores.read, today).find((s) => s.userId === user?.id) ?? null : null), [scores.read, today, user?.id])
  const [day, setDay] = useState<string | null>(null)
  const [sheet, setSheet] = useState<JobStageChecklist | null>(null)
  const rows = checklists.rows ?? []
  const checklist = rows.reduce((s, r) => ({ answered: s.answered + r.state.answered, asked: s.asked + r.state.asked }), { answered: 0, asked: 0 })
  // The office's sign-off and the subs' sheet hours ride the same read as the score, so the proof line and the hours in
  // say what the Scoreboard counts (the second walk's slips 3 and 4).
  const scoreRow = scores.read?.rows.find((r) => r.jobId === job.id) ?? null
  const pace = projectPace({ job, target: targets.byJob.get(job.id) ?? null, checklist, settings: lineBudgetSettings, score: scoreRow ? { certifiedPct: scoreRow.certifiedPct, signedOn: scoreRow.signedOn, subHours: scoreRow.subHours, awardedHours: scoreRow.awardedHours, awardedKind: scoreRow.awardedKind } : null })
  const line = pace.line
  const used = pace.input.hoursUsed ?? 0
  // The next stage with a question left, else the first stage with a checklist at all.
  const nextStage = rows.find((r) => r.state.standing === 'not_ready') ?? rows.find((r) => r.state.standing !== 'none') ?? null
  const current = sheet ? rows.find((r) => r.fixtureId === sheet.fixtureId) ?? sheet : null
  // The crew's reading: hours used against work done, in hours. Money never makes its headline.
  const reading = paceReading({
    pctDone: pace.input.pctDone,
    hoursUsed: pace.input.hoursUsed,
    subHours: pace.input.subHours ?? null,
    hoursBudget: pace.input.hoursBudget,
    crewHoursPerDay: line.hoursPerDay,
    values: job.values,
    laborDays: pace.input.laborDays ?? [],
    todayYmd: today,
    money: line.money ? { leads: line.money.leads, wrong: line.money.wrong } : null,
    saidToday,
  })
  const border = TONE_BORDER[reading.tone]
  const label = projectLabel(job)
  // The rail's rows: the stages in order by name, and every other bid line as one last row, Other work. A line that
  // is not a stage is named by the office for the office, and the live walk found a paragraph of scope on a phone.
  // Each row's price rides along: the job's percent is built from the stages by price, so the rail spreads it the same way.
  const prices = paceStagePrices(
    stagedFixtures(job.fixtures ?? []).filter((f) => f.line_kind !== 'discount').map((f) => ({ id: f.id, price: Number(f.line_unit_price ?? 0) * (Number(f.count) || 1) })),
    pace.stages.map((s) => s.id),
  )
  const railStages = paceRailStages(pace.stages.map((s, i) => ({ id: s.id, name: s.name, hours: s.hours, pctDone: s.pctDone, kind: pace.shares[i]?.kind ?? 'order', price: prices.get(s.id) })))
  const rail = paceStageRail(railStages, pace.input.pctDone)
  // Each row's checklist (punch list #397, PR 5): a stage is its line, so its checklist is found by the line's id.
  // The folded row opens the first of its lines' checklists with a question left, else the first with any. A row
  // with no question is no press.
  const railChecks = rail
    ? railStages.map((s) => {
        const found = s.lineIds.flatMap((id) => {
          const row = rows.find((r) => r.fixtureId === id) ?? null
          const check = row ? paceStageCheck(row.state) : null
          return row && check ? [{ row, check }] : []
        })
        const pick = found.find((f) => !f.check.ready) ?? found[0] ?? null
        return pick ? { ...pick.check, onOpen: () => setSheet(pick.row) } : null
      })
    : undefined
  const finish = paceFinish({ plannedFinishYmd: pace.input.plannedFinishYmd, days: line.days, tone: line.tone })
  const hours = paceHours({ hoursUsed: pace.input.hoursUsed, subHours: pace.input.subHours ?? null, hoursBudget: pace.input.hoursBudget })
  const hoursColor = reading.tone === 'red' || hours?.over ? '#dc2626' : '#f59e0b'
  const setPct = () => onSetPct({ id: job.id, hcpNumber: projectNumber(job), jobName: job.job_name ?? '', label })
  const mine = latestFinishCall(finishCalls, user?.id)
  const said = saidRow(mine)
  const ask = finishAsk({ plannedYmd: pace.input.plannedFinishYmd, mine, todayYmd: today, saidTodayYmd: mine ? calendarYmdInAppTzFromIso(mine.createdAt) : null, behind: reading.state === 'over' })
  // Yes: the day in the question, said again today in his name.
  const sayYes = async () => {
    if (!ask || finishBusy) return
    setFinishBusy(true)
    try {
      await saveFinishCall({ jobId: job.id, finishOn: ask.ymd, planWas: pace.input.plannedFinishYmd, why: null })
      showToast(FINISH_CALL_WORDS.saved(paceDayWords(ask.ymd) ?? ask.ymd), 'success')
      setFinishRev((n) => n + 1)
    } catch (e) {
      showToast(formatErrorMessage(e, FINISH_CALL_WORDS.failed), 'error')
    } finally {
      setFinishBusy(false)
    }
  }
  // Still 40%: the same percent, said again today. The read then carries today as the percent's day.
  const sayStill = async () => {
    if (reading.stillPct == null || stillBusy || !user?.id) return
    setStillBusy(true)
    try {
      await sayPercentStill({ authUserId: user.id, jobId: job.id, pct: reading.stillPct })
      showToast(PACE_READING_WORDS.stillSaved(reading.stillPct), 'success')
      setSaidToday(true)
      onAsked?.()
    } catch (e) {
      showToast(formatErrorMessage(e, PACE_READING_WORDS.stillFailed), 'error')
    } finally {
      setStillBusy(false)
    }
  }
  // My finish date and Ask a master. They sit right under the reading when the gap is real, and under the rail otherwise.
  const presses = (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" data-testid="pace-finish-date" onClick={() => setFinishOpen(true)} style={{ flex: 1, minHeight: PHONE_PRESS_MIN_HEIGHT, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
          {FINISH_CALL_WORDS.press}
        </button>
        {canTagInJobNotes(role) ? (
          <button type="button" data-testid="pace-ask-master" onClick={() => setAskOpen(true)} style={{ flex: 1, minHeight: PHONE_PRESS_MIN_HEIGHT, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
            {ASK_MASTER_WORDS.press}
          </button>
        ) : null}
      </div>
      {asked ? <div data-testid="pace-asked" data-waiting={asked.waiting ? '' : undefined} style={{ fontSize: '0.8rem', color: asked.waiting ? 'var(--text-muted)' : 'var(--text-green-700)' }}>{asked.words}</div> : null}
    </div>
  )
  const gapIsReal = reading.state === 'over'
  // Whose pace this is, when the card is for his next stop and not the job on the Job Mode card.
  const forWords = nextStop ? PACE_NEXT_STOP_WORDS.stop(nextStop) : undefined
  // The checklist is the other move when the card asks for one: a gap, an old percent, or no percent yet.
  const checklistMove = reading.state === 'over' || reading.state === 'old' || reading.state === 'no-percent'
  // The short page: the headline as a row, with the two thin bars and the finish day. The hooks above still read,
  // so the open card draws at once.
  if (short && !paceOpen) {
    return (
      <JobModeShortRow
        testId="superintendent-line-short"
        title={reading.headline}
        note={forWords ? `${forWords}. ${PACE_CARD_WORDS.rowOpen}` : paceRowNote(pace.input.plannedFinishYmd)}
        tone={reading.tone === 'green' ? 'ahead' : reading.tone === 'red' ? 'behind' : undefined}
        expanded={false}
        onPress={() => setPaceOpen(true)}
        picture={
          !reading.bars ? null : (
            <>
              <PaceBar testId="pace-row-work" fillPct={line.donePct} color="#2563eb" thin />
              {hours ? <PaceBar testId="pace-row-hours" fillPct={hours.fillPct} color={hoursColor} thin /> : null}
            </>
          )
        }
      />
    )
  }
  return (
    <div data-testid="superintendent-line" data-tone={line.tone} data-reading={reading.state} style={{ border: `2px solid ${border}`, borderRadius: 12, padding: '0.7rem 0.8rem', display: 'grid', gap: 10, background: 'var(--surface)', minWidth: 0 }}>
      <PaceReadingFace reading={reading} onSetPct={setPct} onStill={() => void sayStill()} stillBusy={stillBusy} forWords={forWords} />
      {short ? (
        <button type="button" data-testid="superintendent-line-fold" aria-expanded onClick={() => setPaceOpen(false)} style={{ justifySelf: 'start', minHeight: PHONE_PRESS_MIN_HEIGHT, padding: '0 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-link)', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
          {JOB_MODE_SHORT_WORDS.pace.fold}
        </button>
      ) : null}
      {reading.finishAsk && !ask ? <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{reading.finishAsk}</div> : null}
      {ask ? (
        <div data-testid="pace-finish-ask" style={{ border: '1px solid #2563eb', borderRadius: 10, padding: '0.6rem 0.7rem', display: 'grid', gap: 8, background: 'var(--bg-blue-tint)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>{ask.words}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!ask.past ? (
              <button type="button" data-testid="pace-finish-yes" disabled={finishBusy} onClick={() => void sayYes()} style={{ flex: 1, minHeight: PHONE_PRESS_MIN_HEIGHT, borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', font: 'inherit', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
                {FINISH_CALL_WORDS.yes}
              </button>
            ) : null}
            <button type="button" data-testid="pace-finish-pick" onClick={() => setFinishOpen(true)} style={{ flex: 1, minHeight: PHONE_PRESS_MIN_HEIGHT, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
              {FINISH_CALL_WORDS.pick}
            </button>
          </div>
        </div>
      ) : null}
      {gapIsReal ? presses : null}
      {rail ? <PaceRail rail={rail} finish={finish} said={said} onSetPct={setPct} checks={railChecks} setPct={reading.setPctAsk != null ? 'none' : 'quiet'} /> : null}
      {/* A job with no stages to list has no rail to end in the finish day, so the day is said in words. */}
      {!rail && finish.planned ? <div style={{ fontSize: '0.85rem' }} data-testid="pace-finish-words">{PACE_CARD_WORDS.finish} {finish.planned}{finish.atPace ? `. ${PACE_CARD_WORDS.atPace}, ${finish.atPace.words}.` : '.'}</div> : null}
      {!rail && said ? <div style={{ fontSize: '0.85rem' }} data-testid="pace-said-words">{FINISH_CALL_WORDS.said} {said.day}.{said.why ? ` ${said.why}` : ''}</div> : null}
      {/* The stage in hand carries Set the % on the rail, or the face does. With no rail and no press on the face, it is here. */}
      {(!rail && reading.setPctAsk == null) || (checklistMove && nextStage) ? (
        <div style={{ display: 'flex', gap: 8 }}>
          {!rail && reading.setPctAsk == null ? (
            <button type="button" onClick={setPct} style={{ flex: 1, minHeight: PHONE_PRESS_MIN_HEIGHT, borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', font: 'inherit', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
              {PACE_CARD_WORDS.setPct}
            </button>
          ) : null}
          {checklistMove && nextStage ? (
            <button type="button" onClick={() => setSheet(nextStage)} style={{ flex: 1, minHeight: PHONE_PRESS_MIN_HEIGHT, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.85rem', cursor: 'pointer' }}>
              Open the checklist
            </button>
          ) : null}
        </div>
      ) : null}
      {gapIsReal ? null : presses}
      {reading.moneyLine ? <div style={muted} data-testid="pace-money-line">{reading.moneyLine}</div> : null}
      {reading.leftLine ? <div style={muted} data-testid="pace-left"><ValueSentence text={reading.leftLine} /></div> : null}
      <PaceWhatFold userId={user?.id} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" data-testid="pace-figured" aria-expanded={figuredOpen} onClick={() => setFiguredOpen((o) => !o)} style={{ justifySelf: 'start', minHeight: PHONE_PRESS_MIN_HEIGHT, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
          {PACE_CARD_WORDS.figured} {figuredOpen ? '▴' : '▾'}
        </button>
        {/* The door from this project to every project (punch list #397, PR 5): the board opened for a superintendent, and only the search led to it. */}
        <Link to="/projects-board" data-testid="pace-all-projects" style={{ minHeight: PHONE_PRESS_MIN_HEIGHT, display: 'inline-flex', alignItems: 'center', color: 'var(--text-link)', fontSize: '0.82rem', textDecoration: 'none' }}>
          {PACE_CARD_WORDS.allProjects}
        </Link>
      </div>
      {figuredOpen ? (
        <div data-testid="pace-figured-body" style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <div style={muted}>{jobNameWithPlainDates(label)} · {line.hoursWords}</div>
          {rail?.from === 'job' ? <div style={muted}>{PACE_CARD_WORDS.fromJob}</div> : null}
          <PaceStrip line={line} hoursBudget={Math.max(pace.budgetEdge, used)} targetHours={pace.input.hoursBudget} days={pace.input.laborDays ?? []} stages={pace.stages} stageWords={pace.stages.length <= 4} onDay={setDay} />
          {/* The strip's legend carries the money; the words stay for a plan that exists, a target that was set, and money that leads. */}
          {line.finishWords.startsWith('Planned') ? <div style={{ fontSize: '0.8rem' }}>{line.finishWords}</div> : null}
          {line.targetLine ? <div style={{ fontSize: '0.78rem', color: 'var(--text-700)', background: 'var(--bg-subtle)', borderRadius: 6, padding: '0.3rem 0.45rem' }} data-testid="superintendent-target">🎯 {line.targetLine}</div> : null}
          {line.money?.leads ? <div style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }} data-testid="superintendent-money">{line.money.words}</div> : null}
          {targets.error ? <div style={muted}>{targets.error}</div> : null}
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>{line.proofWords}</div>
          {myScore ? (
            <div style={{ fontSize: '0.8rem', background: 'var(--bg-subtle)', borderRadius: 6, padding: '0.35rem 0.5rem' }} data-testid="superintendent-score">
              {myScore.jobs.length > 0
                ? `Scored this month: ${hoursUnderWords(myScore.hoursUnder)}${daysWords(myScore.daysVsPlan) ? ` · ${daysWords(myScore.daysVsPlan)}` : ''}${bonusWords(myScore.bonusUsd, scores.read?.sharePct ?? 10) ? ` · bonus ${bonusWords(myScore.bonusUsd, scores.read?.sharePct ?? 10)}` : ''}`
                : `Not scored yet this month: ${myScore.held[0]?.why ?? 'waiting on the office’s sign-off'}.`}
            </div>
          ) : null}
        </div>
      ) : null}
      {askOpen ? <AskMasterSheet jobId={job.id} facts={{ pct: pace.input.pctDone, hoursWords: hours?.words ?? null, finishWords: finish.planned, stage: rail?.rows.find((r) => r.state === 'now')?.name ?? null }} onClose={() => setAskOpen(false)} onSent={onAsked} /> : null}
      {finishOpen ? <FinishDateSheet jobId={job.id} plannedYmd={pace.input.plannedFinishYmd} saidYmd={mine?.finishOn ?? null} saidWhy={mine?.why ?? null} onClose={() => setFinishOpen(false)} onSaved={() => setFinishRev((n) => n + 1)} /> : null}
      {day ? <DayDetailsModal jobLabel={label} ymd={day} events={laborEventsOf(job)} valueEvents={valueEventsOf(job)} hoursOnly onClose={() => setDay(null)} /> : null}
      {current ? (
        <StageChecklistSheet
          jobId={job.id}
          stage={{ fixtureId: current.fixtureId, name: current.name, sequenceOrder: current.sequenceOrder }}
          questions={checklists.questions}
          answers={checklists.answersByFixture.get(current.fixtureId) ?? []}
          who={{ userId: user?.id ?? null, name: profileName ?? '' }}
          io={checklists.io}
          onAnswer={checklists.putAnswer}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </div>
  )
}

export default SuperintendentCard
