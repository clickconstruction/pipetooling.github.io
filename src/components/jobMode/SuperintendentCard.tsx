import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useJobStageChecklists } from '../../hooks/useJobStageChecklists'
import { useExpectedHours } from '../../hooks/useExpectedHours'
import { loadProjectBoardRead } from '../../hooks/useProjectsBoard'
import { useLineBudgetSettings } from '../../hooks/useLineBudgetSettings'
import { useSuperintendentScores } from '../../hooks/useSuperintendentScores'
import { bonusWords, daysWords, hoursUnderWords, monthOf, monthRange, superintendentScores } from '../../lib/people/superintendentScores'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { isWorkingProject, projectLabel, projectNumber, projectPace } from '../../lib/jobs/projectsBoard'
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
import { PACE_CARD_WORDS, paceDayWords, paceDaysLeftWords, paceFinish, paceHours, paceRowNote, paceStageRail } from '../../lib/jobMode/paceCard'
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

export type SuperintendentPctJob = { id: string; hcpNumber: string; jobName: string; label: string }

export function SuperintendentCard({ jobId, onSetPct, rev = 0, short = false, onAsked }: { jobId: string; onSetPct: (job: SuperintendentPctJob) => void; rev?: number; short?: boolean; onAsked?: () => void }) {
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
  return <SuperintendentLineCard key={job.id} job={job} onSetPct={onSetPct} rev={rev} short={short} onAsked={onAsked} />
}

function SuperintendentLineCard({ job, onSetPct, rev, short, onAsked }: { job: ProjectBoardJob; onSetPct: (job: SuperintendentPctJob) => void; rev: number; short: boolean; onAsked?: () => void }) {
  const [paceOpen, setPaceOpen] = useState(false)
  const [figuredOpen, setFiguredOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishCalls, setFinishCalls] = useState<FinishCall[]>([])
  const [finishRev, setFinishRev] = useState(0)
  const [finishBusy, setFinishBusy] = useState(false)
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
  const border = line.tone === 'ahead' ? '#16a34a' : line.tone === 'behind' ? '#dc2626' : 'var(--border-strong)'
  const headColor = line.tone === 'ahead' ? 'var(--text-green-700)' : line.tone === 'behind' ? 'var(--text-red-700)' : 'var(--text-700)'
  const label = projectLabel(job)
  const rail = paceStageRail(pace.stages, pace.input.pctDone)
  const finish = paceFinish({ plannedFinishYmd: pace.input.plannedFinishYmd, days: line.days, tone: line.tone })
  const hours = paceHours({ hoursUsed: pace.input.hoursUsed, subHours: pace.input.subHours ?? null, hoursBudget: pace.input.hoursBudget })
  const daysLeft = paceDaysLeftWords(line.daysLeft)
  const hoursColor = line.tone === 'behind' || hours?.over ? '#dc2626' : '#f59e0b'
  const setPct = () => onSetPct({ id: job.id, hcpNumber: projectNumber(job), jobName: job.job_name ?? '', label })
  const mine = latestFinishCall(finishCalls, user?.id)
  const said = saidRow(mine)
  const ask = finishAsk({ plannedYmd: pace.input.plannedFinishYmd, mine, todayYmd: today, saidTodayYmd: mine ? calendarYmdInAppTzFromIso(mine.createdAt) : null, behind: line.tone === 'behind' })
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
  // The short page: the headline as a row, with the two thin bars and the finish day. The hooks above still read,
  // so the open card draws at once.
  if (short && !paceOpen) {
    return (
      <JobModeShortRow
        testId="superintendent-line-short"
        title={line.headline}
        note={paceRowNote(pace.input.plannedFinishYmd)}
        tone={line.tone === 'ahead' || line.tone === 'behind' ? line.tone : undefined}
        expanded={false}
        onPress={() => setPaceOpen(true)}
        picture={
          line.tone === 'early' ? null : (
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
    <div data-testid="superintendent-line" data-tone={line.tone} style={{ border: `2px solid ${border}`, borderRadius: 12, padding: '0.7rem 0.8rem', display: 'grid', gap: 10, background: 'var(--surface)', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: headColor }}>{line.headline}</div>
        {daysLeft ? <div style={muted} data-testid="pace-days-left">{daysLeft}</div> : null}
      </div>
      {short ? (
        <button type="button" data-testid="superintendent-line-fold" aria-expanded onClick={() => setPaceOpen(false)} style={{ justifySelf: 'start', minHeight: PHONE_PRESS_MIN_HEIGHT, padding: '0 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-link)', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
          {JOB_MODE_SHORT_WORDS.pace.fold}
        </button>
      ) : null}
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
      {rail ? (
        <PaceRail rail={rail} finish={finish} said={said} onSetPct={setPct} />
      ) : (
        <PaceBar testId="pace-work" label={PACE_CARD_WORDS.work} words={`${Math.round(line.donePct)}%`} fillPct={line.donePct} color="#2563eb" />
      )}
      {hours ? <PaceBar testId="pace-hours" label={PACE_CARD_WORDS.hours} words={hours.words} fillPct={hours.fillPct} color={hoursColor} /> : null}
      {/* A job with no stages to list has no rail to end in the finish day, so the day is said in words. */}
      {!rail && finish.planned ? <div style={{ fontSize: '0.85rem' }} data-testid="pace-finish-words">{PACE_CARD_WORDS.finish} {finish.planned}{finish.atPace ? `. ${PACE_CARD_WORDS.atPace}, ${finish.atPace.words}.` : '.'}</div> : null}
      {!rail && said ? <div style={{ fontSize: '0.85rem' }} data-testid="pace-said-words">{FINISH_CALL_WORDS.said} {said.day}.{said.why ? ` ${said.why}` : ''}</div> : null}
      {line.move ? <div style={{ fontSize: '0.85rem' }}>{line.move.why}</div> : null}
      {/* The stage in hand carries Set the % on the rail. With no rail, or when the line asks for a move, the press is here too. */}
      {!rail || (line.move && nextStage) ? (
        <div style={{ display: 'flex', gap: 8 }}>
          {!rail ? (
            <button type="button" onClick={setPct} style={{ flex: 1, minHeight: PHONE_PRESS_MIN_HEIGHT, borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', font: 'inherit', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
              {PACE_CARD_WORDS.setPct}
            </button>
          ) : null}
          {line.move && nextStage ? (
            <button type="button" onClick={() => setSheet(nextStage)} style={{ flex: 1, minHeight: PHONE_PRESS_MIN_HEIGHT, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.85rem', cursor: 'pointer' }}>
              Open the checklist
            </button>
          ) : null}
        </div>
      ) : null}
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
      <button type="button" data-testid="pace-figured" aria-expanded={figuredOpen} onClick={() => setFiguredOpen((o) => !o)} style={{ justifySelf: 'start', minHeight: PHONE_PRESS_MIN_HEIGHT, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
        {PACE_CARD_WORDS.figured} {figuredOpen ? '▴' : '▾'}
      </button>
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
