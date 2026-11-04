/**
 * The context window on a stage check in the Dispatch inbox (punch list #245, PR 2b): what opens when Dispatch presses
 * the row of a check the crew could not answer. The same context card the crew saw on the send sheet, read live when the
 * viewer may read the sheet's tables and from the request itself when not: the job, the address, the stage and its
 * count, the check's words with its chips, the pick so far with its stamp and the note. Then the reason, the thread with
 * the crew's words as its first line, and the acts: **Open the check**, **Open the job**, **Reply** (a thread note the
 * crew reads under the row and hears as a push) and **Reply and close** (the inbox's close, with the words it already
 * requires). The dispatch group and a dev reply and close, as on every request; the sender never closes their own, since
 * the row closes itself once the check is settled (migration 20261104170000). **Lower priority** sits here on a check
 * that leads the inbox, where the thread's header carried it (v2.6462). The rules are `lib/jobs/stageCheckDispatch.ts`.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import type { DispatchInboxRow, DispatchThreadNoteRow } from '../DispatchInboxSection'
import { getDispatchNoteDisplayMeta } from '../../utils/dispatchNoteDisplay'
import { answerStampWords, checklistProgress, progressWords, stageChecklistKindOf, templateFor } from '../../lib/jobs/stageChecklist'
import {
  STAGE_CHECK_WORDS,
  replyPlaceholderWords,
  stageCheckPayloadFrom,
  stageCheckWindowContext,
  type StageCheckLiveContext,
} from '../../lib/jobs/stageCheckDispatch'
import { supabaseStageChecklistSheetIo, type StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { isCustomerWaiting } from '../../lib/requestPriority'
import { StageCheckWaitingLine } from './StageCheckWaitingLine'
import * as S from '../jobMode/sheetStyles'

/** The three reads the live context takes; the sheet's io has them, and a test hands in a fake. */
export type StageCheckWindowIo = Pick<StageChecklistSheetIo, 'stages' | 'questions' | 'answers'>

let defaultIo: StageCheckWindowIo | null = null
function windowIo(): StageCheckWindowIo {
  if (!defaultIo) defaultIo = supabaseStageChecklistSheetIo()
  return defaultIo
}

export interface StageCheckWindowProps {
  row: DispatchInboxRow
  notes: DispatchThreadNoteRow[]
  notesLoading: boolean
  /** The viewer: the sender never closes their own. */
  viewerId: string | null
  /** True for the dispatch group and a dev, who reply and close on every request. */
  canAct: boolean
  draft: string
  onDraftChange: (draft: string) => void
  saving: boolean
  onReply: () => void
  onReplyAndClose: () => void
  onOpenJob: (() => void) | null
  onOpenCheck: (() => void) | null
  /** Drawn on a check that leads the inbox, when the mount may change a priority. */
  onLower: (() => void) | null
  onClose: () => void
  io?: StageCheckWindowIo
}

const card: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.2rem', fontSize: '0.875rem', color: 'var(--text-700)' }
const cardTitle: CSSProperties = { fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)', margin: 0, display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }
const meta: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const tag: CSSProperties = { display: 'inline-block', padding: '0.05rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', verticalAlign: 'middle', marginLeft: 6 }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600 }
const groupHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', margin: '0.9rem 0 0.3rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const note: CSSProperties = { padding: '0.5rem 0.65rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-strong)', whiteSpace: 'pre-wrap' }
const replyNote: CSSProperties = { ...note, background: 'var(--bg-blue-tint, var(--bg-subtle))' }
const who: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }
const box: CSSProperties = { width: '100%', minHeight: 64, boxSizing: 'border-box', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.95rem', resize: 'vertical' }
const closedBlock: CSSProperties = { ...note, background: 'var(--bg-green-tint)', borderColor: 'var(--border-green)', color: 'var(--text-green-800)' }
const lowerBtn: CSSProperties = { padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }

export function StageCheckWindow({ row, notes, notesLoading, viewerId, canAct, draft, onDraftChange, saving, onReply, onReplyAndClose, onOpenJob, onOpenCheck, onLower, onClose, io }: StageCheckWindowProps) {
  const payload = useMemo(() => stageCheckPayloadFrom(row.pending_payload), [row.pending_payload])
  const [live, setLive] = useState<StageCheckLiveContext | null>(null)
  const jobId = row.job_ledger_id
  const fixtureId = payload?.fixture_id ?? null
  const questionId = payload?.question_id ?? null

  // The live read: the stage's count, the check's words and chips, the pick so far. Any read refused leaves that piece
  // to the request's own title; the window never waits on it to draw.
  useEffect(() => {
    let on = true
    if (!jobId || !fixtureId || !questionId) return
    const reads = io ?? windowIo()
    void Promise.all([
      reads.stages(jobId).catch(() => null),
      reads.questions(jobId).catch(() => null),
      reads.answers(jobId).catch(() => null),
    ]).then(([stages, questions, answers]) => {
      if (!on) return
      const stage = stages?.find((s) => s.fixtureId === fixtureId) ?? null
      const kind = stage ? stageChecklistKindOf(stage.name) : null
      const stageAnswers = (answers ?? []).filter((a) => a.fixtureId === fixtureId)
      const template = questions && kind ? templateFor(questions, kind, fixtureId) : null
      const question = questions?.find((q) => q.id === questionId) ?? null
      const answer = stageAnswers.find((a) => a.questionId === questionId) ?? null
      setLive({
        progressWords: template ? progressWords(checklistProgress(template, stageAnswers)) : null,
        question,
        answer,
      })
    })
    return () => {
      on = false
    }
  }, [io, jobId, fixtureId, questionId])

  const ctx = useMemo(() => stageCheckWindowContext(row, live, answerStampWords(live?.answer ?? null)), [row, live])
  const isClosed = row.status === 'closed'
  const waiting = !isClosed && isCustomerWaiting(row)
  const isSender = !!viewerId && row.from_user_id === viewerId
  const mayReply = canAct && !isClosed
  const mayClose = mayReply && !isSender
  const hasWords = draft.trim().length > 0
  const fromLabel = row.sender?.name?.trim() || row.sender?.email?.trim() || 'The crew'
  const sentMeta = row.created_at ? getDispatchNoteDisplayMeta(row.created_at) : null

  const foot = (
    <div style={{ width: '100%', display: 'grid', gap: '0.4rem' }}>
      <p style={meta}>{isClosed ? '' : isSender && canAct ? STAGE_CHECK_WORDS.senderCannotClose : STAGE_CHECK_WORDS.windowFoot}</p>
      <div style={{ ...S.footerRow, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" style={{ ...S.secondaryBtn, marginRight: 'auto' }} onClick={onClose} disabled={saving}>
          {STAGE_CHECK_WORDS.notNow}
        </button>
        {onOpenCheck && !isClosed ? (
          <button type="button" style={S.secondaryBtn} onClick={onOpenCheck} data-stage-check-window-open-check>
            {STAGE_CHECK_WORDS.openCheck}
          </button>
        ) : null}
        {mayReply ? (
          <button type="button" style={hasWords && !saving ? S.hereBtn : { ...S.hereBtn, ...S.disabled }} disabled={!hasWords || saving} onClick={onReply} data-stage-check-window-reply>
            {saving ? 'Sending…' : STAGE_CHECK_WORDS.reply}
          </button>
        ) : null}
        {mayClose ? (
          <button type="button" style={hasWords && !saving ? S.secondaryBtn : { ...S.secondaryBtn, ...S.disabled }} disabled={!hasWords || saving} onClick={onReplyAndClose} data-stage-check-window-close>
            {STAGE_CHECK_WORDS.replyAndClose}
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <ResponsiveModalShell title={`${STAGE_CHECK_WORDS.windowTitle} · ${ctx.reasonLabel}`} onRequestClose={onClose} footer={foot} maxWidthDesktop={560} zIndex={1090}>
      <div data-stage-check-window={row.id} style={{ display: 'grid', gap: '0.5rem' }}>
        {waiting ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <StageCheckWaitingLine requestId={row.id} reason={payload?.reason} createdAt={row.created_at} />
            {onLower ? (
              <button type="button" style={lowerBtn} onClick={onLower} title="Take it off the top of the list without closing it. Asks why." data-dispatch-stage-check-lower={row.id}>
                {STAGE_CHECK_WORDS.lower}
              </button>
            ) : null}
          </div>
        ) : null}
        <div style={card} data-stage-check-window-context>
          <p style={cardTitle}>
            <span>{ctx.jobLine}</span>
            {onOpenJob ? (
              <button type="button" style={link} onClick={onOpenJob} data-stage-check-window-open-job>
                {STAGE_CHECK_WORDS.openJob} ›
              </button>
            ) : null}
          </p>
          {ctx.line2 ? <p style={meta}>{ctx.line2}</p> : null}
          <p style={{ margin: '0.3rem 0 0', fontWeight: 600, color: 'var(--text-strong)' }}>
            {ctx.question}
            {live?.question?.asksPhoto ? <span style={tag}>photo</span> : null}
            {ctx.sheet ? <span style={tag}>{ctx.sheet}</span> : null}
          </p>
          {ctx.meta ? <p style={meta}>{ctx.meta}</p> : null}
          {ctx.note ? <p style={{ ...meta, fontStyle: 'italic' }}>“{ctx.note}”</p> : null}
        </div>
        <div style={groupHead}>
          <span>{ctx.reasonLabel}</span>
          <span>{notes.length === 0 ? '' : notes.length === 1 ? '1 reply' : `${notes.length} replies`}</span>
        </div>
        <div style={{ display: 'grid', gap: '0.4rem' }} data-stage-check-window-thread>
          <div style={note}>
            <div style={who}>
              <strong style={{ color: 'var(--text-strong)' }}>{fromLabel}</strong>
              {sentMeta ? ` · ${sentMeta.weekdayTimeChicago} · ${sentMeta.daysAgoLabel}` : ''} · {STAGE_CHECK_WORDS.sentFromSheet}
            </div>
            {ctx.words || ctx.reasonLabel}
          </div>
          {notesLoading ? <p style={meta}>Loading the thread…</p> : null}
          {notes.map((n) => {
            const m = getDispatchNoteDisplayMeta(n.created_at)
            return (
              <div key={n.id} style={replyNote}>
                <div style={who}>
                  <strong style={{ color: 'var(--text-strong)' }}>{n.author?.name?.trim() || 'Dispatch'}</strong> · {m.weekdayTimeChicago} · {m.daysAgoLabel}
                </div>
                {n.body}
              </div>
            )
          })}
          {isClosed ? (
            <div style={closedBlock} data-stage-check-window-closed>
              <div style={{ ...who, color: 'var(--text-green-800)' }}>
                <strong>{STAGE_CHECK_WORDS.closedHead}</strong>
                {row.closed_by?.name?.trim() ? ` · ${row.closed_by.name.trim()}` : ''}
                {row.closed_at ? ` · ${getDispatchNoteDisplayMeta(row.closed_at).weekdayTimeChicago}` : ''}
              </div>
              {row.closed_note?.trim() ? `“${row.closed_note.trim()}”` : ''}
            </div>
          ) : null}
        </div>
        {mayReply ? (
          <textarea
            aria-label={STAGE_CHECK_WORDS.reply}
            placeholder={replyPlaceholderWords(row.sender?.name)}
            value={draft}
            maxLength={2000}
            onChange={(e) => onDraftChange(e.target.value)}
            disabled={saving}
            style={box}
            rows={3}
            data-stage-check-window-box
          />
        ) : null}
      </div>
    </ResponsiveModalShell>
  )
}

export default StageCheckWindow
