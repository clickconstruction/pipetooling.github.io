import type { CSSProperties, ReactNode } from 'react'
import type { GcReviewGroup } from '../../lib/gcReviewRollup'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { GC_STAGE_WAITING_ON, gcWorklistAtStage, type GcStageKey } from '../../lib/jobs/gcReviewStages'
import { GC_ROUND_THRESHOLD, isTemperature, sendChannelLabel } from '../../lib/jobs/gcStatementRounds'
import { payPromiseLabel } from '../../lib/jobs/payPromise'
import { underLineCount, worklistGroupTitle, type GcWorklist, type GcWorklistGroup, type GcWorklistRow } from '../../lib/jobs/gcWorklist'
import GcReviewRow from './GcReviewRow'
import { TEMP_PILL } from './GcTemperatureBoard'
import { GC_STATEMENT_UNCHECKED_WORDS } from '../../../supabase/functions/_shared/gcStatementGate'

export type GcWorklistLastWord = { temperature: string | null; at: string | null; by: string; note: string | null }

type Props = {
  worklist: GcWorklist
  /** The stage the track is narrowed to; null = every GC. */
  stage?: GcStageKey | null
  onClearStage?: () => void
  /** The signed-in user — their own accounts read "Your accounts". */
  authUserId: string | null
  userNameById: (id: string | null) => string
  /** Office roles act; everyone else reads. */
  canAct: boolean
  busy: boolean
  error: string | null
  /** The newest read on record per GC, beside the name. */
  lastWordByGc: ReadonlyMap<string, GcWorklistLastWord>
  /** The GC's statement as the screen shows it (Include Collections and all) — what the row says is owed. */
  statementByGc?: ReadonlyMap<string, GcReviewGroup>
  /** Open rows, by GC. */
  expanded?: ReadonlySet<string>
  onToggle?: (row: GcWorklistRow) => void
  /** The opened row's statement: chips, Share, the bills. */
  renderDetail?: (row: GcWorklistRow) => ReactNode
  /** People who may be a GC's account man. */
  assignableUsers: ReadonlyArray<{ id: string; name: string }>
  assigningGcId: string | null
  onStartAssign: (gcId: string) => void
  onAssign: (gcId: string, userId: string | null) => void
  onCancelAssign: () => void
  onCheck: (row: GcWorklistRow) => void
  onSend: (row: GcWorklistRow) => void
  /** Record a statement that went out another way — a text, their own inbox, in person. */
  onMarkSent: (row: GcWorklistRow) => void
  onWord: (row: GcWorklistRow) => void
  onUndoMark: (row: GcWorklistRow) => void
  onOpenHistory: (row: GcWorklistRow) => void
  /** One account man's GCs on one sheet — one call, one save. */
  onOpenCallSheet: (group: GcWorklistGroup) => void
  /** Ask by link: send the account man a no-login link instead of calling. Omitted = not offered. */
  onAskByLink?: (group: GcWorklistGroup) => void
  /** Per account man: where his link stands, and how many of his answers wait on the office. */
  askByOwner?: ReadonlyMap<string, { statusLine: string; pending: number }>
  /** Open the call sheet on his answers, to read and save. */
  onReviewAnswers?: (group: GcWorklistGroup) => void
}

const linkStyle: CSSProperties = { font: 'inherit', fontSize: '0.75rem', border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer' }
const nextButton: CSSProperties = { font: 'inherit', fontSize: '0.75rem', fontWeight: 700, width: '100%', padding: '0.25rem 0.4rem', borderRadius: 4, border: '1px solid #2563eb', background: '#2563eb', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' }
const recheckButton: CSSProperties = { ...nextButton, border: '1px solid #f59e0b', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0 0.45rem', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 9999, whiteSpace: 'nowrap', flex: 'none' }

const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short' })
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

type StepState = 'done' | 'next' | 'todo' | 'again' | 'locked'
const STEP_STATE_WORDS: Record<StepState, string> = { done: 'done', next: 'next', todo: 'to do', again: 'check again', locked: 'after the check' }

/** One dot of a GC's three: green behind it, blue where it is, grey ahead. A dot with a door is a button. */
function Step({ step, state, label, title, optional, onClick }: { step: string; state: StepState; label: string; title?: string; optional?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <i aria-hidden>{state === 'done' ? '✓' : state === 'again' ? '!' : ''}</i>
      <em>{label}</em>
    </>
  )
  const common = { className: 'gcStep', 'data-state': state, 'data-optional': optional ? 'yes' : undefined, title }
  return onClick ? (
    <button type="button" {...common} aria-label={`${step} step: ${STEP_STATE_WORDS[state]}`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <span {...common}>{body}</span>
  )
}

/**
 * The week's GCs as one list (GC Review): every GC is the office's to work,
 * whoever knows the account, grouped by the account man to ask. A row is the
 * GC's balance, its three steps as one line, the next thing to do — and its
 * statement folded inside. Each step opens the window that already does it:
 * Certify, Draft Message, the mark form. Presentational: the modal owns the
 * data and the writes; the stage filter comes from the track above.
 */
export default function GcWorklistPanel({
  worklist,
  stage = null,
  onClearStage,
  authUserId,
  userNameById,
  canAct,
  busy,
  error,
  lastWordByGc,
  statementByGc,
  expanded,
  onToggle,
  renderDetail,
  assignableUsers,
  assigningGcId,
  onStartAssign,
  onAssign,
  onCancelAssign,
  onCheck,
  onSend,
  onMarkSent,
  onWord,
  onUndoMark,
  onOpenHistory,
  onOpenCallSheet,
  onAskByLink,
  askByOwner,
  onReviewAnswers,
}: Props) {
  if (worklist.groups.length === 0) return null

  const groupTitle = (g: GcWorklistGroup) => worklistGroupTitle(g, userNameById(g.ownerUserId), g.ownerUserId != null && g.ownerUserId === authUserId)
  const owed = (r: GcWorklistRow) => statementByGc?.get(r.gcId)?.subtotal ?? r.amount
  const at = gcWorklistAtStage(worklist, stage)
  const shownTotal = at.groups.reduce((t, g) => t + g.rows.reduce((n, r) => n + owed(r), 0), 0)
  /** Whole-group facts read from the worklist itself, so a filtered group still says what it holds. */
  const wholeGroup = new Map(worklist.groups.map((g) => [g.key, g] as const))

  const steps = (r: GcWorklistRow) => {
    const checkStep =
      r.checked === 'done' ? (
        <Step step="Check" state="done" label="Checked" title="The bills were checked and signed off this week" />
      ) : r.checked === 'changed' ? (
        <Step step="Check" state="again" label="Re-check" title={`A bill landed or a payment posted after ${r.gcName} was checked — check it again`} onClick={canAct ? () => onCheck(r) : undefined} />
      ) : (
        <Step step="Check" state={r.next === 'check' ? 'next' : 'todo'} label="Check" title={`Check each of ${r.gcName}’s bills and sign off`} onClick={canAct ? () => onCheck(r) : undefined} />
      )
    const sendStep = r.sent ? (
      <Step
        step="Send"
        state="done"
        label={r.mark?.action === 'sent' ? `Sent ${shortDay(r.mark.acted_at)}` : 'Sent'}
        title={`${r.mark?.action === 'sent' ? `${sendChannelLabel(r.mark.channel)} · ` : ''}See every statement sent to ${r.gcName}`}
        onClick={() => onOpenHistory(r)}
      />
    ) : r.checked !== 'done' ? (
      <Step step="Send" state="locked" label="Send" title={GC_STATEMENT_UNCHECKED_WORDS} />
    ) : (
      <Step step="Send" state="next" label="Send" title={`Draft ${r.gcName}’s statement — nothing sends until you press Send statement`} onClick={canAct ? () => onSend(r) : undefined} />
    )
    const wordStep = r.word ? (
      <Step step="Word" state="done" label={r.mark?.temperature ? `${r.mark.temperature}` : 'Word in'} title={r.mark?.note?.trim() || 'The word is in for this week'} onClick={() => onOpenHistory(r)} />
    ) : (
      <Step
        step="Word"
        state={r.next === 'word' ? 'next' : 'todo'}
        label={r.overLine ? 'Word' : 'optional'}
        optional={!r.overLine}
        title={r.overLine ? `Write down where ${r.gcName} stands — their temperature, a sentence, the date they said they’d pay` : `Optional under the line — write down where ${r.gcName} stands`}
        onClick={canAct ? () => onWord(r) : undefined}
      />
    )
    return (
      <span className="gcSteps" aria-label={r.next ? `Next: ${r.next}` : 'Done for the week'}>
        {checkStep}
        <span className="gcStepLine" data-done={r.checked === 'done' ? 'yes' : undefined} aria-hidden />
        {sendStep}
        <span className="gcStepLine" data-done={r.sent ? 'yes' : undefined} aria-hidden />
        {wordStep}
      </span>
    )
  }

  const action = (r: GcWorklistRow) => {
    if (r.skipped) return <span className="gcReviewRowQuiet">skipped this week</span>
    if (!r.next) return <span className="gcReviewRowDone">✓ Done</span>
    if (!canAct) return null
    if (r.next === 'check') {
      return r.checked === 'changed' ? (
        <button type="button" style={recheckButton} onClick={() => onCheck(r)} title={`A bill landed or a payment posted after ${r.gcName} was checked — check it again`}>
          Re-check
        </button>
      ) : (
        <button type="button" style={nextButton} onClick={() => onCheck(r)} title={`Check each of ${r.gcName}’s bills and sign off`}>
          Check bills
        </button>
      )
    }
    if (r.next === 'send') {
      return (
        <button type="button" style={nextButton} onClick={() => onSend(r)} title={`Draft ${r.gcName}’s statement — nothing sends until you press Send statement`}>
          Send
        </button>
      )
    }
    return (
      <button type="button" style={nextButton} onClick={() => onWord(r)} title={`Write down where ${r.gcName} stands — their temperature, a sentence, the date they said they’d pay`}>
        Get the word
      </button>
    )
  }

  /** The opened row's own line: the account man, the other way a statement goes out, undo. */
  const rowLinks = (r: GcWorklistRow) => {
    const assign =
      assigningGcId === r.gcId ? (
        <select
          autoFocus
          aria-label={`Account man for ${r.gcName}`}
          defaultValue={r.ownerUserId ?? ''}
          onChange={(e) => onAssign(r.gcId, e.target.value || null)}
          onBlur={onCancelAssign}
          style={{ font: 'inherit', fontSize: '0.75rem', padding: '0.1rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }}
        >
          <option value="">nobody</option>
          {assignableUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      ) : (
        <span>
          account man: {r.ownerUserId ? userNameById(r.ownerUserId) : 'nobody yet'}
          {r.ownerSource === 'leader' ? ' (the leader, by default)' : ''}
          {canAct ? (
            <>
              {' · '}
              <button type="button" onClick={() => onStartAssign(r.gcId)} style={linkStyle} title={`Change who knows the ${r.gcName} account`}>
                {r.ownerUserId && r.ownerSource !== 'leader' ? 'change account man' : 'pick an account man'}
              </button>
            </>
          ) : null}
        </span>
      )
    const markSent =
      canAct && !r.skipped && !r.sent && r.checked === 'done' ? (
        <button type="button" onClick={() => onMarkSent(r)} style={linkStyle} title="It went out another way — a text, your own inbox, in person">
          or mark sent
        </button>
      ) : null
    const undo =
      r.mark && canAct ? (
        <button type="button" disabled={busy} onClick={() => onUndoMark(r)} style={linkStyle} title={`Clear this week’s mark for ${r.gcName} — the statement and the word both go back to “to do”`}>
          undo
        </button>
      ) : null
    if (!assign && !markSent && !undo) return null
    return (
      <div className="gcReviewRowLinks">
        {assign}
        {markSent}
        {undo}
      </div>
    )
  }

  return (
    <div className="gcWorklist">
      {worklist.counts.late > 0 ? (
        <p className="gcWorklistLate">
          <b>
            {worklist.counts.late} broken promise{worklist.counts.late === 1 ? '' : 's'}
          </b>{' '}
          — the date they gave has passed and they still owe. They come first.
        </p>
      ) : null}
      {stage ? (
        <div className="gcStageFilterLine" role="status">
          <span>
            <b>
              {at.shown} of {at.of}
            </b>{' '}
            GC{at.of === 1 ? '' : 's'} — {GC_STAGE_WAITING_ON[stage]}
            {at.shown > 0 ? ` · $${formatCurrency(shownTotal)}` : ''}
          </span>
          {onClearStage ? (
            <button type="button" onClick={onClearStage} style={{ ...linkStyle, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>
              Show all {at.of}
            </button>
          ) : null}
        </div>
      ) : null}
      {at.groups.map((g) => {
        const whole = wholeGroup.get(g.key) ?? g
        return (
          <div key={g.key}>
            <div className="gcWorklistGroup">
              <b>{groupTitle(g)}</b>
              <span style={{ color: 'var(--text-muted)' }}>
                · {whole.rows.length} GC{whole.rows.length === 1 ? '' : 's'} · ${formatCurrency(whole.rows.reduce((t, r) => t + owed(r), 0))}
                {underLineCount(whole) > 0 ? ` · ${underLineCount(whole)} under $${GC_ROUND_THRESHOLD.toLocaleString('en-US')}, word optional` : ''}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: whole.open === 0 ? 'var(--text-green-800)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {whole.open === 0 ? 'all done ✓' : `${whole.open} to do`}
              </span>
              {(() => {
                // Ask by link: only for someone else's accounts — your own you answer yourself.
                // A link or a call sheet asks for words — a group with only under-the-line rows has none owed.
                if (!canAct || !g.ownerUserId || g.ownerUserId === authUserId || !whole.rows.some((r) => r.overLine)) return null
                const ask = askByOwner?.get(g.ownerUserId)
                const first = userNameById(g.ownerUserId).split(/\s+/)[0]
                return (
                  <>
                    {ask && ask.pending > 0 && onReviewAnswers ? (
                      <button
                        type="button"
                        onClick={() => onReviewAnswers(whole)}
                        title={`${first} answered on his link — read his answers and save them`}
                        style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 700, padding: '0.12rem 0.6rem', borderRadius: 4, border: '1px solid var(--text-green-600)', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {first} answered {ask.pending} — review
                      </button>
                    ) : null}
                    {onAskByLink ? (
                      <button
                        type="button"
                        onClick={() => onAskByLink(whole)}
                        title={ask ? `${first}’s link: ${ask.statusLine}` : `Send ${first} a link instead of calling — he answers from his phone, no sign-in`}
                        style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 700, padding: '0.12rem 0.6rem', borderRadius: 4, border: '1px solid var(--border-blue)', background: 'var(--surface)', color: 'var(--text-blue-700)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        <span aria-hidden>🔗</span> {ask ? 'His link' : 'Ask by link'}
                      </button>
                    ) : null}
                  </>
                )
              })()}
              {canAct && whole.rows.some((r) => r.overLine) ? (
                <button
                  type="button"
                  onClick={() => onOpenCallSheet(whole)}
                  title={g.ownerUserId != null && g.ownerUserId !== authUserId ? `One call to ${userNameById(g.ownerUserId)} — fill in every GC’s word on one sheet` : 'Fill in every GC’s word on one sheet'}
                  style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 700, padding: '0.12rem 0.6rem', borderRadius: 4, border: '1px solid var(--border-blue)', background: 'var(--surface)', color: 'var(--text-blue-700)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <span aria-hidden>📞</span> Call sheet
                </button>
              ) : null}
            </div>
            {g.rows.map((r) => {
              const last = lastWordByGc.get(r.gcId)
              const statement = statementByGc?.get(r.gcId)
              const jobs = statement?.jobCount ?? r.jobCount
              const oldest = statement?.oldestAgeDays ?? r.oldestAgeDays
              const temp = last?.temperature && isTemperature(last.temperature) ? TEMP_PILL[last.temperature] : null
              return (
                <GcReviewRow
                  key={r.gcId}
                  testId="gc-worklist-row"
                  late={r.promise?.late}
                  expanded={expanded?.has(r.gcId) ?? false}
                  onToggle={() => onToggle?.(r)}
                  toggleName={r.gcName}
                  name={
                    <>
                      <b>{r.gcName}</b>
                      {last?.temperature && last.at ? (
                        <span
                          style={{ ...chip, background: temp?.bg ?? 'var(--bg-subtle)', color: temp?.fg ?? 'var(--text-muted)' }}
                          title={`Last word: ${last.temperature}, ${shortDate(last.at)}${last.by ? ` — ${last.by}` : ''}${last.note ? `\n${last.note}` : ''}`}
                        >
                          {last.temperature} · {shortDate(last.at)}
                        </span>
                      ) : r.overLine ? (
                        <span style={{ ...chip, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>no word yet</span>
                      ) : null}
                    </>
                  }
                  meta={
                    <>
                      ${formatCurrency(owed(r))} · {jobs} job{jobs === 1 ? '' : 's'}
                      {oldest != null ? ` · oldest ${oldest}d` : ''}
                      {r.promise ? (
                        <>
                          {' · '}
                          <span style={r.promise.late ? { color: 'var(--text-red-700)', fontWeight: 700 } : undefined}>{payPromiseLabel(r.promise)}</span>
                        </>
                      ) : null}
                    </>
                  }
                  steps={r.skipped ? undefined : steps(r)}
                  action={action(r)}
                >
                  {rowLinks(r)}
                  {renderDetail?.(r)}
                </GcReviewRow>
              )
            })}
          </div>
        )
      })}
      {stage && at.shown === 0 ? <p className="gcWorklistEmpty">No GC is {GC_STAGE_WAITING_ON[stage]}.</p> : null}
      <p style={{ margin: '0.6rem 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
        A statement never goes out unchecked — a group that changes after sign-off asks for a re-check. Every GC files under the
        account man who knows them, the leader by default, so one call covers the group and nothing is nobody's. Under $
        {GC_ROUND_THRESHOLD.toLocaleString('en-US')} the word is optional.
      </p>
      {error ? <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{error}</p> : null}
    </div>
  )
}
