/**
 * Send this check to Dispatch (punch list #245, PR 1): the sheet above the stage checklist sheet, in the sheet's own
 * shape. It never asks the crew to retype what the row knows: the context card carries the job's number and name, the
 * address, the stage and its count, the check's words with its chips, the pick so far with its stamp and the note. One
 * reason chip is required; the words are required only under *Something else*. The chip sets the tail of the title and,
 * for *Can't do it*, the request's priority to high. The foot says where the answer comes back. The send goes through
 * the io's `send`, the dispatch rail's own path, so the inbox, the push and the thread carry it. The rules are
 * `lib/jobs/stageCheckDispatch.ts`.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import { answerStampWords, type JobStageRef, type StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import {
  STAGE_CHECK_REASONS,
  STAGE_CHECK_WORDS,
  STAGE_CHECK_WORDS_MAX,
  contextMetaWords,
  stageCheckJobLabel,
  stageCheckPriority,
  stageCheckProblem,
  stageCheckRefusalWords,
  stageCheckRow,
  stageCheckSentWords,
  type OpenStageCheck,
  type StageCheckJob,
  type StageCheckReason,
} from '../../lib/jobs/stageCheckDispatch'
import type { StageCheckDispatchIo } from '../../lib/jobs/stageCheckDispatchIo'
import type { AnswerWho, JobAnswer } from '../../lib/jobs/stageChecklistSheetIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import * as S from '../jobMode/sheetStyles'

export interface StageCheckDispatchSheetProps {
  jobId: string
  stage: JobStageRef
  /** *2 of 5 answered*, for the context card. */
  progressWords: string
  question: StageChecklistQuestion
  answer: JobAnswer | null
  who: AnswerWho
  io: StageCheckDispatchIo
  /** The request once it is in, so the row wears *With Dispatch* at once. */
  onSent: (request: OpenStageCheck) => void
  onClose: () => void
}

const card: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.2rem', fontSize: '0.875rem', color: 'var(--text-700)' }
const cardTitle: CSSProperties = { fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)', margin: 0 }
const meta: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const groupHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', margin: '0.9rem 0 0.3rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const chip: CSSProperties = { minHeight: 40, padding: '0 0.8rem', borderRadius: 999, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }
const chipOn: CSSProperties = { background: 'var(--text-strong)', borderColor: 'var(--text-strong)', color: 'var(--surface)' }
const box: CSSProperties = { width: '100%', minHeight: 72, boxSizing: 'border-box', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.95rem', resize: 'vertical' }
const waits: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-amber-700)', fontWeight: 600, margin: 0 }

export function StageCheckDispatchSheet({ jobId, stage, progressWords, question, answer, who, io, onSent, onClose }: StageCheckDispatchSheetProps) {
  const { showToast } = useToastContext()
  const [job, setJob] = useState<StageCheckJob>({ id: jobId })
  const [reason, setReason] = useState<StageCheckReason | null>(null)
  const [words, setWords] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    io.job(jobId).then(
      (j) => live && setJob(j),
      () => live && setJob({ id: jobId }),
    )
    return () => {
      live = false
    }
  }, [io, jobId])

  const send = async () => {
    if (busy) return
    const blocked = stageCheckProblem(reason, words)
    setProblem(blocked)
    if (blocked || !reason) return
    if (!who.userId) {
      showToast('Sign in to send to Dispatch.', 'error')
      return
    }
    setBusy(true)
    try {
      const row = stageCheckRow({ fromUserId: who.userId, job, fixtureId: stage.fixtureId, stageName: stage.name, question, reason, words })
      const sent = await io.send(row)
      onSent({ id: sent.id, fixtureId: stage.fixtureId, questionId: question.id, title: row.title, createdAt: new Date().toISOString(), priority: row.priority })
      showToast(sent.pushed ? stageCheckSentWords(reason) : `${stageCheckSentWords(reason)} The push did not go: ${sent.pushError ?? 'no reason given'}.`, sent.pushed ? 'success' : 'warning')
      onClose()
    } catch (e) {
      showToast(`The check was not sent. ${stageCheckRefusalWords(e, formatErrorMessage(e))}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const jobLabel = stageCheckJobLabel(job)
  const line2 = [job.address?.trim() ?? '', stage.name, progressWords].filter(Boolean).join(' · ')
  const high = reason ? stageCheckPriority(reason) === 'high' : false

  const foot = (
    <div style={S.footerRow}>
      <button type="button" style={S.secondaryBtn} onClick={onClose} disabled={busy}>
        {STAGE_CHECK_WORDS.notNow}
      </button>
      <button type="button" style={busy ? { ...S.hereBtn, ...S.disabled } : S.hereBtn} onClick={() => void send()} disabled={busy} data-stage-check-send>
        {busy ? STAGE_CHECK_WORDS.sending : STAGE_CHECK_WORDS.confirm}
      </button>
    </div>
  )

  return (
    <ResponsiveModalShell title={STAGE_CHECK_WORDS.title} onRequestClose={onClose} footer={foot} maxWidthDesktop={520} zIndex={1200}>
      <div data-stage-check-dispatch-sheet={question.id} style={{ display: 'grid', gap: '0.5rem' }}>
        <div style={card} data-stage-check-context>
          <p style={cardTitle}>{jobLabel || 'This job'}</p>
          {line2 ? <p style={meta}>{line2}</p> : null}
          <p style={{ margin: '0.3rem 0 0', fontWeight: 600, color: 'var(--text-strong)' }}>{question.words}</p>
          <p style={meta}>{contextMetaWords(question, answer, answerStampWords(answer))}</p>
          {answer?.note ? <p style={{ ...meta, fontStyle: 'italic' }}>“{answer.note}”</p> : null}
          {answer?.photo ? <p style={meta}>photo: {answer.photo.state === 'filed' ? 'in the customer’s Drive folder' : answer.photo.state === 'failed' ? 'not filed' : 'on its way'}</p> : null}
        </div>
        <div style={groupHead}>
          <span>{STAGE_CHECK_WORDS.why}</span>
          <span>{STAGE_CHECK_WORDS.whyHint}</span>
        </div>
        <div role="group" aria-label={STAGE_CHECK_WORDS.why} style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {STAGE_CHECK_REASONS.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={reason === r.key}
              style={reason === r.key ? { ...chip, ...chipOn } : chip}
              onClick={() => {
                setReason(r.key)
                setProblem(null)
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <textarea aria-label={STAGE_CHECK_WORDS.wordsLabel} placeholder={STAGE_CHECK_WORDS.wordsPlaceholder} value={words} maxLength={STAGE_CHECK_WORDS_MAX} onChange={(e) => setWords(e.target.value)} style={box} rows={3} />
        {problem ? <p style={waits}>{problem}</p> : null}
        <p style={meta}>
          {STAGE_CHECK_WORDS.foot}
          {high ? ` ${STAGE_CHECK_WORDS.footHigh}` : ''}
        </p>
      </div>
    </ResponsiveModalShell>
  )
}

export default StageCheckDispatchSheet
