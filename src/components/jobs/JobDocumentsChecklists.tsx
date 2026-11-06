/**
 * Stage checklists on the job window's Documents tab (punch list #237, PR 1): the office's one read-out. Each of
 * the job's stages that takes a checklist (Rough In, Top Out, Trim Set) reads with its standing, *Ready · 4 of 4* or
 * *Not ready · 3 of 6*, and every question with its pick, who answered and when, the note, where the photo is, and
 * *open* for what is unanswered. The rows sit in the named groups the sheet draws (PR 1b): *The company's questions*,
 * *Skipped on this job* with who, why and Put it back, and *Added for this job*, each check naming who added it, when
 * and why, with its plan-sheet chip. The office adds a check inline with *+ Add a check for Trim Set* (the sheet's add
 * box, which stays open for the next one), takes one off with two presses, its answer kept, moves the job's own checks
 * with ▲ and ▼, skips a company question on this job with a reason, and adds a job's check to the company's list with
 * two presses. A ready stage folds to one line on a phone; a press on a stage's name opens or folds it. The office
 * answers on the sheet under the window's address, as the crew does; this section reads. A check that needs a signature
 * (PR 2) wears *needs a signature* while open and *signed* with the mark once signed, and an answer taken back reads as
 * a *Taken back* line under its row with the voided mark kept. Once filed (PR 3: the database files the record by
 * itself at the last answer) the stage's chip reads *Filed · CL-1042-1*, the line under it the record's version, time,
 * counts and the PDF's standing with *Open in Drive*, every version on a line of its own, and **Amend** (two presses,
 * with a reason) opens the stage again as the next version; a stage open after a filing reads *Amending v1 · 3 of 6*.
 * **Print the checklists** beside the heading draws the three stages on light paper and keeps a copy under Sent from this
 * job (`printAndFile`), since it is the paper an inspector or the GC reads. The rules are
 * `lib/jobs/stageChecklist.ts` and `stageChecklistItems.ts`; the read is `useJobStageChecklists`, the one the strip
 * uses, whose readers on a job move together: a check added here counts on the strip at once, and an answer on the
 * strip's sheet lands here.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useJobStageChecklists } from '../../hooks/useJobStageChecklists'
import { useToastContext } from '../../contexts/ToastContext'
import { addSkip, dropSkip, groupCountWords, checklistProgress, liveAnswersById, noQuestionsWords, signatureStands, skippedFor, stageChecklistState, templateFor, templateGroups, voidedAnswersOf, type JobStageChecklist, type StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import {
  GROUP_WORDS,
  MOVE_WORDS,
  READOUT_FOOT,
  SKIP_WHY_MAX_CHARS,
  TAKE_OFF_WORDS,
  addCheckWords,
  addedWords,
  asksMayAuthor,
  canAuthorOnJob,
  canPromoteJobItem,
  canSkipQuestion,
  canTakeOffJobItem,
  checklistsSummary,
  itemMetaWords,
  movedOrder,
  nextItemOrder,
  noJobItemsWords,
  promoteWords,
  putBackToastWords,
  rowAsksPhotoTag,
  rowGlyph,
  rowMetaWords,
  rowPickWords,
  rowSignatureTag,
  skipProblem,
  skipWords,
  skippedLineWords,
  skippedToastWords,
  stageStandingChip,
  takenOffWords,
  withOrder,
  type StandingTone,
} from '../../lib/jobs/stageChecklistItems'
import type { JobWindowTabKey } from '../../lib/jobs/jobHistoryTab'
import type { StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { dispatchReplyWords, openStageCheckFor, withDispatchWords, type OpenStageCheck } from '../../lib/jobs/stageCheckDispatch'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { TAKE_BACK_WORDS, voidedLineWords } from '../../lib/jobs/stageChecklistSignature'
import { AMEND_WHY_MAX_CHARS, AMEND_WORDS, PRINT_WORDS, amendProblem, amendedToastWords, amendingChipWords, amendingRecordOf, buildChecklistPaperHtml, filedChipWords, filedFootWords, filedRecordOf, paperJobLabel, paperRowFromLive, paperRowFromRecordRow, recordLineWords, recordPdfUrl, recordsOfStage, skippedLineWords as recordSkippedLineWords, versionsLineWords, type ChecklistRecord, type PaperStage } from '../../lib/jobs/stageChecklistRecord'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import { SignatureMark } from '../stageChecklists/ChecklistSignatureSheet'
import { PlanSheetChip } from '../stageChecklists/PlanSheetChip'
import { AddCheckBox } from '../stageChecklists/StageChecklistSheet'
import { documentsChip, documentsHeading, documentsLinkButton, documentsQuietButton } from './jobDocumentsStyles'

const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const chipTone: Record<StandingTone, CSSProperties> = {
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  muted: { background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
}
const photoTag: CSSProperties = { ...documentsChip, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
// Needs a signature (#237 PR 2): amber while the row waits on it, green once the signature stands.
const signedTag: CSSProperties = { ...documentsChip, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }
const voidedLine: CSSProperties = { ...muted, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.2rem' }
// A check with Dispatch (#245, PR 3): the sheet's chip on the read-out's row, and Dispatch's reply under it.
const withDispatchTag: CSSProperties = { ...documentsChip, marginLeft: 0, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', whiteSpace: 'nowrap' }
const dispatchReply: CSSProperties = { ...muted, marginTop: '0.15rem', color: 'var(--text-700)', fontStyle: 'italic' }
const groupHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', margin: '0.5rem 0 0.15rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1.25rem minmax(0, 1fr)', gap: '0.15rem 0.5rem', alignItems: 'start', padding: '0.4rem 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem' }
const pressLine: CSSProperties = { display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.2rem' }
const askLine: CSSProperties = { display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.25rem' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600 }
const quiet: CSSProperties = { ...link, color: 'var(--text-muted)', fontWeight: 500 }
const arrow: CSSProperties = { ...quiet, minWidth: '1.75rem', minHeight: '1.75rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }
const deadArrow: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }
const reasonBox: CSSProperties = { flex: '1 1 14rem', minWidth: 0, padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.875rem' }
const glyphTone = (pick: string | null | undefined): CSSProperties => ({ fontWeight: 700, color: pick === 'yes' ? 'var(--text-green-700)' : pick === 'no' ? 'var(--text-red-700)' : 'var(--text-muted)' })

/** The one two-press ask a row can have open: the take off, the skip with its reason, or the company's list. */
const recordLine: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }
type RowAsk = { id: string; kind: 'take-off' | 'skip' | 'promote' }

export function JobDocumentsChecklists({ job, io, onRequestTab }: { job: { id: string; job_plans_link?: string | null; hcp_number?: string | null; click_number?: string | null; job_name?: string | null; customer_name?: string | null; job_address?: string | null }; io?: StageChecklistSheetIo; onRequestTab?: (tab: JobWindowTabKey) => void }) {
  const { role, user, profileName } = useAuth()
  const { showToast } = useToastContext()
  const isMobile = useIsMobile()
  const read = useJobStageChecklists(job.id, io, 0, asksMayAuthor(role))
  const who = useMemo(() => ({ userId: user?.id ?? null, name: profileName ?? '' }), [user?.id, profileName])
  const canAdd = canAuthorOnJob(role, read.mayAuthor)
  // The stages that take a checklist, with or without questions yet, so the office can add the first check.
  const stages = useMemo(() => (read.rows ?? []).filter((r) => r.state.kind != null), [read.rows])
  const [folded, setFolded] = useState<Record<string, boolean> | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [ask, setAsk] = useState<RowAsk | null>(null)
  const [skipWhy, setSkipWhy] = useState('')
  const [skipBlocked, setSkipBlocked] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // Amend (#237 PR 3): the filed record being amended, with its reason.
  const [amendingId, setAmendingId] = useState<string | null>(null)
  const [amendWhy, setAmendWhy] = useState('')
  const [amendBlocked, setAmendBlocked] = useState<string | null>(null)
  // The checks with Dispatch on this job (#245, PR 3), read once beside the rows; a refused read draws no chip.
  const [withDispatch, setWithDispatch] = useState<OpenStageCheck[]>([])
  const dispatchIo = read.io.dispatch ?? null
  useEffect(() => {
    let live = true
    if (!dispatchIo) return
    dispatchIo.open(job.id).then(
      (rows) => live && setWithDispatch(rows),
      () => live && setWithDispatch([]),
    )
    return () => {
      live = false
    }
  }, [dispatchIo, job.id])
  // A take off or a skip closes the request by itself (v2.6494), so the chip leaves with the row's press.
  const dropWithDispatch = (questionId: string) => setWithDispatch((rows) => rows.filter((r) => r.questionId !== questionId))
  // A press target a thumb can hit on a phone; the desk keeps the row tight.
  const touch: CSSProperties = isMobile ? { minHeight: 44 } : {}

  // A ready stage folds to one line on a phone, once, when the rows first read; the desk shows every row.
  useEffect(() => {
    if (folded || !read.rows) return
    const first: Record<string, boolean> = {}
    for (const r of stages) first[r.fixtureId] = isMobile && r.state.standing === 'ready'
    // A tap on a stage's name can land before this runs (the rows paint, the tap lands, then React runs the
    // effect), so the first fold goes under what is there instead of replacing it: a tap is never undone.
    setFolded((f) => ({ ...first, ...(f ?? {}) }))
  }, [folded, read.rows, stages, isMobile])

  const failure = read.failure
  const summary = checklistsSummary(stages, read.questions)
  const stateAfter = (stage: JobStageChecklist, questions: readonly StageChecklistQuestion[]) =>
    stageChecklistState({ stageName: stage.name, fixtureId: stage.fixtureId, questions, answers: read.answersByFixture.get(stage.fixtureId) ?? [] })

  const takeOff = async (stage: JobStageChecklist, q: StageChecklistQuestion) => {
    setBusy(q.id)
    try {
      await read.io.retireItem(q.id, who)
      read.dropQuestion(q.id)
      dropWithDispatch(q.id)
      setAsk(null)
      showToast(takenOffWords(stage.name, stateAfter(stage, read.questions.filter((x) => x.id !== q.id))), 'success')
    } catch (e) {
      showToast(`The check was not taken off. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  const skip = async (stage: JobStageChecklist, q: StageChecklistQuestion) => {
    const blocked = skipProblem(skipWhy)
    setSkipBlocked(blocked)
    if (blocked) return
    setBusy(q.id)
    try {
      const made = await read.io.skip({ jobId: job.id, fixtureId: stage.fixtureId, questionId: q.id, why: skipWhy }, who)
      const next = addSkip(q, made)
      read.putQuestions([next])
      dropWithDispatch(q.id)
      setAsk(null)
      setSkipWhy('')
      showToast(skippedToastWords(stage.name, stateAfter(stage, read.questions.map((x) => (x.id === q.id ? next : x)))), 'success')
    } catch (e) {
      showToast(`The question was not skipped. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  const putBack = async (stage: JobStageChecklist, q: StageChecklistQuestion, skipId: string) => {
    setBusy(q.id)
    try {
      await read.io.putBack(skipId, who)
      const next = dropSkip(q, skipId)
      read.putQuestions([next])
      showToast(putBackToastWords(stage.name, stateAfter(stage, read.questions.map((x) => (x.id === q.id ? next : x)))), 'success')
    } catch (e) {
      showToast(`The question was not put back. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  const move = async (stage: JobStageChecklist, group: readonly StageChecklistQuestion[], q: StageChecklistQuestion, by: -1 | 1) => {
    const ids = movedOrder(group, q.id, by)
    if (!ids) return
    setBusy(stage.fixtureId)
    try {
      await read.io.reorder(stage.fixtureId, ids)
      read.putQuestions(withOrder(read.questions, ids))
    } catch (e) {
      showToast(`The check did not move. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  const amend = async (stage: JobStageChecklist, record: ChecklistRecord) => {
    const blocked = amendProblem(amendWhy)
    setAmendBlocked(blocked)
    if (blocked) return
    setBusy(record.id)
    try {
      const amended = await read.io.amend(record.id, amendWhy)
      read.putRecords([amended])
      setAmendingId(null)
      setAmendWhy('')
      showToast(amendedToastWords(stage.name, amended), 'success')
    } catch (e) {
      showToast(`The record was not amended. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  // Print the checklists (#237 PR 3): the job's stages on light paper, a filed one from its record, an open one as it stands.
  const print = () => {
    const paper: PaperStage[] = stages.map((stage) => {
      const kind = stage.state.kind!
      const filedRecord = filedRecordOf(read.records, stage.fixtureId)
      if (filedRecord) return { name: stage.name, standing: recordLineWords(filedRecord), rows: filedRecord.rows.map(paperRowFromRecordRow), skipped: recordSkippedLineWords(filedRecord.skipped), foot: filedFootWords(stage.name, filedRecord.noCount) }
      const template = templateFor(read.questions, kind, stage.fixtureId)
      const answers = liveAnswersById(read.answersByFixture.get(stage.fixtureId) ?? [])
      const p = checklistProgress(template, answers)
      const skippedRows = skippedFor(read.questions, kind, stage.fixtureId).map(({ question, skip: s }) => ({ words: question.words, by: s.by, why: s.why }))
      return { name: stage.name, standing: p.asked === 0 ? 'No questions yet' : `Open · ${p.answered} of ${p.asked} answered`, rows: template.map((q) => paperRowFromLive(q, answers.get(q.id))), skipped: recordSkippedLineWords(skippedRows), foot: '' }
    })
    if (paper.every((s) => s.rows.length === 0)) {
      showToast(PRINT_WORDS.nothing, 'warning')
      return
    }
    // The paper an inspector or the GC reads: a copy is kept under Sent from this job, as every print that leaves the office.
    const jobLabel = paperJobLabel(job)
    const ok = printAndFile(buildChecklistPaperHtml({ jobLabel, customer: (job.customer_name ?? '').trim() || null, address: (job.job_address ?? '').trim() || null, printedAtIso: new Date().toISOString(), stages: paper }), { kind: 'stage_checklists', title: `Stage checklists · ${jobLabel}`, jobIds: [job.id], source: { table: 'jobs_ledger', id: job.id } })
    if (!ok) showToast(PRINT_WORDS.blocked, 'error')
  }
  const promote = async (stage: JobStageChecklist, q: StageChecklistQuestion) => {
    setBusy(q.id)
    try {
      const company = await read.io.promote(q.id)
      read.promoteQuestion(q.id, company)
      setAsk(null)
      showToast(promoteWords(stage.name, q).toast, 'success')
    } catch (e) {
      showToast(`The check was not added to the company's list. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="job-documents-checklists" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="job-documents-checklists">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h3 id="job-documents-checklists" style={documentsHeading}>
          Stage checklists
        </h3>
        {summary ? (
          <span style={muted} data-testid="job-documents-checklists-summary">
            {summary}
          </span>
        ) : null}
        {stages.length > 0 ? (
          <button type="button" style={{ ...documentsQuietButton, marginLeft: 'auto' }} onClick={print} data-testid="job-documents-checklists-print">
            {PRINT_WORDS.press}
          </button>
        ) : null}
      </div>
      {failure ? (
        <OfflineRetryPanel failure={failure} onRetry={read.reload} surface="job-documents-checklists" idempotent busy={read.loading} />
      ) : read.rows == null ? (
        <p style={muted}>Loading…</p>
      ) : stages.length === 0 ? (
        <EmptyState
          compact
          {...(onRequestTab
            ? { main: 'No stages take a checklist on this job.', next: { label: 'Bill', onPress: () => onRequestTab('bill') }, tail: 'is the tab that adds a stage line named Rough In, Top Out or Trim Set.' }
            : { main: 'No stages take a checklist on this job. A stage line named Rough In, Top Out or Trim Set on the Bill tab gets one.' })}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {stages.map((stage) => {
            const kind = stage.state.kind!
            const template = templateFor(read.questions, kind, stage.fixtureId)
            const groups = templateGroups(template)
            const skipped = skippedFor(read.questions, kind, stage.fixtureId)
            const stageAnswers = read.answersByFixture.get(stage.fixtureId) ?? []
            const answers = liveAnswersById(stageAnswers)
            // The record (#237 PR 3): filed, the chip and the line say so; amended, the chip says which version is open again.
            const stageRecords = recordsOfStage(read.records, stage.fixtureId)
            const filedRecord = filedRecordOf(read.records, stage.fixtureId)
            const amendingRecord = amendingRecordOf(read.records, stage.fixtureId)
            const chip = filedRecord
              ? { words: filedChipWords(filedRecord), tone: 'green' as StandingTone }
              : amendingRecord
                ? { words: amendingChipWords(amendingRecord, stage.state.answered, stage.state.asked), tone: 'amber' as StandingTone }
                : stageStandingChip(stage.state, skipped.length)
            const pdfUrl = filedRecord ? recordPdfUrl(filedRecord) : null
            const versions = versionsLineWords(stageRecords)
            const isFolded = folded?.[stage.fixtureId] ?? false
            const words = addCheckWords(stage.name)
            const skipLines = skipWords(stage.name)
            const hasList = template.length > 0 || skipped.length > 0
            const row = (q: StageChecklistQuestion, index: number) => {
              const a = answers.get(q.id) ?? null
              const pickWords = rowPickWords(q, a)
              // The answer's words, then who added it and why: an item says its adder after it is answered too.
              const metaWords = [a?.pick ? `${pickWords} · ${rowMetaWords(a)}` : '', itemMetaWords(q, who.userId)].filter(Boolean).join(' · ')
              const mayTakeOff = canTakeOffJobItem(role, q, who.userId)
              const maySkip = canSkipQuestion(canAdd, q)
              const mayPromote = canPromoteJobItem(role, q)
              const mayMove = canAdd && groups.job.length > 1 && groups.job.some((x) => x.id === q.id)
              const asking = ask?.id === q.id ? ask.kind : null
              const promoting = promoteWords(stage.name, q)
              const rowBusy = busy === q.id || busy === stage.fixtureId
              const sent = openStageCheckFor(withDispatch, stage.fixtureId, q.id)
              const sig = signatureStands(q, a)
              const sigTag = rowSignatureTag(q, a)
              const voidedRows = voidedAnswersOf(stageAnswers, q.id)
              return (
                <div key={q.id} style={rowStyle} data-testid="job-documents-checklist-row" data-pick={a?.pick ?? 'open'}>
                  <span style={glyphTone(a?.pick)} aria-hidden>
                    {rowGlyph(a)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div>
                      <span style={{ fontWeight: a?.pick ? 500 : 600, color: a?.pick ? 'var(--text-strong)' : 'var(--text-amber-800)' }}>{a?.pick ? '' : `${pickWords} · `}</span>
                      <span>
                        {index}. {q.words}
                      </span>
                      {rowAsksPhotoTag(q, a) ? <span style={photoTag}>asks for a photo</span> : null}
                      {sigTag ? (
                        <span style={sigTag.signed ? signedTag : photoTag} data-checklist-signature-tag={sigTag.signed ? 'signed' : 'needs'}>
                          {sigTag.words}
                        </span>
                      ) : null}
                      {q.sheet ? (
                        <span style={{ marginLeft: '0.4rem' }}>
                          <PlanSheetChip sheet={q.sheet} plansUrl={job.job_plans_link} />
                        </span>
                      ) : null}
                    </div>
                    {metaWords ? <div style={muted}>{metaWords}</div> : null}
                    {sig ? (
                      <div style={{ marginTop: '0.2rem' }}>
                        <SignatureMark signature={sig} inkUrl={read.io.inkUrl} />
                      </div>
                    ) : null}
                    {voidedRows.map((v) => (
                      <div key={v.id} style={voidedLine} data-checklist-voided={v.id}>
                        {v.signature ? <SignatureMark signature={v.signature} inkUrl={read.io.inkUrl} /> : null}
                        <span style={{ flex: '1 1 12rem' }}>
                          <span style={{ fontWeight: 600 }}>{TAKE_BACK_WORDS.heading} · </span>
                          {voidedLineWords(v)}
                        </span>
                      </div>
                    ))}
                    {sent ? (
                      <div style={{ marginTop: '0.2rem' }}>
                        <span style={withDispatchTag} data-checklist-with-dispatch={q.id}>
                          {withDispatchWords(sent, Date.now())}
                        </span>
                        {sent.reply ? (
                          <div style={dispatchReply} data-checklist-dispatch-reply={q.id}>
                            {dispatchReplyWords(sent.reply, Date.now())}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {asking === 'take-off' ? (
                      <div style={askLine} data-testid="job-documents-checklist-take-off">
                        <span style={muted}>{TAKE_OFF_WORDS.hint}</span>
                        <button type="button" style={documentsQuietButton} disabled={rowBusy} onClick={() => void takeOff(stage, q)}>
                          {TAKE_OFF_WORDS.confirm}
                        </button>
                        <button type="button" style={{ ...quiet, ...touch }} onClick={() => setAsk(null)}>
                          {TAKE_OFF_WORDS.keep}
                        </button>
                      </div>
                    ) : asking === 'skip' ? (
                      <div style={askLine} data-testid="job-documents-checklist-skip">
                        <span style={{ ...muted, flexBasis: '100%' }}>{skipLines.hint}</span>
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
                            void skip(stage, q)
                          }}
                          style={reasonBox}
                        />
                        <button type="button" style={documentsQuietButton} disabled={rowBusy} onClick={() => void skip(stage, q)}>
                          {skipLines.confirm}
                        </button>
                        <button type="button" style={{ ...quiet, ...touch }} onClick={() => setAsk(null)}>
                          {skipLines.keep}
                        </button>
                        {skipBlocked ? <span style={{ ...muted, flexBasis: '100%', color: 'var(--text-amber-700)', fontWeight: 600 }}>{skipBlocked}</span> : null}
                      </div>
                    ) : asking === 'promote' ? (
                      <div style={askLine} data-testid="job-documents-checklist-promote">
                        <span style={{ ...muted, flexBasis: '100%' }}>{promoting.hint}</span>
                        <button type="button" style={documentsQuietButton} disabled={rowBusy} onClick={() => void promote(stage, q)}>
                          {promoting.confirm}
                        </button>
                        <button type="button" style={{ ...quiet, ...touch }} onClick={() => setAsk(null)}>
                          {promoting.keep}
                        </button>
                      </div>
                    ) : mayMove || mayPromote || mayTakeOff || maySkip ? (
                      <div style={pressLine}>
                        {mayMove ? (
                          <>
                            <button type="button" style={{ ...arrow, ...(isMobile ? { minWidth: 44, minHeight: 44 } : {}), ...(groups.job[0]?.id === q.id ? deadArrow : {}) }} disabled={rowBusy || groups.job[0]?.id === q.id} onClick={() => void move(stage, groups.job, q, -1)} aria-label={`${MOVE_WORDS.up}: ${q.words}`}>
                              ▲
                            </button>
                            <button type="button" style={{ ...arrow, ...(isMobile ? { minWidth: 44, minHeight: 44 } : {}), ...(groups.job[groups.job.length - 1]?.id === q.id ? deadArrow : {}) }} disabled={rowBusy || groups.job[groups.job.length - 1]?.id === q.id} onClick={() => void move(stage, groups.job, q, 1)} aria-label={`${MOVE_WORDS.down}: ${q.words}`}>
                              ▼
                            </button>
                          </>
                        ) : null}
                        {maySkip ? (
                          <button
                            type="button"
                            style={{ ...quiet, ...touch }}
                            onClick={() => {
                              setSkipWhy('')
                              setSkipBlocked(null)
                              setAsk({ id: q.id, kind: 'skip' })
                            }}
                            aria-label={`${skipLines.press}: ${q.words}`}
                          >
                            {skipLines.press}
                          </button>
                        ) : null}
                        {mayPromote ? (
                          <button type="button" style={{ ...link, ...touch }} onClick={() => setAsk({ id: q.id, kind: 'promote' })} aria-label={`${promoting.press}: ${q.words}`}>
                            {promoting.press}
                          </button>
                        ) : null}
                        {mayTakeOff ? (
                          <button type="button" style={{ ...quiet, ...touch }} onClick={() => setAsk({ id: q.id, kind: 'take-off' })} aria-label={`${TAKE_OFF_WORDS.press}: ${q.words}`}>
                            {TAKE_OFF_WORDS.press}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            }
            return (
              <div key={stage.fixtureId} data-testid="job-documents-checklist-stage" data-standing={stage.state.standing}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" style={documentsLinkButton} aria-expanded={!isFolded} onClick={() => setFolded((f) => ({ ...(f ?? {}), [stage.fixtureId]: !isFolded }))}>
                    {stage.name}
                  </button>
                  <span style={{ ...documentsChip, marginLeft: 0, ...chipTone[chip.tone] }} data-checklist-stage-chip={filedRecord ? 'filed' : amendingRecord ? 'amending' : 'open'}>
                    {chip.words}
                  </span>
                </div>
                {filedRecord ? (
                  <p style={recordLine} data-testid="job-documents-checklist-record">
                    {recordLineWords(filedRecord)}
                    {pdfUrl ? (
                      <>
                        {' · '}
                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)' }}>
                          Open in Drive ↗
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {versions ? (
                  <p style={recordLine} data-testid="job-documents-checklist-versions">
                    {versions}
                  </p>
                ) : null}
                {filedRecord && canAdd ? (
                  amendingId === filedRecord.id ? (
                    <div style={askLine} data-testid="job-documents-checklist-amend">
                      <span style={{ ...muted, flexBasis: '100%' }}>{AMEND_WORDS.hint}</span>
                      <input
                        type="text"
                        aria-label={AMEND_WORDS.label}
                        placeholder={AMEND_WORDS.placeholder}
                        value={amendWhy}
                        maxLength={AMEND_WHY_MAX_CHARS}
                        autoFocus
                        onChange={(e) => setAmendWhy(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return
                          e.preventDefault()
                          void amend(stage, filedRecord)
                        }}
                        style={reasonBox}
                      />
                      <button type="button" style={documentsQuietButton} disabled={busy === filedRecord.id} onClick={() => void amend(stage, filedRecord)}>
                        {AMEND_WORDS.confirm}
                      </button>
                      <button type="button" style={{ ...quiet, ...touch }} onClick={() => setAmendingId(null)}>
                        {AMEND_WORDS.keep}
                      </button>
                      {amendBlocked ? <span style={{ ...muted, flexBasis: '100%', color: 'var(--text-amber-700)', fontWeight: 600 }}>{amendBlocked}</span> : null}
                    </div>
                  ) : (
                    <div style={pressLine}>
                      <button
                        type="button"
                        style={{ ...quiet, ...touch }}
                        onClick={() => {
                          setAmendWhy('')
                          setAmendBlocked(null)
                          setAmendingId(filedRecord.id)
                        }}
                        aria-label={`${AMEND_WORDS.press}: ${stage.name}`}
                      >
                        {AMEND_WORDS.press}
                      </button>
                    </div>
                  )
                ) : null}
                {isFolded ? null : (
                  <div style={{ marginTop: '0.25rem' }}>
                    {hasList ? (
                      <>
                        <div style={groupHead}>
                          <span>{GROUP_WORDS.company}</span>
                          <span>{groupCountWords(checklistProgress(groups.company, answers))}</span>
                        </div>
                        {groups.company.length === 0 && skipped.length === 0 ? <p style={muted}>{noQuestionsWords(stage.name)}</p> : groups.company.map((q, i) => row(q, i + 1))}
                        {skipped.length > 0 ? (
                          <div data-testid="job-documents-checklist-skipped">
                            <div style={groupHead}>
                              <span>{skipLines.heading}</span>
                              <span>{skipped.length}</span>
                            </div>
                            {skipped.map(({ question, skip: skipRow }) => (
                              <div key={question.id} style={rowStyle}>
                                <span style={glyphTone(null)} aria-hidden>
                                  —
                                </span>
                                <div style={{ minWidth: 0, color: 'var(--text-muted)' }}>
                                  <s>{question.words}</s>
                                  <div style={muted}>{skippedLineWords(skipRow)}</div>
                                  {canAdd ? (
                                    <div style={pressLine}>
                                      <button type="button" style={{ ...link, ...touch }} disabled={busy === question.id} onClick={() => void putBack(stage, question, skipRow.id)} aria-label={`${skipLines.putBack}: ${question.words}`}>
                                        {skipLines.putBack}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div style={groupHead}>
                          <span>{GROUP_WORDS.job}</span>
                          <span>{groupCountWords(checklistProgress(groups.job, answers))}</span>
                        </div>
                        {groups.job.length === 0 ? <p style={muted}>{noJobItemsWords(stage.name, canAdd)}</p> : groups.job.map((q, i) => row(q, groups.company.length + i + 1))}
                      </>
                    ) : adding !== stage.fixtureId ? (
                      <EmptyState compact {...(canAdd ? { main: 'No questions yet.', next: { label: words.press, onPress: () => setAdding(stage.fixtureId) }, tail: 'adds the first for this job.' } : { main: noQuestionsWords(stage.name) })} />
                    ) : null}
                    {canAdd ? (
                      adding === stage.fixtureId ? (
                        <AddCheckBox
                          stageName={stage.name}
                          onDone={() => setAdding(null)}
                          onAdd={async (draft) => {
                            const q = await read.io.addItem({ jobId: job.id, fixtureId: stage.fixtureId, kind, order: nextItemOrder(read.questions, stage.fixtureId), ...draft }, who)
                            read.putQuestion(q)
                            showToast(addedWords(stage.name, stateAfter(stage, [...read.questions, q])), 'success')
                          }}
                        />
                      ) : hasList ? (
                        <button type="button" style={{ ...link, marginTop: '0.35rem', ...touch }} onClick={() => setAdding(stage.fixtureId)}>
                          {words.press}
                        </button>
                      ) : null
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
          <p style={muted}>{READOUT_FOOT}</p>
        </div>
      )}
    </section>
  )
}

export default JobDocumentsChecklists
