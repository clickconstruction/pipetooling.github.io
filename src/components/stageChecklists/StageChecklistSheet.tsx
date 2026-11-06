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
 * names a plan sheet wears a chip that opens the job's Plans folder. A check the crew cannot answer goes to Dispatch
 * from the open row (punch list #245, PR 1): the quiet press **Send to Dispatch** opens `StageCheckDispatchSheet` on
 * top, and the row wears *With Dispatch · 12 min · need a part* while the request is open; the inbox opens this sheet
 * with that row open through `initialOpenQuestionId`. Dispatch's newest reply sits under the chip (PR 2b), and a pick,
 * a skip or a take off on that row reads the request again, since it closes itself, and pushes the sender the closing
 * note when someone else settled it. Every press writes at once, so a sheet closed
 * early keeps what was answered. The photo is shrunk on the phone, named for the stage and
 * the question (`checklistPhotoName`), put in the bucket and filed in the customer's Drive folder by the photo-save
 * sweep. The foot carries the rule: the stage reads not ready on the Pipeline until every question is answered. The
 * rules are `lib/jobs/stageChecklist.ts` and `stageChecklistItems.ts`.
 *
 * A check the author marked *needs a signature* (#237 PR 2): its open row wears the *signature* chip, and Yes, No or
 * Not here opens `ChecklistSignatureSheet` on top instead of saving, which says what is being claimed and who will read
 * it, takes the mark and the agreed line, and writes the pick and the signature in one press through the outbox
 * (`checklist-sign`), so a signature on one bar of signal still lands. A signed row is locked: its open view shows the
 * pick, the mark and *Signed by … · Nov 1 · 9:14 am*, with **Take it back** as its one door, which asks why and voids the
 * row; the voided row stays as a *Taken back* line under the question with its mark, and the question waits on its pick
 * again. The words are `stageChecklistSignature.ts`.
 *
 * Once filed (#237 PR 3: the database files the record by itself at the last answer) the sheet reads as paper
 * (`FiledPaper`): the header *Record CL-1042-1 · v1 · Oct 15 · 4:02 pm · 4 answers, 1 signed · PDF in the job's Drive
 * folder*, every row a statement from the record's snapshot with the mark where it was signed, nothing to press, and the
 * foot *Filed. Nothing here changes. The office can amend it as a new version.* with Close. A stage the office amended
 * reads open again with *Amending v1* under the progress. The words are `stageChecklistRecord.ts`.
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
  isVoidedAnswer,
  liveAnswersById,
  noQuestionsWords,
  progressWords,
  questionWaitsOn,
  savedWords,
  sheetFootWords,
  signatureStands,
  skippedFor,
  stageChecklistKindOf,
  stageChecklistState,
  templateFor,
  templateGroups,
  voidedAnswersOf,
  waitsOnWords,
  type ChecklistSignature,
  type JobStageRef,
  type StageChecklistPick,
  type StageChecklistQuestion,
} from '../../lib/jobs/stageChecklist'
import { NEEDS_SIGNATURE_WORDS, SIGN_WORDS, TAKE_BACK_WORDS, VOID_WHY_MAX_CHARS, canTakeBack, signedRowWords, signedStampWords, signedToastWords, takeBackProblem, takenBackToastWords, voidedLineWords, type SignInput } from '../../lib/jobs/stageChecklistSignature'
import { FILED_PAPER_WORDS, amendingRecordOf, filedFootWords, filedHeaderWords, filedJustNowWords, filedRecordOf, filedTitleWords, paperRowFromRecordRow, recordPdfUrl, skippedLineWords as recordSkippedLineWords, type ChecklistRecord } from '../../lib/jobs/stageChecklistRecord'
import { landChecklistSign } from '../../lib/offline/landFieldPress'
import { pressThroughOutbox } from '../../lib/offline/pressThroughOutbox'
import { jobWindowPath } from '../../lib/photos/uploadedPhotos'
import { ChecklistSignatureSheet, SignatureMark } from './ChecklistSignatureSheet'
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
import { STAGE_CHECK_WORDS, dispatchReplyWords, openStageCheckFor, withDispatchWords, type OpenStageCheck } from '../../lib/jobs/stageCheckDispatch'
import { StageCheckDispatchSheet } from './StageCheckDispatchSheet'
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
  /** The job as the signature sheet's gravity words name it (#237 PR 2): its number, or *this job*. */
  jobLabel?: string
  /** The job's filed records, every version (#237 PR 3); the sheet reads as paper while this stage's latest is filed. */
  records?: readonly ChecklistRecord[]
  io: StageChecklistSheetIo
  /** Each saved answer, for the strip's count. */
  onAnswer: (answer: JobAnswer) => void
  /** A check added for this stage (#237), so every reader counts it at once. */
  onQuestionAdded?: (question: StageChecklistQuestion) => void
  /** A check taken off. */
  onQuestionRetired?: (questionId: string) => void
  /** Questions that changed in place: a skip, a put back or a new order (PR 1b). */
  onQuestionsChanged?: (questions: readonly StageChecklistQuestion[]) => void
  /** The row to open first, when the sheet is opened on a check from the Dispatch inbox (#245); the next unanswered row otherwise. */
  initialOpenQuestionId?: string | null
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
  /** Whoever answers signs (#237 PR 2). */
  needsSignature: boolean
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
const withDispatchTag: CSSProperties = { display: 'inline-block', padding: '0.05rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', whiteSpace: 'nowrap' }
// Dispatch's reply under the crew's row (#245 PR 2b), until the row is answered.
const dispatchReply: CSSProperties = { display: 'block', marginTop: '0.2rem', fontSize: '0.8125rem', color: 'var(--text-700)', fontStyle: 'italic' }
const skippedRow: CSSProperties = { display: 'grid', gridTemplateColumns: '1.4rem minmax(0, 1fr) auto', gap: '0.15rem 0.5rem', alignItems: 'start', padding: '0.55rem 0', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }
// A signed row's lock (#237 PR 2): the pick as a statement, the mark, the stamp, and Take it back as the one door.
const lockedPick: CSSProperties = { display: 'inline-block', padding: '0.3rem 0.7rem', borderRadius: 10, border: '1.5px solid var(--border-strong)', fontWeight: 700 }
const voidedLine: CSSProperties = { ...meta, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', paddingLeft: '1.9rem', marginTop: '0.1rem' }

export function StageChecklistSheet({ jobId, stage, questions, answers: given, who, role = null, canAuthor = false, plansUrl = null, jobLabel = 'this job', records = [], io, onAnswer, onQuestionAdded, onQuestionRetired, onQuestionsChanged, initialOpenQuestionId = null, onClose, frame = 'sheet' }: StageChecklistSheetProps) {
  const { showToast } = useToastContext()
  const kind = stageChecklistKindOf(stage.name)
  const template = useMemo(() => (kind ? templateFor(questions, kind, stage.fixtureId) : []), [questions, kind, stage.fixtureId])
  const groups = useMemo(() => templateGroups(template), [template])
  const skipped = useMemo(() => (kind ? skippedFor(questions, kind, stage.fixtureId) : []), [questions, kind, stage.fixtureId])
  const [answers, setAnswers] = useState<JobAnswer[]>(() => [...given])
  // The record (#237 PR 3): filed, the sheet is paper; amended, it is open again and says so. A record that appears
  // while the sheet is open was filed by the press just made, and the paper says so on its first line.
  const filed = useMemo(() => filedRecordOf(records, stage.fixtureId), [records, stage.fixtureId])
  const amending = useMemo(() => amendingRecordOf(records, stage.fixtureId), [records, stage.fixtureId])
  const [filedAtOpen] = useState<string | null>(() => filed?.id ?? null)
  const filedJustNow = filed != null && filed.id !== filedAtOpen
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [noteOpen, setNoteOpen] = useState<string | null>(null)
  // The row the person tapped to change; null means the next unanswered question is the open row.
  const [reopened, setReopened] = useState<string | null>(initialOpenQuestionId)
  // Send to Dispatch (#245): the open requests on this job's checks, read once, and the row being sent.
  const [withDispatch, setWithDispatch] = useState<OpenStageCheck[]>([])
  const [sending, setSending] = useState<StageChecklistQuestion | null>(null)
  const dispatchIo = io.dispatch ?? null
  useEffect(() => {
    let live = true
    if (!dispatchIo) return
    dispatchIo.open(jobId).then(
      (rows) => live && setWithDispatch(rows),
      () => live && setWithDispatch([]),
    )
    return () => {
      live = false
    }
  }, [dispatchIo, jobId])
  const [takingOff, setTakingOff] = useState<string | null>(null)
  const [skipping, setSkipping] = useState<string | null>(null)
  const [skipWhy, setSkipWhy] = useState('')
  const [skipBlocked, setSkipBlocked] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  // Needs a signature (#237 PR 2): the check being signed with the pick pressed, and the signed row being taken back.
  const [signing, setSigning] = useState<{ question: StageChecklistQuestion; pick: StageChecklistPick; note: string } | null>(null)
  const [takingBack, setTakingBack] = useState<string | null>(null)
  const [takeBackWhy, setTakeBackWhy] = useState('')
  const [takeBackBlocked, setTakeBackBlocked] = useState<string | null>(null)
  // The live answer of each question; a row taken back stays in `answers` for its line under the question.
  const byQuestion = useMemo(() => liveAnswersById(answers), [answers])
  const state = useMemo(() => stageChecklistState({ stageName: stage.name, fixtureId: stage.fixtureId, questions, answers }), [stage.name, stage.fixtureId, questions, answers])
  const progress = useMemo(() => checklistProgress(template, byQuestion), [template, byQuestion])
  const openId = reopened && template.some((q) => q.id === reopened) ? reopened : (progress.next?.id ?? null)

  const land = (a: JobAnswer) => {
    // The row by its id, or the question's live row, gives way; the question's voided rows stay as its record.
    setAnswers((prev) => [...prev.filter((x) => x.id !== a.id && !(x.questionId === a.questionId && !isVoidedAnswer(x) && !isVoidedAnswer(a))), a])
    onAnswer(a)
  }
  const key = (q: StageChecklistQuestion) => ({ jobId, fixtureId: stage.fixtureId, questionId: q.id })
  // A settle on a check that is with Dispatch (#245 PR 2b): the request closes itself (migration 20261104170000), so
  // the chip is read again, and when the row's request is gone the sender hears the closing note, unless they settled
  // it themselves. Best-effort: a read that fails leaves the chip as it was.
  const settleWithDispatch = async (q: StageChecklistQuestion) => {
    if (!dispatchIo) return
    const sent = openStageCheckFor(withDispatch, stage.fixtureId, q.id)
    if (!sent) return
    let after: OpenStageCheck[]
    try {
      after = await dispatchIo.open(jobId)
    } catch {
      return
    }
    setWithDispatch(after)
    if (!after.some((r) => r.id === sent.id)) void dispatchIo.settled?.(sent, who)
  }

  const pick = async (q: StageChecklistQuestion, p: StageChecklistPick) => {
    // A check that needs a signature saves nothing on the press: the signature sheet writes the pick with the mark.
    if (q.needsSignature) {
      setSigning({ question: q, pick: p, note: (notes[q.id] ?? byQuestion.get(q.id)?.note ?? '').trim() })
      return
    }
    setBusy(q.id)
    try {
      land(await io.pick(key(q), p, who))
      // The row is about to close, and a closed box never fires its blur: a note typed and not yet left saves now.
      await note(q)
      // The list moves on by itself once the row is answered; a row still owing its photo stays open as Next.
      setReopened(null)
      void settleWithDispatch(q)
    } catch (e) {
      showToast(`The answer was not saved. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  /**
   * Sign and save (#237 PR 2): the pick and the signature in one press through the outbox. Online it lands at once
   * through the sheet's io; with no signal it waits on the phone with the press's time as its signed time, and the
   * reader hears of the landing. A refusal comes back to the sheet with its reason.
   */
  const sign = async (q: StageChecklistQuestion, input: SignInput) => {
    if (!who.userId) throw new Error('Sign in again to sign the answer.')
    const outcome = await pressThroughOutbox(
      {
        kind: 'checklist-sign',
        userId: who.userId,
        pressedAt: Date.now(),
        payload: { jobId, fixtureId: stage.fixtureId, questionId: q.id, questionWords: q.words, stageName: stage.name, pick: input.pick, note: input.note.trim(), printedName: input.printedName.trim(), mode: input.mode, pngDataUrl: input.mode === 'draw' ? input.drawnPng : null, byName: who.name },
        about: `${stage.name} · ${q.words}`,
        door: jobWindowPath(jobId),
      },
      { land: (press) => landChecklistSign(press, { sign: (i, w) => io.sign(i, w) }) },
    )
    if (outcome.kind === 'refused') throw new Error(outcome.message)
    if (outcome.kind === 'failed') throw new Error(formatErrorMessage(outcome.error, 'The answer was not signed.'))
    setSigning(null)
    setNotes((n) => ({ ...n, [q.id]: input.note.trim() }))
    setReopened(null)
    if (outcome.kind === 'queued') {
      showToast(SIGN_WORDS.queued, 'success')
      return
    }
    const saved = outcome.result as JobAnswer
    land(saved)
    void settleWithDispatch(q)
    const after = stageChecklistState({ stageName: stage.name, fixtureId: stage.fixtureId, questions, answers: [...answers.filter((x) => x.id !== saved.id), saved] })
    showToast(signedToastWords(stage.name, after), 'success')
  }
  /** Take it back (#237 PR 2): the signed row is voided with its reason and stays; the question waits on its pick again. */
  const takeBack = async (q: StageChecklistQuestion, a: JobAnswer) => {
    const blocked = takeBackProblem(takeBackWhy)
    setTakeBackBlocked(blocked)
    if (blocked) return
    setBusy(q.id)
    try {
      const voided = await io.takeBack(a.id, takeBackWhy, who)
      land(voided)
      setTakingBack(null)
      setTakeBackWhy('')
      setReopened(null)
      const after = stageChecklistState({ stageName: stage.name, fixtureId: stage.fixtureId, questions, answers: answers.map((x) => (x.id === voided.id ? voided : x)) })
      showToast(takenBackToastWords(stage.name, after), 'success')
    } catch (e) {
      showToast(`The answer was not taken back. ${formatErrorMessage(e)}`, 'error')
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
      void settleWithDispatch(q)
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
      void settleWithDispatch(q)
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
    const sent = openStageCheckFor(withDispatch, stage.fixtureId, q.id)
    const sig = signatureStands(q, a)
    const voidedRows = voidedAnswersOf(answers, q.id)
    const voidedLines = voidedRows.length > 0 ? (
      <div data-checklist-voided-lines={q.id}>
        {voidedRows.map((v) => (
          <div key={v.id} style={voidedLine} data-checklist-voided={v.id}>
            {v.signature ? <SignatureMark signature={v.signature} inkUrl={io.inkUrl} /> : null}
            <span style={{ flex: '1 1 12rem' }}>
              <span style={{ fontWeight: 600 }}>{TAKE_BACK_WORDS.heading} · </span>
              {voidedLineWords(v)}
            </span>
          </div>
        ))}
      </div>
    ) : null
    if (!isOpen) {
      const stamp = answerStampWords(a)
      const second = stamp ? `${waitsOn === 'photo' ? `${stamp} · waits for the photo` : sig ? signedStampWords(stamp) : waitsOn === 'signature' ? `${stamp} · not signed yet` : stamp}` : [q.asksPhoto ? 'asks for a photo' : '', q.needsSignature ? NEEDS_SIGNATURE_WORDS.tag : '', added].filter(Boolean).join(' · ')
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
              {sig ? (
                <span style={{ display: 'block', marginTop: '0.2rem' }}>
                  <SignatureMark signature={sig} inkUrl={io.inkUrl} />
                </span>
              ) : null}
              {sent ? (
                <span style={{ display: 'block', marginTop: '0.2rem' }}>
                  <span style={withDispatchTag} data-checklist-with-dispatch={q.id}>
                    {withDispatchWords(sent, Date.now())}
                  </span>
                  {sent.reply ? (
                    <span style={dispatchReply} data-checklist-dispatch-reply={q.id}>
                      {dispatchReplyWords(sent.reply, Date.now())}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </span>
            {a?.photo ? <PhotoThumb answer={a} jobId={jobId} io={io} /> : <span />}
          </button>
          {/* The chip is the row's neighbour, never inside its button: a press on it opens the folder and not the row. */}
          {q.sheet ? (
            <div style={{ paddingLeft: '1.9rem', marginTop: '-0.35rem' }}>
              <PlanSheetChip sheet={q.sheet} plansUrl={plansUrl} />
            </div>
          ) : null}
          {voidedLines}
        </Fragment>
      )
    }
    return (
      <div key={q.id} data-checklist-question={q.id} data-checklist-row="open" style={open}>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={nextTag}>{isNext ? 'Next' : sig ? 'Signed' : 'Open'}</span>
          {q.needsSignature ? <span style={needTag}>signature</span> : null}
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
        ) : sig && a?.pick ? (
          <LockedRow stage={stage} question={q} answer={a} signature={sig} jobId={jobId} who={who} io={io} busy={busy === q.id} takingBack={takingBack === q.id} why={takeBackWhy} blocked={takeBackBlocked} onWhy={setTakeBackWhy} onAsk={() => { setTakeBackWhy(''); setTakeBackBlocked(null); setTakingBack(q.id) }} onKeep={() => setTakingBack(null)} onTakeBack={() => void takeBack(q, a)} onAnswer={land} waitsOn={waitsOn} reopened={reopened === q.id} onCloseRow={() => setReopened(null)} />
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
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {noteOpen === q.id || (a?.note ?? '') ? <span /> : (
                <button type="button" style={link} onClick={() => setNoteOpen(q.id)}>
                  Add a note
                </button>
              )}
              {/* Send to Dispatch (#245): quiet, since answering is the row's job; a check already sent wears its chip instead. */}
              {dispatchIo && who.userId ? (
                sent ? (
                  <span style={withDispatchTag} data-checklist-with-dispatch={q.id}>
                    {withDispatchWords(sent, Date.now())}
                  </span>
                ) : (
                  <button
                    type="button"
                    style={{ ...quiet, minHeight: 44 }}
                    onClick={() => {
                      saveOpenNote()
                      setSending(q)
                    }}
                    aria-label={`${STAGE_CHECK_WORDS.press}: ${q.words}`}
                  >
                    {STAGE_CHECK_WORDS.press}
                  </button>
                )
              ) : null}
            </div>
            {sent?.reply ? (
              <p style={{ ...dispatchReply, margin: 0 }} data-checklist-dispatch-reply={q.id}>
                {dispatchReplyWords(sent.reply, Date.now())}
              </p>
            ) : null}
            {/* The presses say what a row with no pick waits on; a row that owes its photo or its signature says so. */}
            {waitsOn === 'photo' || waitsOn === 'signature' ? <p style={waits}>{waitsOnWords(waitsOn)}</p> : null}
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
        {voidedLines}
      </div>
    )
  }

  const companyProgress = checklistProgress(groups.company, byQuestion)
  const jobProgress = checklistProgress(groups.job, byQuestion)
  const words = addCheckWords(stage.name)

  const body = filed ? (
    <FiledPaper record={filed} stageName={stage.name} justNow={filedJustNow} io={io} />
  ) : (
      <div data-stage-checklist-sheet={stage.fixtureId}>
        <p style={{ ...meta, margin: '0 0 0.25rem' }} data-checklist-progress>
          {progressWords(progress)}
        </p>
        {amending ? (
          <p style={{ ...meta, margin: '0.25rem 0 0', color: 'var(--text-amber-700)', fontWeight: 600 }} data-checklist-amending={amending.version}>
            {FILED_PAPER_WORDS.amending(amending.version)}
          </p>
        ) : null}
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
  // The send sheet (#245) sits over either frame: the strip's own window and the Pipeline door's inline rows.
  const dispatchSheet = sending && dispatchIo ? (
    <StageCheckDispatchSheet
      jobId={jobId}
      stage={stage}
      progressWords={progressWords(progress)}
      question={sending}
      answer={byQuestion.get(sending.id) ?? null}
      who={who}
      io={dispatchIo}
      onSent={(request) => setWithDispatch((prev) => [...prev.filter((r) => r.id !== request.id), request])}
      onClose={() => setSending(null)}
    />
  ) : null
  // The signature sheet (#237 PR 2) sits over either frame too.
  const signatureSheet = signing ? (
    <ChecklistSignatureSheet stage={stage} jobLabel={jobLabel} question={signing.question} pick={signing.pick} note={signing.note} who={who} onSign={(input) => sign(signing.question, input)} onClose={() => setSigning(null)} />
  ) : null
  // The filed paper's foot: the rule and Close; nothing to press on the paper itself.
  const filedFoot = (
    <div style={{ width: '100%' }}>
      <p style={{ ...meta, margin: '0 0 0.5rem' }} data-checklist-filed-foot>
        {FILED_PAPER_WORDS.foot}
      </p>
      <div style={S.footerRow}>
        <button type="button" style={S.secondaryBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
  if (frame === 'inline') {
    return (
      <div data-stage-checklist-inline={stage.fixtureId}>
        {body}
        {filed ? <p style={{ ...meta, margin: '0.5rem 0 0' }}>{FILED_PAPER_WORDS.foot}</p> : state.asked > 0 ? ruleLine : null}
        {dispatchSheet}
        {signatureSheet}
      </div>
    )
  }
  return (
    <ResponsiveModalShell title={filed ? filedTitleWords(stage.name) : `${stage.name} checklist`} onRequestClose={onClose} footer={filed ? filedFoot : foot} maxWidthDesktop={520}>
      {body}
      {dispatchSheet}
      {signatureSheet}
    </ResponsiveModalShell>
  )
}

/**
 * The filed sheet as paper (#237 PR 3): light paper whatever the theme, the header with the record id, every row a
 * statement from the snapshot with the mark where it was signed, the company questions left off this job, and the foot
 * that says what filing did. Nothing to press.
 */
function FiledPaper({ record, stageName, justNow, io }: { record: ChecklistRecord; stageName: string; justNow: boolean; io: StageChecklistSheetIo }) {
  const pdfUrl = recordPdfUrl(record)
  const skipped = recordSkippedLineWords(record.skipped)
  return (
    <div data-theme="light" data-checklist-paper={record.recordId} style={{ background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.9rem 1rem', display: 'grid', gap: '0.4rem', fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {justNow ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-green-800)', fontWeight: 600 }} data-checklist-filed-now>
          {filedJustNowWords(record)}
        </p>
      ) : null}
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-checklist-filed-header>
        {filedHeaderWords(record)}
        {pdfUrl ? (
          <>
            {' · '}
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)' }}>
              Open in Drive ↗
            </a>
          </>
        ) : null}
      </p>
      {record.rows.map((r, i) => {
        const row = paperRowFromRecordRow(r)
        return (
          <div key={r.questionId || i} style={{ display: 'grid', gridTemplateColumns: '1.4rem minmax(0, 1fr)', gap: '0.15rem 0.5rem', padding: '0.45rem 0', borderTop: '1px solid var(--border)' }} data-checklist-paper-row={r.pick}>
            <span style={{ fontWeight: 700, color: row.isNo ? 'var(--text-red-700)' : 'var(--text-strong)' }} aria-hidden>
              {row.glyph}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.95rem' }}>
                {i + 1}. {row.words}
                {row.sheet ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}> · {row.sheet}</span> : null}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{row.answer}</span>
                {r.signature ? <SignatureMark signature={{ mode: r.signature.mode, printedName: r.signature.printedName, storagePath: r.signature.storagePath, signedAt: r.signature.signedAt, signedById: null, hash: '' }} inkUrl={io.inkUrl} /> : null}
                {row.photo ? <span>· {row.photo}</span> : null}
                {row.note ? <span style={{ color: row.isNo ? 'var(--text-red-700)' : 'var(--text-muted)', fontStyle: 'italic' }}>· “{row.note}”</span> : null}
              </div>
            </div>
          </div>
        )
      })}
      {skipped ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>{skipped}</p> : null}
      <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: record.noCount > 0 ? 'var(--text-red-700)' : 'var(--text-green-800)', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }} data-checklist-filed-words>
        {filedFootWords(stageName, record.noCount)}
      </p>
    </div>
  )
}

/**
 * A signed row's open view (#237 PR 2): the pick as a statement, the mark, *Signed by … · Nov 1 · 9:14 am*, the note,
 * the photo it still owes, and **Take it back** as its one door, which asks why before it voids the row.
 */
function LockedRow({ stage, question, answer, signature, jobId, who, io, busy, takingBack, why, blocked, onWhy, onAsk, onKeep, onTakeBack, onAnswer, waitsOn, reopened, onCloseRow }: { stage: JobStageRef; question: StageChecklistQuestion; answer: JobAnswer; signature: ChecklistSignature; jobId: string; who: AnswerWho; io: StageChecklistSheetIo; busy: boolean; takingBack: boolean; why: string; blocked: string | null; onWhy: (why: string) => void; onAsk: () => void; onKeep: () => void; onTakeBack: () => void; onAnswer: (a: JobAnswer) => void; waitsOn: ReturnType<typeof questionWaitsOn>; reopened: boolean; onCloseRow: () => void }) {
  const pick = answer.pick!
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }} data-checklist-locked={question.id}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ ...lockedPick, ...chipOn[pick] }} data-checklist-locked-pick={pick}>
          {PICK_WORDS[pick]}
        </span>
        <SignatureMark signature={signature} inkUrl={io.inkUrl} size="large" />
      </div>
      <p style={meta} data-checklist-signed-words>
        {signedRowWords(signature)}
      </p>
      {answer.note ? <p style={{ ...meta, fontStyle: 'italic' }}>“{answer.note}”</p> : null}
      {question.asksPhoto && pick !== 'not_here' ? <PhotoRow stage={stage} question={question} answer={answer} jobId={jobId} who={who} io={io} onAnswer={onAnswer} /> : null}
      {waitsOn === 'photo' ? <p style={waits}>{waitsOnWords(waitsOn)}</p> : null}
      {takingBack ? (
        <div style={askBox} data-checklist-take-back>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>{TAKE_BACK_WORDS.hint}</span>
          <input
            type="text"
            aria-label={TAKE_BACK_WORDS.label}
            placeholder={TAKE_BACK_WORDS.placeholder}
            value={why}
            maxLength={VOID_WHY_MAX_CHARS}
            autoFocus
            onChange={(e) => onWhy(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              onTakeBack()
            }}
            style={noteStyle}
          />
          {blocked ? <p style={waits}>{blocked}</p> : null}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" style={S.secondaryBtn} disabled={busy} onClick={onTakeBack}>
              {TAKE_BACK_WORDS.confirm}
            </button>
            <button type="button" style={quiet} onClick={onKeep}>
              {TAKE_BACK_WORDS.keep}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p style={meta}>{SIGN_WORDS.lockHint}</p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {canTakeBack(answer) ? (
              <button type="button" style={{ ...quiet, minHeight: 44 }} disabled={busy} onClick={onAsk} aria-label={`${TAKE_BACK_WORDS.press}: ${question.words}`}>
                {TAKE_BACK_WORDS.press}
              </button>
            ) : null}
            {reopened ? (
              <button type="button" style={{ ...quiet, minHeight: 44 }} onClick={onCloseRow}>
                Close this one
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
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
  const [needsSignature, setNeedsSignature] = useState(false)
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
      await onAdd({ words: text, asksPhoto, needsSignature, sheet, why })
      setText('')
      setSheet('')
      setWhy('')
      setAsksPhoto(false)
      setNeedsSignature(false)
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
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9375rem', color: 'var(--text-strong)', minHeight: 44 }}>
        <input type="checkbox" checked={needsSignature} onChange={(e) => setNeedsSignature(e.target.checked)} data-checklist-add-signature /> {words.signature}
      </label>
      {needsSignature ? <p style={{ ...meta, marginTop: '-0.35rem' }}>{words.signatureHint}</p> : null}
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
