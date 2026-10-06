/**
 * The Their call step's body (moved out of `BidsSubmittalsTab.tsx`, 2026-10-04, the split's step 4).
 * It draws what it is handed and reports each press; the tab owns the rows, the files, the
 * thread's reply and every write.
 *
 * Redrawn 2026-10-05 so nobody has to work it out (`theirCallBoard`): one square a fixture
 * (approved, sent back, waiting, no product yet) over the counts and a line on who answered; the
 * parts that came back, in the reviewer's own words, each with the door to change it; the
 * fixtures still owed an answer as buttons that open *Their answer*, with one entry to mark them
 * all approved; and, quiet at the foot, the reviewer's file, the answers as text, and the messages
 * and history. The reviewer's own files and what the robot read in them sit between.
 */
import { useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { describeThreadEntry, summarizeThread, type SubmittalRoomRow } from '../../lib/submittals/submittalRoom'
import type { RoomMessage } from '../../../supabase/functions/_shared/submittalRoomPayload'
import { DECISION_LABELS, type DecisionSummary } from '../../lib/submittals/reviewDecisions'
import { describeEnteredCount, describeReviewerFile, type ReviewerFile } from '../../lib/submittals/reviewerFiles'
import { confirmLabel, liveTask, redlinesToConfirm, taskStatus, type SubmittalTaskRow } from '../../lib/submittals/robotTasks'
import { staleAsk, type RobotSeatState } from '../../lib/submittals/robotOffer'
import { describeTask } from '../../../supabase/functions/_shared/submittalRobot'
import type { SubmittalPartRow } from '../../lib/submittals/itemParts'
import { formatShortDate, type SubmittalItemRow } from '../../lib/submittals/submittalRevision'
import { allApprovedLine, noProductWords, reviewerNames, theirCallBoard, whoAnsweredLine, type BoardState } from '../../lib/submittals/theirCallBoard'
import { APP_CALENDAR_TZ as ROOM_TZ } from '../../utils/dateUtils'
import { RobotOffer } from './RobotOffer'
import { btn, btnGreen, btnQuiet, smallMuted } from './submittalTabStyles'

export type SubmittalTheirCallPanelProps = {
  /** The fixtures the reviewer is asked about (the rows the GC sees), and each one's parts. */
  items: ReadonlyArray<SubmittalItemRow>
  partsOf: ReadonlyMap<string, ReadonlyArray<SubmittalPartRow>>
  decisions: DecisionSummary
  /** The decisions as text, for the clipboard. */
  decisionsText: () => string
  /** Rows one "mark them all approved" entry would mark: 0 hides the offer (and on an older revision). */
  approvable: number
  /** A draft on the newest revision: a part sent back can be changed here and now. */
  canEdit: boolean
  /** The newest revision: the list of what came back says what to do next. */
  isNewest: boolean
  /** The number the next revision would carry, for the line that points at step 7. */
  nextRev: number
  /** How the revision reached the reviewer ("Room link · shared Sep 16 · opened 2×"); said while nothing is answered. */
  sharedLine?: string
  /** 2026-10-06 · on a revision nobody shared: what typing the reviewer's answer does to the GC's page (`emailedRecordLine`). */
  recordLine?: string
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
  /** Open the row's window to change a part that came back, or to add a product. */
  onEdit: (item: SubmittalItemRow) => void
  /** Open the window that records what the reviewer said about one fixture. */
  onAnswer: (item: SubmittalItemRow) => void
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

const CELL: Record<BoardState, { background: string; border?: string; word: string }> = {
  approved: { background: '#16a34a', word: 'approved' },
  sentBack: { background: '#dc2626', word: 'sent back' },
  waiting: { background: 'var(--border-strong)', word: 'waiting' },
  noProduct: { background: 'transparent', border: '1.5px dashed var(--border-strong)', word: 'no product yet' },
}
const TONE = { revise: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)' }, rejected: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' } } as const
const groupLabel = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' } as const
const quietLink = { ...btnQuiet, padding: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: 3 } as const
/** How many waiting fixtures are named before the rest fold behind "and N more". */
const WAITING_SHOWN = 14

export function SubmittalTheirCallPanel({ items, partsOf, decisions, decisionsText, approvable, canEdit, isNewest, nextRev, sharedLine = '', recordLine = '', showDropFile, reviewerFiles, tasks, robotSeat, room, messages, threadOpen, replyTo, replyBody, replying, busy, onEdit, onAnswer, onApproveAll, onPickFile, onAskRobot, onOpenFile, onRemoveFile, onCancelTask, onConfirmRedlines, onToggleThread, onReplyTo, onReplyBody, onSendReply }: SubmittalTheirCallPanelProps) {
  const { showToast } = useToastContext()
  const [allWaiting, setAllWaiting] = useState(false)
  const board = theirCallBoard(items, partsOf)
  const who = whoAnsweredLine(items)
  const reviewer = reviewerNames(items)
  const waitingShown = allWaiting ? board.waiting : board.waiting.slice(0, WAITING_SHOWN)
  const count = (state: BoardState) => (
    <span style={{ whiteSpace: 'nowrap' }} data-state={state}>
      <b style={{ fontSize: '1.05rem', marginRight: '0.25rem', color: board.counts[state] === 0 ? 'var(--text-muted)' : state === 'approved' ? 'var(--text-green-700)' : state === 'sentBack' ? 'var(--text-red-700)' : state === 'noProduct' ? 'var(--text-muted)' : 'var(--text-strong)' }}>{board.counts[state]}</b>
      {CELL[state].word}
    </span>
  )
  return (
    <>
      {items.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }} data-testid="their-call-board">
          {/* One square a fixture: where the revision stands, before a word is read. */}
          <div role="img" aria-label={`${board.counts.approved} approved, ${board.counts.sentBack} sent back, ${board.counts.waiting} waiting${board.counts.noProduct > 0 ? `, ${board.counts.noProduct} with no product yet` : ''}`} style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }} data-testid="their-call-cells">
            {board.cells.map((c) => (
              <span key={c.id} title={`${c.tag} · ${CELL[c.state].word}`} data-state={c.state} style={{ width: 22, height: 14, borderRadius: 3, boxSizing: 'border-box', background: CELL[c.state].background, border: CELL[c.state].border }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.2rem 1.1rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-base)', fontVariantNumeric: 'tabular-nums' }} data-testid="decisions-line">
            {count('approved')}
            {count('sentBack')}
            {count('waiting')}
            {board.counts.noProduct > 0 ? count('noProduct') : null}
          </div>
          <span style={smallMuted} data-testid="their-call-who">
            {board.allApproved ? allApprovedLine(board.counts.approved, items) : who || [sharedLine, 'No answers yet.'].filter(Boolean).join(' · ')}
          </span>
          {recordLine ? (
            <span style={smallMuted} data-testid="their-call-record-line">
              {recordLine}
            </span>
          ) : null}
        </div>
      ) : null}

      {board.sentBack.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column' }} data-testid="their-call-sent-back">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ ...groupLabel, color: 'var(--text-red-700)' }}>Sent back · {board.sentBack.length} fixture{board.sentBack.length === 1 ? '' : 's'}, {board.sentBackParts} part{board.sentBackParts === 1 ? '' : 's'}</span>
            {canEdit ? <span style={smallMuted}>change these parts</span> : null}
          </div>
          {board.sentBack.map((r, i) => (
            <div key={r.item.id} className="sub-call-row" style={{ borderTop: i === 0 ? 'none' : '1px dotted var(--border)' }} data-testid="sent-back-row">
              <b style={{ gridArea: 'tag', fontSize: '0.8125rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{r.tag}</b>
              <span style={{ gridArea: 'parts', display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, fontSize: '0.8125rem' }}>
                {r.parts.map((p) => (
                  <span key={p.key} style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'baseline', minWidth: 0 }} data-testid="sent-back-part">
                    <span style={{ color: 'var(--text-strong)', fontWeight: 600, overflowWrap: 'anywhere' }}>{p.head}</span>
                    <b style={{ ...TONE[p.tone], fontSize: '0.7rem', fontWeight: 700, padding: '0.05rem 0.45rem', borderRadius: 999, whiteSpace: 'nowrap' }}>{p.word}</b>
                    {p.note ? <span style={{ ...smallMuted, overflowWrap: 'anywhere' }}>they wrote “{p.note}”</span> : null}
                  </span>
                ))}
              </span>
              {canEdit ? (
                <button type="button" aria-label={`Edit ${r.tag} to change what was sent back`} disabled={busy} onClick={() => onEdit(r.item)} style={{ ...btn, gridArea: 'edit', padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>
                  Edit
                </button>
              ) : null}
            </div>
          ))}
          {isNewest ? (
            <span style={smallMuted} data-testid="sent-back-next">
              {canEdit ? `When they are changed, start a Rev ${nextRev} draft in step 7.` : `These parts are locked on a shared version. Start a Rev ${nextRev} draft in step 7 to change them.`}
            </span>
          ) : null}
        </div>
      ) : null}

      {board.waiting.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }} data-testid="their-call-waiting">
          <span style={groupLabel}>Waiting on {reviewer} · {board.waiting.length} fixture{board.waiting.length === 1 ? '' : 's'}</span>
          <span style={smallMuted}>Got an answer by email? Press the fixture and type it in.</span>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {waitingShown.map((it) => {
              const tag = it.tag.trim() || 'Accessory'
              return (
                <button key={it.id} type="button" aria-label={`Type in their answer on ${tag}`} disabled={busy} onClick={() => onAnswer(it)} title="Record what the reviewer said about this fixture, part by part. Nobody is emailed." style={{ ...btn, padding: '0.15rem 0.6rem', fontSize: '0.75rem', borderRadius: 999 }} data-testid="waiting-fixture">
                  {tag}
                </button>
              )
            })}
            {board.waiting.length > waitingShown.length ? (
              <button type="button" onClick={() => setAllWaiting(true)} style={quietLink}>and {board.waiting.length - waitingShown.length} more</button>
            ) : null}
          </div>
          {approvable > 0 ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" disabled={busy} onClick={onApproveAll} style={btn} data-testid="approve-all-open" title="They said yes to all of them by email, on paper or before the room existed. One entry marks every fixture with no answer yet. You say who approved them and on what day.">
                Mark all {approvable} approved…
              </button>
              <span style={smallMuted}>{decisions.decided > 0 ? 'when they said yes to the rest in one go' : 'when they approved the whole submittal in one go'}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {board.noProduct.length > 0 ? (
        <span style={smallMuted} data-testid="their-call-no-product">
          {noProductWords(board.noProduct.map((it) => it.tag))}{' '}
          {board.noProduct.map((it) => (
            <button key={it.id} type="button" disabled={busy} onClick={() => onEdit(it)} style={{ ...quietLink, color: 'var(--text-link)', marginRight: '0.5rem' }}>
              {board.noProduct.length === 1 ? 'Add the product' : `Add ${it.tag.trim() || 'it'}`}
            </button>
          ))}
        </span>
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

      {/* Quiet at the foot: the reviewer's own file, the answers as text, and the messages and history. */}
      {showDropFile || decisions.decided > 0 || room ? (
        <div style={{ display: 'flex', gap: '0.3rem 1rem', flexWrap: 'wrap', alignItems: 'baseline', borderTop: '1px solid var(--border)', paddingTop: '0.45rem' }} data-testid="their-call-foot">
          {room ? (
            <button type="button" aria-expanded={threadOpen} onClick={onToggleThread} style={quietLink} data-testid="thread-toggle">
              Messages and history · {summarizeThread(messages, ROOM_TZ)} {threadOpen ? '▴' : '▾'}
            </button>
          ) : null}
          {showDropFile ? (
            <button type="button" disabled={busy} onClick={onPickFile} style={quietLink} title="The architect marked up the PDF or answered by email. Keep their file here, then press a waiting fixture to type in what they said.">
              Drop a reviewer's file
            </button>
          ) : null}
          {decisions.decided > 0 ? (
            <button type="button" onClick={() => void navigator.clipboard.writeText(decisionsText()).then(() => showToast('Decisions copied as text.', 'success'), () => showToast('Could not copy.', 'error'))} style={quietLink}>
              Copy their decisions as text
            </button>
          ) : null}
        </div>
      ) : null}
      {room && threadOpen ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="room-thread-panel">
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
        </div>
      ) : null}
    </>
  )
}
