/**
 * A checklist per stage (punch list #164, PR 3; rebuilt as the second pass of punch list #237, PR 1): the sheet the
 * crew fills for one stage of a job, from Job Mode or the job window. While the list is open it keeps one row open
 * at a time: a progress line and bar under the title, the next unanswered question as the one big row labelled
 * *Next* with Yes, No and Not here at 44 px, its photo press where it asks for one and *Add a note* as a link; every
 * other row a statement, ✓ ✗ or — · the words · the name and the time · a thumbnail where there is a photo, which a
 * tap reopens to change. After an answer the list moves to the next question by itself. The questions sit in two
 * groups, *The company's questions* and *Added for this job*, each item saying who added it and when; whoever authors
 * on the job (the office, the superintendent on their own job, the estimator on a job they priced) adds a check at the
 * foot of the second group, with its plan sheet and its why, the box staying open for the next one, skips a company
 * question on this job with a reason, puts it back, and moves the job's own checks with ▲ and ▼ (PR 1b). A check that
 * names a plan sheet wears a chip that opens the job's Plans folder. Every press writes at once, so a sheet closed
 * early keeps what was answered. The photo is shrunk on the phone, named for the stage and
 * the question (`checklistPhotoName`), put in the bucket and filed in the customer's Drive folder by the photo-save
 * sweep. The foot carries the rule: the stage reads not ready on the Pipeline until every question is answered. The
 * rules are `lib/jobs/stageChecklist.ts` and `stageChecklistItems.ts`.
 */
import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import type { UserRole } from '../../hooks/useAuth'
import { bytesWords, shrinkPhoto } from '../../lib/materials/photoShrink'
import { readTakenAt } from '../../lib/photos/photoTakenAt'
import {
  PICK_WORDS,
  STAGE_CHECKLIST_PICKS,
  addSkip,
  answerStampWords,
  checklistPhotoName,
  checklistProgress,
  dropSkip,
  groupCountWords,
  isJobItem,
  noQuestionsWords,
  progressWords,
  questionWaitsOn,
  savedWords,
  sheetFootWords,
  skippedFor,
  stageChecklistKindOf,
  stageChecklistState,
  templateFor,
  templateGroups,
  waitsOnWords,
  type JobStageRef,
  type StageChecklistPick,
  type StageChecklistQuestion,
} from '../../lib/jobs/stageChecklist'
import {
  GROUP_WORDS,
  ITEM_WHY_MAX_CHARS,
  MOVE_WORDS,
  PLAN_SHEET_MAX_CHARS,
  SKIP_WHY_MAX_CHARS,
  TAKE_OFF_WORDS,
  addCheckWords,
  addedSoFarWords,
  addedWords,
  canSkipQuestion,
  canTakeOffJobItem,
  itemMetaWords,
  jobItemProblem,
  movedOrder,
  nextItemOrder,
  noJobItemsWords,
  putBackToastWords,
  skipProblem,
  skipWords,
  skippedLineWords,
  skippedToastWords,
  takenOffWords,
  withOrder,
} from '../../lib/jobs/stageChecklistItems'
import type { AnswerWho, JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { CHECKLIST_PHOTO_WORDS } from '../../lib/photos/reportPhotoChecklist'
import { formatErrorMessage } from '../../utils/errorHandling'
import { CameraGlyph } from '../materials/PhotoPress'
import * as S from '../jobMode/sheetStyles'
import { PlanSheetChip } from './PlanSheetChip'

export interface StageChecklistSheetProps {
  jobId: string
  stage: JobStageRef
  /** Every live question on the job; the sheet picks the stage's own out by its kind and its id. */
  questions: readonly StageChecklistQuestion[]
  /** The stage's answers as read; the sheet keeps its own copy as presses land. */
  answers: readonly JobAnswer[]
  who: AnswerWho
  /** The viewer's role: the office or the adder takes a check off (#237). */
  role?: UserRole | null
  /** True when this person adds, skips and orders the checks on this job (`canAuthorOnJob`, PR 1b). */
  canAuthor?: boolean
  /** The job's Plans folder, the door a plan-sheet chip opens; the chip is words alone without one. */
  plansUrl?: string | null
  io: StageChecklistSheetIo
  /** Each saved answer, for the strip's count. */
  onAnswer: (answer: JobAnswer) => void
  /** A check added for this stage (#237), so every reader counts it at once. */
  onQuestionAdded?: (question: StageChecklistQuestion) => void
  /** A check taken off. */
  onQuestionRetired?: (questionId: string) => void
  /** Questions that changed in place: a skip, a put back or a new order (PR 1b). */
  onQuestionsChanged?: (questions: readonly StageChecklistQuestion[]) => void
  onClose: () => void
  /**
   * The sheet in its own window, the strip's way, or its rows inline inside another sheet: the Pipeline row's door
   * (punch list #246) draws one stage after another this way, each with the same rows and presses, and keeps the
   * Close for itself.
   */
  frame?: 'sheet' | 'inline'
}

/** What the add box hands up for one check. */
export interface AddCheckDraft {
  words: string
  asksPhoto: boolean
  sheet: string
  why: string
}

const groupHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', margin: '0.9rem 0 0.2rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const statement: CSSProperties = { display: 'grid', gridTemplateColumns: '1.4rem minmax(0, 1fr) auto', gap: '0.15rem 0.5rem', alignItems: 'start', width: '100%', padding: '0.55rem 0', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0, textAlign: 'left', font: 'inherit', color: 'var(--text-strong)', cursor: 'pointer' }
const glyphStyle: Record<'yes' | 'no' | 'not_here' | 'open', CSSProperties> = {
  yes: { fontWeight: 700, color: 'var(--text-green-700)' },
  no: { fontWeight: 700, color: 'var(--text-red-700)' },
  not_here: { fontWeight: 700, color: 'var(--text-muted)' },
  open: { fontWeight: 700, color: 'var(--text-muted)' },
}
const open: CSSProperties = { border: '1.5px solid var(--border-strong)', borderRadius: 12, padding: '0.7rem 0.75rem', display: 'grid', gap: '0.55rem', background: 'var(--surface)', marginTop: '0.35rem' }
const nextTag: CSSProperties = { display: 'inline-block', padding: '0.05rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'var(--bg-blue-200)', color: 'var(--text-blue-700)' }
const needTag: CSSProperties = { display: 'inline-block', padding: '0.05rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
const qWords: CSSProperties = { fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)', margin: 0, lineHeight: 1.35 }
const chip: CSSProperties = { minHeight: 44, flex: 1, padding: '0 0.6rem', borderRadius: 10, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 700, cursor: 'pointer' }
const chipOn: Record<StageChecklistPick, CSSProperties> = {
  yes: { background: 'var(--bg-green-tint)', borderColor: '#16a34a', color: 'var(--text-green-800)' },
  no: { background: 'var(--bg-red-tint)', borderColor: '#dc2626', color: 'var(--text-red-700)' },
  not_here: { background: 'var(--bg-subtle)', borderColor: 'var(--text-muted)', color: 'var(--text-muted)' },
}
const noteStyle: CSSProperties = { width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.95rem' }
const meta: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const waits: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-amber-700)', fontWeight: 600, margin: 0 }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.875rem', fontWeight: 600 }
const quiet: CSSProperties = { ...link, color: 'var(--text-muted)', fontWeight: 500 }
const photoBtn: CSSProperties = { ...S.secondaryBtn, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minHeight: 44 }
const addBox: CSSProperties = { border: '1px dashed var(--border-strong)', borderRadius: 10, padding: '0.6rem 0.7rem', display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }
const askBox: CSSProperties = { display: 'grid', gap: '0.4rem', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.5rem 0.6rem' }
const headPress: CSSProperties = { ...quiet, minHeight: 44 }
const arrow: CSSProperties = { ...quiet, minWidth: 44, minHeight: 44, fontSize: '0.9rem', padding: 0, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }
const skippedRow: CSSProperties = { display: 'grid', gridTemplateColumns: '1.4rem minmax(0, 1fr) auto', gap: '0.15rem 0.5rem', alignItems: 'start', padding: '0.55rem 0', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }

export function StageChecklistSheet({ jobId, stage, questions, answers: given, who, role = null, canAuthor = false, plansUrl = null, io, onAnswer, onQuestionAdded, onQuestionRetired, onQuestionsChanged, onClose, frame = 'sheet' }: StageChecklistSheetProps) {
  const { showToast } = useToastContext()
  const kind = stageChecklistKindOf(stage.name)
  const template = useMemo(() => (kind ? templateFor(questions, kind, stage.fixtureId) : []), [questions, kind, stage.fixtureId])
  const groups = useMemo(() => templateGroups(template), [template])
  const skipped = useMemo(() => (kind ? skippedFor(questions, kind, stage.fixtureId) : []), [questions, kind, stage.fixtureId])
  const [answers, setAnswers] = useState<JobAnswer[]>(() => [...given])
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [noteOpen, setNoteOpen] = useState<string | null>(null)
  // The row the person tapped to change; null means the next unanswered question is the open row.
  const [reopened, setReopened] = useState<string | null>(null)
  const [takingOff, setTakingOff] = useState<string | null>(null)
  const [skipping, setSkipping] = useState<string | null>(null)
  const [skipWhy, setSkipWhy] = useState('')
  const [skipBlocked, setSkipBlocked] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const byQuestion = useMemo(() => new Map(answers.map((a) => [a.questionId, a])), [answers])
  const state = useMemo(() => stageChecklistState({ stageName: stage.name, fixtureId: stage.fixtureId, questions, answers }), [stage.name, stage.fixtureId, questions, answers])
  const progress = useMemo(() => checklistProgress(template, byQuestion), [template, byQuestion])
  const openId = reopened && template.some((q) => q.id === reopened) ? reopened : (progress.next?.id ?? null)

  const land = (a: JobAnswer) => {
    setAnswers((prev) => [...prev.filter((x) => x.id !== a.id && x.questionId !== a.questionId), a])
    onAnswer(a)
  }
  const key = (q: StageChecklistQuestion) => ({ jobId, fixtureId: stage.fixtureId, questionId: q.id })

  const pick = async (q: StageChecklistQuestion, p: StageChecklistPick) => {
    setBusy(q.id)
    try {
      land(await io.pick(key(q), p, who))
      // The row is about to close, and a closed box never fires its blur: a note typed and not yet left saves now.
      await note(q)
      // The list moves on by itself once the row is answered; a row still owing its photo stays open as Next.
      setReopened(null)
    } catch (e) {
      showToast(`The answer was not saved. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  const note = async (q: StageChecklistQuestion) => {
    const was = byQuestion.get(q.id)?.note ?? ''
    const next = (notes[q.id] ?? was).trim()
    if (next === was.trim()) return
    try {
      land(await io.note(key(q), next, who))
    } catch (e) {
      showToast(`The note was not saved. ${formatErrorMessage(e)}`, 'error')
    }
  }
  // A press that closes the open row saves a note still in its box; a phone can keep the box focused through a tap.
  const saveOpenNote = () => {
    const q = template.find((x) => x.id === openId)
    if (q) void note(q)
  }
  const takeOff = async (q: StageChecklistQuestion) => {
    setBusy(q.id)
    try {
      await io.retireItem(q.id, who)
      setTakingOff(null)
      onQuestionRetired?.(q.id)
      const after = stageChecklistState({ stageName: stage.name, fixtureId: stage.fixtureId, questions: questions.filter((x) => x.id !== q.id), answers })
      showToast(takenOffWords(stage.name, after), 'success')
    } catch (e) {
      showToast(`The check was not taken off. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const skip = async (q: StageChecklistQuestion) => {
    const blocked = skipProblem(skipWhy)
    setSkipBlocked(blocked)
    if (blocked) return
    setBusy(q.id)
    try {
      const made = await io.skip({ jobId, fixtureId: stage.fixtureId, questionId: q.id, why: skipWhy }, who)
      const next = addSkip(q, made)
      onQuestionsChanged?.([next])
      setSkipping(null)
      setSkipWhy('')
      if (reopened === q.id) setReopened(null)
      const after = stageChecklistState({ stageName: stage.name, fixtureId: stage.fixtureId, questions: questions.map((x) => (x.id === q.id ? next : x)), answers })
      showToast(skippedToastWords(stage.name, after), 'success')
    } catch (e) {
      showToast(`The question was not skipped. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  const putBack = async (q: StageChecklistQuestion, skipId: string) => {
    setBusy(q.id)
    try {
      await io.putBack(skipId, who)
      const next = dropSkip(q, skipId)
      onQuestionsChanged?.([next])
      const after = stageChecklistState({ stageName: stage.name, fixtureId: stage.fixtureId, questions: questions.map((x) => (x.id === q.id ? next : x)), answers })
      showToast(putBackToastWords(stage.name, after), 'success')
    } catch (e) {
      showToast(`The question was not put back. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  const move = async (q: StageChecklistQuestion, by: -1 | 1) => {
    const ids = movedOrder(groups.job, q.id, by)
    if (!ids) return
    setBusy(q.id)
    try {
      await io.reorder(stage.fixtureId, ids)
      onQuestionsChanged?.(withOrder(questions, ids))
      // The list's next question can change with the order; the row being moved stays the open one.
      setReopened(q.id)
    } catch (e) {
      showToast(`The check did not move. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  // The rule, in the stage's name: under the rows inline, over the buttons in the sheet's own window.
  const ruleLine = (
    <p style={{ margin: frame === 'inline' ? '0.5rem 0 0' : '0 0 0.5rem', fontSize: '0.875rem', color: state.ready ? 'var(--text-green-800)' : 'var(--text-amber-700)', fontWeight: 600 }} data-checklist-foot>
      {state.asked > 0 ? `${progress.left === 0 ? 'All answered.' : `${progress.left} left.`} ${sheetFootWords(stage.name, state)}` : ''}
    </p>
  )
  const foot = (
    <div style={{ width: '100%' }}>
      {ruleLine}
      <div style={S.footerRow}>
        <button
          type="button"
          style={S.secondaryBtn}
          onClick={() => {
            saveOpenNote()
            onClose()
          }}
        >
          Close
        </button>
        {state.asked > 0 ? (
          <button
            type="button"
            style={state.ready ? S.primaryBtn : { ...S.primaryBtn, ...S.disabled }}
            disabled={!state.ready}
            onClick={() => {
              saveOpenNote()
              showToast(savedWords(stage.name, state), 'success')
              onClose()
            }}
          >
            Done
          </button>
        ) : null}
      </div>
    </div>
  )

  const skipLines = skipWords(stage.name)

  const row = (q: StageChecklistQuestion, index: number) => {
    const a = byQuestion.get(q.id) ?? null
    const waitsOn = questionWaitsOn(q, a)
    const isOpen = q.id === openId
    const isNext = isOpen && progress.next?.id === q.id && !reopened
    const added = itemMetaWords(q, who.userId)
    const mayTakeOff = canTakeOffJobItem(role, q, who.userId)
    const maySkip = canSkipQuestion(canAuthor, q)
    if (!isOpen) {
      const stamp = answerStampWords(a)
      const second = stamp ? `${waitsOn === 'photo' ? `${stamp} · waits for the photo` : stamp}` : [q.asksPhoto ? 'asks for a photo' : '', added].filter(Boolean).join(' · ')
      return (
        <Fragment key={q.id}>
          <button
            type="button"
            data-checklist-question={q.id}
            data-checklist-row="statement"
            style={statement}
            onClick={() => {
              saveOpenNote()
              // A take off or a skip asked on the row being left does not wait for it to reopen.
              setTakingOff(null)
              setSkipping(null)
              setReopened(q.id)
            }}
            aria-label={`${q.words}: ${a?.pick ? PICK_WORDS[a.pick] : 'not answered yet'}. Open to ${a?.pick ? 'change' : 'answer'}.`}
          >
            <span style={glyphStyle[a?.pick ?? 'open']} aria-hidden>
              {a?.pick === 'yes' ? '✓' : a?.pick === 'no' ? '✗' : a?.pick === 'not_here' ? '—' : '☐'}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: a?.pick ? 500 : 600, color: a?.pick ? 'var(--text-strong)' : 'var(--text-700)' }}>
                {index}. {q.words}
              </span>
              {second ? <span style={{ ...meta, display: 'block' }}>{second}</span> : null}
              {/* The stamp holds the line once answered, so an item says who added it on a line of its own. */}
              {stamp && added ? <span style={{ ...meta, display: 'block' }}>{added}</span> : null}
              {a?.note ? <span style={{ ...meta, display: 'block', fontStyle: 'italic' }}>“{a.note}”</span> : null}
            </span>
            {a?.photo ? <PhotoThumb answer={a} jobId={jobId} io={io} /> : <span />}
          </button>
          {/* The chip is the row's neighbour, never inside its button: a press on it opens the folder and not the row. */}
          {q.sheet ? (
            <div style={{ paddingLeft: '1.9rem', marginTop: '-0.35rem' }}>
              <PlanSheetChip sheet={q.sheet} plansUrl={plansUrl} />
            </div>
          ) : null}
        </Fragment>
      )
    }
    return (
      <div key={q.id} data-checklist-question={q.id} data-checklist-row="open" style={open}>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={nextTag}>{isNext ? 'Next' : 'Open'}</span>
          {q.asksPhoto ? <span style={needTag}>photo</span> : null}
          {q.sheet ? <PlanSheetChip sheet={q.sheet} plansUrl={plansUrl} /> : null}
          {added ? <span style={meta}>{added}</span> : null}
          {mayTakeOff && takingOff !== q.id ? (
            <button type="button" style={headPress} onClick={() => setTakingOff(q.id)} aria-label={`${TAKE_OFF_WORDS.press}: ${q.words}`}>
              {TAKE_OFF_WORDS.press}
            </button>
          ) : null}
          {maySkip && skipping !== q.id ? (
            <button
              type="button"
              style={headPress}
              onClick={() => {
                // The presses and the note box give way to the reason, and a closed box never fires its blur.
                saveOpenNote()
                setSkipWhy('')
                setSkipBlocked(null)
                setSkipping(q.id)
              }}
              aria-label={`${skipLines.press}: ${q.words}`}
            >
              {skipLines.press}
            </button>
          ) : null}
          {canAuthor && isJobItem(q) && groups.job.length > 1 ? (
            <span style={{ display: 'inline-flex', gap: '0.35rem' }}>
              <button type="button" style={groups.job[0]?.id === q.id ? { ...arrow, ...S.disabled } : arrow} disabled={busy === q.id || groups.job[0]?.id === q.id} onClick={() => void move(q, -1)} aria-label={`${MOVE_WORDS.up}: ${q.words}`}>
                ▲
              </button>
              <button type="button" style={groups.job[groups.job.length - 1]?.id === q.id ? { ...arrow, ...S.disabled } : arrow} disabled={busy === q.id || groups.job[groups.job.length - 1]?.id === q.id} onClick={() => void move(q, 1)} aria-label={`${MOVE_WORDS.down}: ${q.words}`}>
                ▼
              </button>
            </span>
          ) : null}
        </div>
        <p style={qWords}>
          {index}. {q.words}
        </p>
        {takingOff === q.id ? (
          <div style={askBox} data-checklist-take-off>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>{TAKE_OFF_WORDS.hint}</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" style={S.secondaryBtn} disabled={busy === q.id} onClick={() => void takeOff(q)}>
                {TAKE_OFF_WORDS.confirm}
              </button>
              <button type="button" style={quiet} onClick={() => setTakingOff(null)}>
                {TAKE_OFF_WORDS.keep}
              </button>
            </div>
          </div>
        ) : skipping === q.id ? (
          <div style={askBox} data-checklist-skip>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>{skipLines.hint}</span>
            <input
              type="text"
              aria-label={skipLines.label}
              placeholder={skipLines.placeholder}
              value={skipWhy}
              maxLength={SKIP_WHY_MAX_CHARS}
              autoFocus
              onChange={(e) => setSkipWhy(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                void skip(q)
              }}
              style={noteStyle}
            />
            {skipBlocked ? <p style={waits}>{skipBlocked}</p> : null}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" style={S.secondaryBtn} disabled={busy === q.id} onClick={() => void skip(q)}>
                {skipLines.confirm}
              </button>
              <button type="button" style={quiet} onClick={() => setSkipping(null)}>
                {skipLines.keep}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div role="group" aria-label={q.words} style={{ display: 'flex', gap: '0.5rem' }}>
              {STAGE_CHECKLIST_PICKS.map((p) => (
                <button key={p} type="button" aria-pressed={a?.pick === p} disabled={busy === q.id} style={a?.pick === p ? { ...chip, ...chipOn[p] } : chip} onClick={() => void pick(q, p)}>
                  {PICK_WORDS[p]}
                </button>
              ))}
            </div>
            {a?.pick ? <p style={meta}>{answerStampWords(a)}</p> : null}
            {q.asksPhoto && a?.pick && a.pick !== 'not_here' ? <PhotoRow stage={stage} question={q} answer={a} jobId={jobId} who={who} io={io} onAnswer={land} /> : null}
            {noteOpen === q.id || (a?.note ?? '') ? (
              <input
                type="text"
                aria-label={`Note on: ${q.words}`}
                placeholder="What is there to say?"
                value={notes[q.id] ?? a?.note ?? ''}
                maxLength={500}
                onChange={(e) => setNotes((n) => ({ ...n, [q.id]: e.target.value }))}
                onBlur={() => void note(q)}
                style={noteStyle}
              />
            ) : (
              <button type="button" style={{ ...link, justifySelf: 'start' }} onClick={() => setNoteOpen(q.id)}>
                Add a note
              </button>
            )}
            {/* The presses say what a row with no pick waits on; a row that owes its photo says so. */}
            {waitsOn === 'photo' ? <p style={waits}>{waitsOnWords(waitsOn)}</p> : null}
            {reopened === q.id ? (
              <button
                type="button"
                style={{ ...quiet, justifySelf: 'start' }}
                onClick={() => {
                  saveOpenNote()
                  setReopened(null)
                }}
              >
                Close this one
              </button>
            ) : null}
          </>
        )}
      </div>
    )
  }

  const companyProgress = checklistProgress(groups.company, byQuestion)
  const jobProgress = checklistProgress(groups.job, byQuestion)
  const words = addCheckWords(stage.name)

  const body = (
      <div data-stage-checklist-sheet={stage.fixtureId}>
        <p style={{ ...meta, margin: '0 0 0.25rem' }} data-checklist-progress>
          {progressWords(progress)}
        </p>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }} aria-hidden>
          <i style={{ display: 'block', height: 6, width: `${progress.asked ? Math.round((progress.answered / progress.asked) * 100) : 0}%`, background: '#16a34a' }} />
        </div>
        {template.length === 0 && skipped.length === 0 && !canAuthor ? (
          <p style={{ ...S.muted, marginTop: '0.75rem' }}>{noQuestionsWords(stage.name)}</p>
        ) : (
          <>
            {frame === 'sheet' ? <p style={{ ...meta, margin: '0.5rem 0 0' }}>Each press saves by itself.</p> : null}
            <div style={groupHead}>
              <span>{GROUP_WORDS.company}</span>
              <span>{groupCountWords(companyProgress)}</span>
            </div>
            {groups.company.length === 0 && skipped.length === 0 ? <p style={meta}>{noQuestionsWords(stage.name)}</p> : groups.company.map((q, i) => row(q, i + 1))}
            {skipped.length > 0 ? (
              <div data-checklist-skipped>
                <div style={groupHead}>
                  <span>{skipLines.heading}</span>
                  <span>{skipped.length}</span>
                </div>
                {skipped.map(({ question, skip: skipRow }) => (
                  <div key={question.id} style={skippedRow}>
                    <span aria-hidden>—</span>
                    <span style={{ minWidth: 0 }}>
                      <s style={{ display: 'block' }}>{question.words}</s>
                      <span style={{ ...meta, display: 'block' }}>{skippedLineWords(skipRow)}</span>
                    </span>
                    {canAuthor ? (
                      <button type="button" style={{ ...quiet, minHeight: 44 }} disabled={busy === question.id} onClick={() => void putBack(question, skipRow.id)} aria-label={`${skipLines.putBack}: ${question.words}`}>
                        {skipLines.putBack}
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            <div style={groupHead}>
              <span>{GROUP_WORDS.job}</span>
              <span>{groupCountWords(jobProgress)}</span>
            </div>
            {groups.job.length === 0 ? <p style={meta}>{noJobItemsWords(stage.name, canAuthor)}</p> : groups.job.map((q, i) => row(q, groups.company.length + i + 1))}
            {canAuthor && kind ? (
              adding ? (
                <AddCheckBox
                  stageName={stage.name}
                  onDone={() => setAdding(false)}
                  onAdd={async (draft) => {
                    const q = await io.addItem({ jobId, fixtureId: stage.fixtureId, kind, order: nextItemOrder(questions, stage.fixtureId), ...draft }, who)
                    onQuestionAdded?.(q)
                    const after = stageChecklistState({ stageName: stage.name, fixtureId: stage.fixtureId, questions: [...questions, q], answers })
                    showToast(addedWords(stage.name, after), 'success')
                  }}
                />
              ) : (
                <button type="button" style={{ ...S.secondaryBtn, marginTop: '0.6rem' }} onClick={() => setAdding(true)}>
                  {words.press}
                </button>
              )
            ) : null}
          </>
        )}
      </div>
  )
  if (frame === 'inline') {
    return (
      <div data-stage-checklist-inline={stage.fixtureId}>
        {body}
        {state.asked > 0 ? ruleLine : null}
      </div>
    )
  }
  return (
    <ResponsiveModalShell title={`${stage.name} checklist`} onRequestClose={onClose} footer={foot} maxWidthDesktop={520}>
      {body}
    </ResponsiveModalShell>
  )
}

/**
 * The add box (#237): the words, the plan sheet and the why beside them, *Asks for a photo*, the hint, Add the check and
 * Done adding. It stays open after an add with its boxes empty and the cursor back in the words, so a list goes in without
 * reopening it (PR 1b). Shared with the Documents read-out.
 */
export function AddCheckBox({ stageName, onAdd, onDone }: { stageName: string; onAdd: (draft: AddCheckDraft) => Promise<void>; onDone: () => void }) {
  const { showToast } = useToastContext()
  const [text, setText] = useState('')
  const [sheet, setSheet] = useState('')
  const [why, setWhy] = useState('')
  const [asksPhoto, setAsksPhoto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [added, setAdded] = useState(0)
  const first = useRef<HTMLInputElement>(null)
  const words = addCheckWords(stageName)
  const submit = async () => {
    if (busy) return
    const p = jobItemProblem(text)
    if (p) {
      setProblem(p)
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      await onAdd({ words: text, asksPhoto, sheet, why })
      setText('')
      setSheet('')
      setWhy('')
      setAsksPhoto(false)
      setAdded((n) => n + 1)
      first.current?.focus()
    } catch (e) {
      showToast(`The check was not added. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }
  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    void submit()
  }
  return (
    <div style={addBox} data-checklist-add>
      <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{words.title}</p>
      <input ref={first} type="text" aria-label={words.title} placeholder={words.placeholder} value={text} maxLength={200} autoFocus onChange={(e) => setText(e.target.value)} onKeyDown={onEnter} style={noteStyle} />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input type="text" aria-label={words.sheet} placeholder={words.sheetPlaceholder} value={sheet} maxLength={PLAN_SHEET_MAX_CHARS} onChange={(e) => setSheet(e.target.value)} onKeyDown={onEnter} style={{ ...noteStyle, flex: '1 1 10rem', width: 'auto', minWidth: 0 }} />
        <input type="text" aria-label={words.why} placeholder={words.whyPlaceholder} value={why} maxLength={ITEM_WHY_MAX_CHARS} onChange={(e) => setWhy(e.target.value)} onKeyDown={onEnter} style={{ ...noteStyle, flex: '1 1 10rem', width: 'auto', minWidth: 0 }} />
      </div>
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9375rem', color: 'var(--text-strong)', minHeight: 44 }}>
        <input type="checkbox" checked={asksPhoto} onChange={(e) => setAsksPhoto(e.target.checked)} /> {words.photo}
      </label>
      <p style={meta}>{words.hint}</p>
      {problem ? <p style={waits}>{problem}</p> : null}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
        {added > 0 ? (
          <span style={{ ...meta, marginRight: 'auto' }} data-checklist-add-tally>
            {addedSoFarWords(added)}
          </span>
        ) : null}
        <button type="button" style={S.secondaryBtn} onClick={onDone} disabled={busy}>
          {words.done}
        </button>
        <button type="button" style={busy ? { ...S.hereBtn, ...S.disabled } : S.hereBtn} onClick={() => void submit()} disabled={busy}>
          {busy ? 'Adding…' : words.confirm}
        </button>
      </div>
    </div>
  )
}

/** A thumbnail on a statement row for a photo still on its way; Drive's copy has no thumbnail here, so a camera mark stands for it. */
function PhotoThumb({ answer, jobId, io }: { answer: JobAnswer; jobId: string; io: StageChecklistSheetIo }) {
  const [url, setUrl] = useState<string | null>(null)
  const photo = answer.photo
  useEffect(() => {
    let live = true
    setUrl(null)
    if (!photo || photo.state === 'filed') return
    io.photoUrl({ storagePath: answer.storagePath, reportPhotoId: answer.reportPhotoId, jobId }).then((u) => live && setUrl(u), () => live && setUrl(null))
    return () => {
      live = false
    }
  }, [io, photo, answer.storagePath, answer.reportPhotoId, jobId])
  if (!photo) return null
  return url ? (
    <img src={url} alt={photo.fileName} width={40} height={40} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
  ) : (
    <span title={photo.state === 'filed' ? 'In the customer’s Drive folder' : photo.fileName} style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center' }} aria-label="photo">
      <CameraGlyph />
    </span>
  )
}

/** The photo a question asks for: the press, the shot as it waits, and the words once Drive has it. */
function PhotoRow({ stage, question, answer, jobId, who, io, onAnswer }: { stage: JobStageRef; question: StageChecklistQuestion; answer: JobAnswer | null; jobId: string; who: AnswerWho; io: StageChecklistSheetIo; onAnswer: (a: JobAnswer) => void }) {
  const { showToast } = useToastContext()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const photo = answer?.photo ?? null
  const storagePath = answer?.storagePath ?? null
  // A photo taken on a field report (punch list #189, PR 6) waits in the report's bucket, not the checklist's.
  const reportPhotoId = answer?.reportPhotoId ?? null
  useEffect(() => {
    let live = true
    setUrl(null)
    if (!photo || photo.state === 'filed') return
    io.photoUrl({ storagePath, reportPhotoId, jobId }).then((u) => live && setUrl(u), () => live && setUrl(null))
    return () => {
      live = false
    }
  }, [io, photo, storagePath, reportPhotoId, jobId])

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy('Shrinking…')
    try {
      // The photo's time is the file's own when the camera wrote one (punch list #247, PR 3), else now.
      const takenAt = await readTakenAt(f)
      const shot = await shrinkPhoto(f)
      const fileName = checklistPhotoName({ takenAt, stageName: stage.name, question: question.words })
      setBusy('Sending…')
      const saved = await io.photo({ jobId, fixtureId: stage.fixtureId, questionId: question.id, blob: shot.blob, fileName, takenAt }, who)
      onAnswer(saved)
      showToast(`Photo on its way to the customer's Drive folder, ${bytesWords(shot.blob.size)}.`, 'success')
    } catch (err) {
      showToast(`The photo was not taken. ${formatErrorMessage(err)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  const standing = !photo ? null : photo.state === 'filed' ? 'In the customer’s Drive folder.' : photo.state === 'failed' ? photo.failWhy || 'Not filed yet.' : 'On its way to the customer’s Drive folder.'
  const words = standing && reportPhotoId ? `${CHECKLIST_PHOTO_WORDS.onReport} ${standing}` : standing
  return (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }} data-checklist-photo>
      {url ? <img src={url} alt={photo?.fileName ?? 'The photo'} width={56} height={56} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} /> : null}
      <button type="button" style={photoBtn} disabled={busy != null} aria-label={`${photo ? 'Take the photo again' : 'Take the photo'}: ${question.words}`} onClick={() => input.current?.click()}>
        <CameraGlyph />
        {busy ?? (photo ? 'Take it again' : 'Take the photo')}
      </button>
      {words ? (
        <span style={{ fontSize: '0.8125rem', color: photo?.state === 'failed' ? 'var(--text-amber-700)' : 'var(--text-muted)', fontWeight: photo?.state === 'failed' ? 600 : 500 }}>{words}</span>
      ) : null}
      <input ref={input} type="file" accept="image/*" capture="environment" onChange={onFile} tabIndex={-1} aria-hidden style={{ display: 'none' }} />
    </div>
  )
}

export default StageChecklistSheet
