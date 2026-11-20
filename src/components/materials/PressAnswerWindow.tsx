/**
 * The window a dev answers presses in, opened from the By person look. Each press picked takes one
 * answer: **Take it back** (it did not happen or should not stand; every number then reads as if it
 * was never made), **Mark it as not allowed** (it happened; the numbers keep it), **Ask for a second
 * count**, or **Leave it**. The window shows what the take-backs would do to the numbers before
 * anything is written (`takeBackPlan`), asks for one reason, and its press names each act with its
 * count. It acts on what is clean and names what failed with its reason; a second count is one task
 * at a time, so more than one is said and left picked.
 *
 * `AnswerWithdrawWindow` is the way back: a press taken back stands again, or a mark comes off, with
 * its own reason. Nothing is deleted by either.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { Movement } from '../../lib/materials/onSite'
import { ANSWER_WORDS, answerPressWords, suggestedAnswer, takeBackPlan, type AnswerChoice, type LineChange } from '../../lib/materials/pressAnswers'
import { actStampWords, type PersonAct } from '../../lib/materials/sitePersonActs'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatErrorMessage } from '../../utils/errorHandling'

export type AnswerOutcome = {
  tookBack: number
  marked: number
  /** The presses whose answer was refused, each with the database's reason. */
  failed: Array<{ act: PersonAct; reason: string }>
  /** The count that was handed to the New task window, and how many more wait. */
  countAsked: PersonAct | null
  countsLeft: number
  /** The jobs whose ledger a take-back changed. */
  jobIds: string[]
}

type Props = {
  acts: ReadonlyArray<PersonAct>
  /** A job's ledger as the store holds it, for the numbers before and after. */
  movementsOf: (jobId: string) => ReadonlyArray<Movement>
  boxLabel: (containerId: string) => string
  give: (movementId: string, answer: 'taken_back' | 'marked', why: string) => Promise<void>
  /** Hands one count to the New task window. Absent where the app has none mounted. */
  askCount?: (act: PersonAct) => void
  onClose: () => void
  onDone: (outcome: AnswerOutcome) => void
}

const backdrop: CSSProperties = { position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }
const panel: CSSProperties = { background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, width: 'min(640px, 100%)', maxHeight: '100%', overflowY: 'auto', padding: '1rem 1.25rem 1.25rem', display: 'grid', gap: '0.75rem', alignContent: 'start', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const field: CSSProperties = { minHeight: 34, maxWidth: '100%', borderRadius: 6, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.85rem' }
const quiet: CSSProperties = { minHeight: 36, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, cursor: 'pointer' }
const go: CSSProperties = { minHeight: 36, padding: '0 0.9rem', borderRadius: 8, border: 'none', background: '#2563eb', color: '#ffffff', font: 'inherit', fontWeight: 600, cursor: 'pointer' }
const dead: CSSProperties = { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
const rowBox: CSSProperties = { display: 'grid', gap: '0.3rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }
const note: CSSProperties = { background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.5rem 0.65rem', fontSize: '0.8rem', color: 'var(--text-700)' }

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

function pressWords(a: PersonAct): string {
  return [a.what, a.part, a.qty].filter(Boolean).join(' · ')
}

/** When and where a press was made and by whom. The day and minute tell two presses that read alike apart. */
function pressWhereWords(a: PersonAct): string {
  return [actStampWords(a.at), a.where, a.who].filter(Boolean).join(' · ')
}

/** The press's own words under it, when it has any: its note, or the paper a delivery came on. */
function PressNote({ act }: { act: PersonAct }) {
  return act.note ? <span style={{ ...muted, fontStyle: 'italic' }}>Note: {act.note}</span> : null
}

const CHOICES: AnswerChoice[] = ['take_back', 'mark', 'second_count', 'leave']

export default function PressAnswerWindow({ acts, movementsOf, boxLabel, give, askCount, onClose, onDone }: Props) {
  useEscape(onClose)
  const [choice, setChoice] = useState<Record<string, AnswerChoice>>(() => Object.fromEntries(acts.map((a) => [a.id, suggestedAnswer(a.kind)])))
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)

  const of = (a: PersonAct): AnswerChoice => choice[a.id] ?? 'leave'
  const takeBacks = acts.filter((a) => of(a) === 'take_back')
  const marks = acts.filter((a) => of(a) === 'mark')
  const counts = acts.filter((a) => of(a) === 'second_count')

  // What the take-backs would do to the numbers, job by job: a line is one job's.
  const plan = useMemo(() => {
    const byJob = new Map<string, string[]>()
    for (const a of takeBacks) byJob.set(a.jobId, [...(byJob.get(a.jobId) ?? []), a.id])
    const changes: LineChange[] = []
    const noEffect = new Set<string>()
    for (const [jobId, ids] of byJob) {
      const p = takeBackPlan(movementsOf(jobId), ids)
      changes.push(...p.changes)
      for (const id of p.noEffect) noEffect.add(id)
    }
    return { changes, noEffect }
    // The picks decide the plan; the ledger does not move while the window is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeBacks.map((a) => a.id).join(',')])

  const writes = takeBacks.length + marks.length
  const label = answerPressWords({ takeBack: takeBacks.length, mark: marks.length, secondCount: counts.length })
  const needsWhy = writes > 0 && why.trim().length === 0
  const canGo = !busy && label != null && !needsWhy

  const run = async () => {
    if (!canGo) return
    setBusy(true)
    const failed: AnswerOutcome['failed'] = []
    let tookBack = 0
    let marked = 0
    const jobIds = new Set<string>()
    for (const a of takeBacks) {
      try {
        await give(a.id, 'taken_back', why)
        tookBack += 1
        jobIds.add(a.jobId)
      } catch (e) {
        failed.push({ act: a, reason: formatErrorMessage(e, 'The press was not taken back.') })
      }
    }
    for (const a of marks) {
      try {
        await give(a.id, 'marked', why)
        marked += 1
      } catch (e) {
        failed.push({ act: a, reason: formatErrorMessage(e, 'The press was not marked.') })
      }
    }
    const first = counts[0] ?? null
    setBusy(false)
    onDone({ tookBack, marked, failed, countAsked: first && askCount ? first : null, countsLeft: first && askCount ? counts.length - 1 : counts.length, jobIds: [...jobIds] })
    if (first && askCount) askCount(first)
  }

  return createPortal(
    <div style={backdrop} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Answer presses" style={panel} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Answer {acts.length === 1 ? '1 press' : `${acts.length.toLocaleString('en-US')} presses`}</h2>
        <div>
          {acts.map((a) => (
            <div key={a.id} style={rowBox} data-testid="answer-row">
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <strong>{pressWords(a)}</strong>
                <span style={muted}>{pressWhereWords(a)}</span>
                <PressNote act={a} />
              </div>
              <select aria-label={`Answer for ${pressWords(a)}, ${actStampWords(a.at)}`} value={of(a)} onChange={(e) => setChoice((c) => ({ ...c, [a.id]: e.target.value as AnswerChoice }))} style={field}>
                {CHOICES.map((c) => <option key={c} value={c}>{ANSWER_WORDS[c].pick}</option>)}
              </select>
              <span style={muted}>
                {ANSWER_WORDS[of(a)].does}
                {of(a) === 'take_back' && plan.noEffect.has(a.id) ? ' It moves no number by itself: a later count already reset its line.' : ''}
                {of(a) === 'second_count' && !askCount ? ' The New task window is not on this screen, so ask for it from the box.' : ''}
              </span>
            </div>
          ))}
        </div>

        {plan.changes.length > 0 ? (
          <div style={note} data-testid="answer-plan">
            <strong>What the numbers would read</strong>
            {plan.changes.map((c) => (
              <div key={`${c.containerId}:${c.partKey}`} style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
                <span>{c.partName} in {boxLabel(c.containerId)}</span>
                <span>{c.before.toLocaleString('en-US')} {'→'} <strong>{c.after.toLocaleString('en-US')}</strong></span>
              </div>
            ))}
          </div>
        ) : null}
        {counts.length > 1 && askCount ? <div style={note}>A second count is one task at a time. The first opens when you press, and the other {counts.length - 1 === 1 ? 'one stays' : `${counts.length - 1} stay`} picked.</div> : null}

        {writes > 0 ? (
          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Why (kept with each press)
            <textarea value={why} onChange={(e) => setWhy(e.target.value)} maxLength={500} rows={2} style={{ ...field, padding: '0.4rem 0.5rem', fontWeight: 400, resize: 'vertical' }} />
          </label>
        ) : null}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
          {needsWhy ? <span style={muted}>Say why first.</span> : null}
          <button type="button" style={quiet} onClick={onClose}>Cancel</button>
          <button type="button" style={{ ...go, ...(canGo ? {} : dead) }} disabled={!canGo} aria-disabled={!canGo} onClick={run}>
            {busy ? 'Working…' : label ?? 'Pick an answer'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

type WithdrawProps = {
  act: PersonAct
  withdraw: (answerId: string, why: string) => Promise<void>
  onClose: () => void
  /** The job whose ledger changed, or null when only a mark came off. */
  onDone: (jobId: string | null) => void
}

/** The way back from an answer: the press stands again, or the mark comes off. */
export function AnswerWithdrawWindow({ act, withdraw, onClose, onDone }: WithdrawProps) {
  useEscape(onClose)
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const answer = act.answer
  if (!answer) return null
  const takenBack = answer.answer === 'taken_back'
  const label = takenBack ? 'Let the press stand' : 'Take the mark off'
  const canGo = !busy && why.trim().length > 0
  const run = async () => {
    if (!canGo) return
    setBusy(true)
    setError(null)
    try {
      await withdraw(answer.id, why)
      onDone(takenBack ? act.jobId : null)
    } catch (e) {
      setError(formatErrorMessage(e, 'The answer was not withdrawn.'))
      setBusy(false)
    }
  }
  return createPortal(
    <div style={backdrop} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} style={{ ...panel, width: 'min(520px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{label}</h2>
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          <strong>{pressWords(act)}</strong>
          <span style={muted}>{pressWhereWords(act)}</span>
          <PressNote act={act} />
          <span style={muted}>{takenBack ? 'Taken back' : 'Marked as not allowed'} by {answer.byName || 'a dev'}: {answer.why}</span>
        </div>
        <div style={note}>{takenBack ? 'The press goes back into every number, as it was before it was taken back.' : 'The mark comes off. No number changes.'} The answer stays on record as withdrawn.</div>
        <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Why
          <textarea value={why} onChange={(e) => setWhy(e.target.value)} maxLength={500} rows={2} style={{ ...field, padding: '0.4rem 0.5rem', fontWeight: 400, resize: 'vertical' }} />
        </label>
        {error ? <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" style={quiet} onClick={onClose}>Cancel</button>
          <button type="button" style={{ ...go, ...(canGo ? {} : dead) }} disabled={!canGo} aria-disabled={!canGo} onClick={run}>{busy ? 'Working…' : label}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
