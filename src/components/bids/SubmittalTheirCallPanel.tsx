/**
 * The Their call step's body (moved out of `BidsSubmittalsTab.tsx`, 2026-10-04, the split's step 4):
 * the decisions in one line, the entry for a submittal approved off the room, the reviewer's own
 * files with what the robot read in them, and the thread. It draws what it is handed and reports
 * each press; the tab owns the rows, the files, the thread's reply and every write.
 */
import { useToastContext } from '../../contexts/ToastContext'
import { describeThreadEntry, summarizeThread, type SubmittalRoomRow } from '../../lib/submittals/submittalRoom'
import type { RoomMessage } from '../../../supabase/functions/_shared/submittalRoomPayload'
import { DECISION_LABELS, describeDecisions, type DecisionSummary } from '../../lib/submittals/reviewDecisions'
import { describeEnteredCount, describeReviewerFile, type ReviewerFile } from '../../lib/submittals/reviewerFiles'
import { confirmLabel, liveTask, redlinesToConfirm, taskStatus, type SubmittalTaskRow } from '../../lib/submittals/robotTasks'
import { staleAsk, type RobotSeatState } from '../../lib/submittals/robotOffer'
import { describeTask } from '../../../supabase/functions/_shared/submittalRobot'
import { formatShortDate } from '../../lib/submittals/submittalRevision'
import { APP_CALENDAR_TZ as ROOM_TZ } from '../../utils/dateUtils'
import { RobotOffer } from './RobotOffer'
import { btn, btnGreen, btnQuiet, smallMuted } from './submittalTabStyles'

export type SubmittalTheirCallPanelProps = {
  decisions: DecisionSummary
  /** The decisions as text, for the clipboard. */
  decisionsText: () => string
  /** Rows one "they approved all of it" entry would mark: 0 hides the offer (and on an older revision). */
  approvable: number
  /** The revision is out, or already holds a reviewer's file: the drop button draws. */
  showDropFile: boolean
  reviewerFiles: ReadonlyArray<ReviewerFile>
  tasks: ReadonlyArray<SubmittalTaskRow>
  robotSeat: RobotSeatState
  room: SubmittalRoomRow | null
  messages: ReadonlyArray<RoomMessage>
  threadOpen: boolean
  /** The thread entry being answered, the answer so far, and whether it is on its way. */
  replyTo: string | null
  replyBody: string
  replying: boolean
  busy: boolean
  onApproveAll: () => void
  onPickFile: () => void
  onAskRobot: (index: number, file: ReviewerFile) => void
  onOpenFile: (file: ReviewerFile) => void
  onRemoveFile: (index: number) => void
  onCancelTask: (taskId: string) => void
  onConfirmRedlines: (task: SubmittalTaskRow, withUnsure: boolean) => void
  onToggleThread: () => void
  /** Start an answer to an entry (a fresh, empty one), or `null` to drop it. */
  onReplyTo: (messageId: string | null) => void
  onReplyBody: (body: string) => void
  onSendReply: () => void
}

export function SubmittalTheirCallPanel({ decisions, decisionsText, approvable, showDropFile, reviewerFiles, tasks, robotSeat, room, messages, threadOpen, replyTo, replyBody, replying, busy, onApproveAll, onPickFile, onAskRobot, onOpenFile, onRemoveFile, onCancelTask, onConfirmRedlines, onToggleThread, onReplyTo, onReplyBody, onSendReply }: SubmittalTheirCallPanelProps) {
  const { showToast } = useToastContext()
  return (
    <>
      {decisions.decided > 0 ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', padding: '0.4rem 0.7rem' }} data-testid="decisions-line">
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-strong)' }}>
            <b>Their call:</b> {describeDecisions(decisions)}
            {decisions.open > 0 ? <span style={smallMuted}> · {decisions.open} still open</span> : null}
          </span>
          <button type="button" onClick={() => void navigator.clipboard.writeText(decisionsText()).then(() => showToast('Decisions copied as text.', 'success'), () => showToast('Could not copy.', 'error'))} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>
            Copy their decisions as text
          </button>
        </div>
      ) : null}
      {approvable > 0 ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.5rem 0' }}>
          <button type="button" disabled={busy} onClick={onApproveAll} style={btn} data-testid="approve-all-open" title="They said yes to all of it by email, on paper or before the room existed. One entry marks every row with no call yet.">
            {decisions.decided > 0 ? `They approved the other ${approvable}…` : 'They approved all of it…'}
          </button>
          <span style={smallMuted}>{decisions.decided > 0 ? 'One entry for every row with no answer yet. You say who approved them and on what day.' : 'One entry for a submittal approved whole. You say who approved it and on what day.'}</span>
        </div>
      ) : null}
      {showDropFile ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.5rem 0' }}>
          <button type="button" disabled={busy} onClick={onPickFile} style={btn} title="The architect marked up the PDF or answered by email. Keep their file here and type their answers with Their answer on each row">
            Drop a reviewer's file
          </button>
          <span style={smallMuted}>A marked-up PDF or an email instead of the room. Type what they said with Their answer on each row.</span>
        </div>
      ) : null}
      {reviewerFiles.length > 0 ? (
        <div style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 6, padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="reviewer-files">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>The reviewer's own files</span>
            <span style={smallMuted}>{describeEnteredCount(decisions.entered) || 'type what they said with Their answer on each row — the record reads entered by you'}</span>
          </div>
          {reviewerFiles.map((f, i) => {
            const t = liveTask(tasks, 'read_redlines', (inp) => inp.reviewer_index === i && (!inp.path || inp.path === f.path))
            const r = t ? redlinesToConfirm(t) : null
            const st = t ? taskStatus(t) : null
            return (
              <div key={f.path} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
                  <span><b style={{ color: 'var(--text-strong)' }}>{f.name}</b> <span style={smallMuted}>· {describeReviewerFile(f, ROOM_TZ)}</span></span>
                  <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {f.kind === 'redline' && !t ? <RobotOffer kind="read_redlines" seat={robotSeat} busy={busy} onAsk={() => onAskRobot(i, f)} testId="ask-robot-redlines" /> : null}
                    <button type="button" disabled={busy} onClick={() => onOpenFile(f)} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>Open the file</button>
                    <button type="button" disabled={busy} onClick={() => onRemoveFile(i)} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Remove this file</button>
                  </span>
                </div>
                {t ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ ...smallMuted, fontStyle: 'italic' }} data-testid="robot-line">{describeTask(t)}{(() => { const stale = st === 'queued' ? staleAsk('read_redlines', t.requested_at, robotSeat, Date.now(), formatShortDate) : null; return stale ? ` · ${stale.suffix}` : '' })()}</span>
                    {st === 'blocked' || st === 'queued' ? <button type="button" disabled={busy} onClick={() => onCancelTask(t.id)} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{st === 'blocked' ? 'Dismiss' : 'Cancel'}</button> : null}
                  </div>
                ) : null}
                {r ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '0.5rem', borderLeft: '3px solid var(--border-strong)' }} data-testid="robot-redlines">
                    {[...r.sure, ...r.unsure].map((a, k) => (
                      <span key={k} style={{ fontSize: '0.8125rem' }}>
                        <b style={{ color: a.proposed === 'approved' ? 'var(--text-green-700)' : a.proposed === 'revise' ? 'var(--text-amber-700)' : 'var(--text-red-700)' }}>{a.tag}{a.confidence < 0.7 ? ' ?' : ''}</b> · {DECISION_LABELS[a.proposed as 'approved' | 'revise' | 'rejected']}{a.text ? <span style={smallMuted}> · “{a.text}”</span> : null}{a.page ? <span style={smallMuted}> · p.{a.page}</span> : null}
                      </span>
                    ))}
                    {r.questions.map((q, k) => (
                      <span key={`q${k}`} style={{ fontSize: '0.8125rem' }}><b style={{ color: 'var(--text-muted)' }}>{q.tag ?? 'no tag'}</b> · a question for the thread<span style={smallMuted}> · “{q.text}”</span></span>
                    ))}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                      <button type="button" disabled={busy} onClick={() => onConfirmRedlines(t as SubmittalTaskRow, false)} style={btnGreen} data-testid="confirm-redlines">{confirmLabel(r.sure.length, r.unsure.length, 'settle') || 'Confirm'}</button>
                      {r.unsure.length ? <button type="button" disabled={busy} onClick={() => onConfirmRedlines(t as SubmittalTaskRow, true)} style={btn}>Take the unsure ones too</button> : null}
                      <span style={smallMuted}>Each lands as read from {f.personName ?? 'the reviewer'}'s file, confirmed by you; the questions post to the thread.</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
          <span style={smallMuted}>Nothing about these files shows on the room.</span>
        </div>
      ) : null}
      {room ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="room-thread-panel">
          <button type="button" aria-expanded={threadOpen} onClick={onToggleThread} style={{ ...btnQuiet, display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: 0 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Thread</span>
            <span style={smallMuted}>{summarizeThread(messages, ROOM_TZ)} {threadOpen ? '▴' : '▾'}</span>
          </button>
          {threadOpen ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="room-thread-entries">
              {messages.length === 0 ? <span style={smallMuted}>Nothing asked yet. Questions from the room land here and on the inbox.</span> : null}
              {messages.map((m) => {
                const d = describeThreadEntry(m, ROOM_TZ)
                const askable = m.authorKind === 'reviewer' || m.authorKind === 'watcher'
                return (
                  <div key={m.id} data-thread-kind={m.kind} style={{ fontSize: '0.8125rem', borderLeft: `3px solid ${m.authorKind === 'office' ? '#b0662f' : d.quiet ? 'var(--border)' : 'var(--border-strong)'}`, paddingLeft: 8, color: d.quiet ? 'var(--text-muted)' : 'var(--text-strong)' }}>
                    <div style={{ ...smallMuted, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>{d.who ? <b>{d.who}</b> : null}{d.who && d.when ? ' · ' : ''}{d.when}{m.tags.length ? ` · ${m.tags.join(', ')}` : ''}{m.revNumber ? ` · Rev ${m.revNumber}` : ''}</span>
                      {askable && room.status === 'open' ? (
                        <button type="button" onClick={() => onReplyTo(m.id)} style={{ ...btnQuiet, padding: 0, fontSize: '0.72rem', textDecoration: 'underline dotted' }}>
                          Reply
                        </button>
                      ) : null}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', fontStyle: d.quiet ? 'italic' : 'normal' }}>{m.body}</div>
                    {replyTo === m.id ? (
                      <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }} data-testid="room-thread-reply">
                        <textarea aria-label="Your answer" value={replyBody} onChange={(e) => onReplyBody(e.target.value)} rows={3} placeholder="The answer — the room shows it as the company; they get it by email with their own link" style={{ padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)', resize: 'vertical' }} />
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button type="button" style={btn} disabled={replying} onClick={() => onReplyTo(null)}>Cancel</button>
                          <button type="button" style={{ ...btn, background: '#b0662f', color: 'white', borderColor: 'transparent' }} disabled={replying || !replyBody.trim()} onClick={onSendReply}>
                            {replying ? 'Sending…' : 'Send the answer'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
