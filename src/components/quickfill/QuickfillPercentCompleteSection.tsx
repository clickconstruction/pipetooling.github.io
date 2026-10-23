import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { parsePercentInput, percentDismissedWords, percentMove, percentSavedWords, type PercentCompleteCard, type PercentCompleteList } from '../../lib/quickfill/percentComplete'
import { QuickfillPercentBarSlider } from './QuickfillPercentBarSlider'

/**
 * Quickfill → "Percent complete" (v2.5764): one card per open job whose ticked stages
 * or paid money disagree with its % done. The card shows the job, the stage bar as
 * the Pipeline draws it, the paid share, the sentence that says what disagrees, and
 * the ways to set the number (v2.5805, punch list #154): the bar itself is the slider
 * (a blue knob at the number about to be saved, the dark tick where the job is today),
 * one chip per stage end and one for the paid share as stops, a % box for an exact
 * number, and a line that reads the move. **Save** (the Pipeline box's write, with the
 * same activity note) names the number and goes dead on no change; **Dismiss for one
 * week** is shared by the office. A save or a dismissal turns the card into a line with
 * Undo; a save that fails names the job and the reason on its own card and the rest
 * stay workable.
 */

type DoneLine = { key: string; card: PercentCompleteCard; kind: 'saved' | 'dismissed'; words: string }

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.45rem',
  padding: '0.75rem 0.9rem',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
  minWidth: 0,
}

const KIND_WORDS: Record<PercentCompleteCard['kind'], string> = {
  'paid-in-full': 'Paid in full',
  'nothing-done': 'Paid, nothing done',
  'behind-the-stages': 'Behind the stages',
  'behind-the-money': 'Behind the money',
}

const stopStyle = (pressed: boolean, busy: boolean): CSSProperties => ({
  font: 'inherit',
  fontSize: '0.78125rem',
  fontWeight: 600,
  padding: '4px 10px',
  borderRadius: 999,
  border: `1px solid ${pressed ? '#2563eb' : 'var(--border-strong)'}`,
  background: pressed ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: pressed ? 'var(--text-blue-700)' : 'var(--text-700)',
  cursor: busy ? 'not-allowed' : 'pointer',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
})

export function QuickfillPercentCompleteSection({
  list,
  loading,
  snoozeAvailable,
  onSave,
  onUndoSave,
  onDismiss,
  onUndoDismiss,
}: {
  list: PercentCompleteList
  loading: boolean
  snoozeAvailable: boolean
  onSave: (card: PercentCompleteCard, pct: number) => Promise<void>
  onUndoSave: (card: PercentCompleteCard) => Promise<void>
  onDismiss: (card: PercentCompleteCard) => Promise<string>
  onUndoDismiss: (card: PercentCompleteCard) => Promise<void>
}) {
  const { showToast } = useToastContext()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  // The box's text and the knob's number, per job. A stop or the knob sets both; the box sets
  // the number only while it holds one, so a half-typed box never moves the knob.
  const [pctText, setPctText] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<DoneLine[]>([])

  const textFor = (card: PercentCompleteCard) => pctText[card.jobId] ?? String(card.suggestedPct)
  const draftFor = (card: PercentCompleteCard) => drafts[card.jobId] ?? card.suggestedPct
  const setDraft = (card: PercentCompleteCard, n: number) => {
    setDrafts((prev) => ({ ...prev, [card.jobId]: n }))
    setPctText((prev) => ({ ...prev, [card.jobId]: String(n) }))
  }
  const typeDraft = (card: PercentCompleteCard, text: string) => {
    setPctText((prev) => ({ ...prev, [card.jobId]: text }))
    const n = parsePercentInput(text)
    if (n != null) setDrafts((prev) => ({ ...prev, [card.jobId]: n }))
  }

  const run = async (card: PercentCompleteCard, what: 'save' | 'undo-save' | 'dismiss' | 'undo-dismiss') => {
    if (busyKey) return
    setBusyKey(card.jobId)
    setErrors((prev) => {
      const next = { ...prev }
      delete next[card.jobId]
      return next
    })
    try {
      if (what === 'save') {
        const pct = parsePercentInput(textFor(card))
        if (pct == null) throw new Error('Type a whole number from 0 to 100.')
        await onSave(card, pct)
        setDone((prev) => [{ key: card.jobId, card, kind: 'saved', words: percentSavedWords(card, pct) }, ...prev.filter((d) => d.key !== card.jobId)])
      } else if (what === 'dismiss') {
        if (!snoozeAvailable) throw new Error('Dismiss is not ready yet. The office’s dismiss list has not been set up on the server.')
        const until = await onDismiss(card)
        setDone((prev) => [{ key: card.jobId, card, kind: 'dismissed', words: percentDismissedWords(card, until) }, ...prev.filter((d) => d.key !== card.jobId)])
      } else if (what === 'undo-save') {
        await onUndoSave(card)
        setDone((prev) => prev.filter((d) => d.key !== card.jobId))
      } else {
        await onUndoDismiss(card)
        setDone((prev) => prev.filter((d) => d.key !== card.jobId))
      }
    } catch (e) {
      const reason = formatErrorMessage(e, what === 'dismiss' ? 'Could not dismiss' : what === 'save' ? 'Could not save the % done' : 'Could not undo')
      if (what === 'save' || what === 'dismiss') setErrors((prev) => ({ ...prev, [card.jobId]: `Could not ${what === 'save' ? 'save' : 'dismiss'} ${card.jobNumber}: ${reason}` }))
      else showToast(reason, 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const doneLine = (d: DoneLine) => {
    const saved = d.kind === 'saved'
    return (
      <div
        key={`done:${d.key}`}
        data-testid={saved ? 'percent-complete-saved' : 'percent-complete-dismissed'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.55rem 0.85rem',
          border: `1px solid ${saved ? 'var(--border-green)' : 'var(--border)'}`,
          borderRadius: 8,
          background: saved ? 'var(--bg-green-tint)' : 'var(--bg-subtle)',
          fontSize: '0.8125rem',
          color: saved ? 'var(--text-green-800)' : 'var(--text-muted)',
        }}
      >
        <span style={{ flex: '1 1 auto', minWidth: 0 }}>
          <strong>{d.card.label}</strong> · {d.words}
        </span>
        <button
          type="button"
          disabled={busyKey === d.key}
          onClick={() => void run(d.card, saved ? 'undo-save' : 'undo-dismiss')}
          style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'inherit', cursor: 'pointer' }}
        >
          Undo
        </button>
      </div>
    )
  }

  const cardView = (card: PercentCompleteCard) => {
    const busy = busyKey === card.jobId
    const text = textFor(card)
    const typed = parsePercentInput(text)
    const draft = draftFor(card)
    const move = percentMove(card.pct, draft)
    const error = errors[card.jobId]
    const canSave = !busy && typed != null && !move.same
    const moveColor = move.tone === 'up' ? 'var(--text-green-700)' : move.tone === 'down' ? 'var(--text-amber-800)' : 'var(--text-muted)'
    return (
      <div key={card.jobId} data-testid="percent-complete-card" style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link to={`/jobs?tab=stages&stagesJob=${encodeURIComponent(card.jobId)}`} title="Open on the Pipeline" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none', minWidth: 0, overflowWrap: 'anywhere' }}>
            {card.label}
          </Link>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: 'var(--bg-amber-tint, var(--bg-subtle))', color: 'var(--text-amber-800)' }}>{KIND_WORDS[card.kind]}</span>
        </div>
        <QuickfillPercentBarSlider view={card.view} pct={card.pct} draft={draft} onDraft={(n) => setDraft(card, n)} label={`% done knob for ${card.label}`} disabled={busy} />
        <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>
          <span>
            <strong>{card.pct == null ? 'No %' : `${card.pct}%`}</strong> done
          </span>
          {card.paidShare != null ? (
            <span>
              <strong style={{ color: 'var(--text-green-700)' }}>{card.paidShare}%</strong> paid
            </span>
          ) : null}
          {card.ticked.length > 0 ? (
            <span>
              <strong>{card.ticked.map((t) => t.short).join(' ✓ ')} ✓</strong>
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-strong)' }} data-testid="percent-complete-sentence">
          {card.sentence}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Suggested {card.suggestedPct}%, {card.suggestedWords}. Drag the knob, press a stage, or type.
        </div>
        {error ? (
          <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
            {error}
          </div>
        ) : null}
        <div data-testid="percent-complete-actions" style={{ display: 'flex', gap: '0.5rem 0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', marginTop: '0.1rem' }}>
          {card.stops.length > 0 ? (
            <div role="group" aria-label={`Stops for ${card.label}`} style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
              {card.stops.map((s) => (
                <button
                  key={`${s.kind}:${s.pct}`}
                  type="button"
                  aria-pressed={draft === s.pct}
                  disabled={busy}
                  title={s.kind === 'paid' ? `Set it to the paid share, ${s.pct}%` : `Set it to the end of ${s.label.replace(' ✓', '')}, ${s.pct}%`}
                  onClick={() => setDraft(card, s.pct)}
                  style={stopStyle(draft === s.pct, busy)}
                >
                  {s.words}
                </button>
              ))}
            </div>
          ) : null}
          {/* The move, the box, Save and Dismiss wrap as one unit under the stops when the row is short. */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', marginLeft: 'auto' }}>
            <span data-testid="percent-complete-move" style={{ fontSize: '0.8125rem', color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {move.same ? (
                <>
                  <strong>{move.from}</strong> <span style={{ color: moveColor }}>· no change</span>
                </>
              ) : (
                <>
                  {move.from} → <strong>{move.to}</strong>
                  {move.delta ? <strong style={{ color: moveColor, marginLeft: '0.35rem' }}>{move.delta}</strong> : null}
                </>
              )}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
              <input
                type="text"
                inputMode="numeric"
                aria-label={`% done for ${card.label}`}
                value={text}
                disabled={busy}
                onChange={(e) => typeDraft(card, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSave) void run(card, 'save')
                }}
                style={{ width: 56, padding: '0.35rem 0.4rem', fontSize: '1rem', fontWeight: 600, textAlign: 'right', border: `1px solid ${typed == null ? 'var(--text-red-700)' : 'var(--border-strong)'}`, borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}
              />
              <span>% done</span>
            </label>
            <button
              type="button"
              disabled={!canSave}
              title={move.same && typed != null ? 'The knob sits where the job already is.' : undefined}
              onClick={() => void run(card, 'save')}
              style={{ font: 'inherit', fontSize: '0.875rem', fontWeight: 600, padding: '0.45rem 0.8rem', borderRadius: 6, border: 'none', background: canSave ? '#3b82f6' : 'var(--bg-muted)', color: canSave ? '#fff' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'not-allowed' }}
            >
              {busy ? 'Saving…' : typed == null || move.same ? 'Save' : `Save ${typed}%`}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(card, 'dismiss')}
              title={snoozeAvailable ? 'Hide this job here until next week. The office shares the list.' : 'The dismiss list is not set up on the server yet.'}
              style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              Dismiss for one week
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="quickfill-percent-complete">
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
        One card per open job whose ticked stages or paid money disagree with its % done. The knob on the bar holds the number the facts suggest. Drag it, press a stage, or type a number, then press Save. Or press Dismiss for one week. The office shares the list.
      </p>
      {loading && list.cards.length === 0 ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</div> : null}
      {!loading ? (
        <div data-testid="percent-complete-line" style={{ fontSize: '0.875rem', fontWeight: 600, color: list.count === 0 ? 'var(--text-green-800)' : 'var(--text-strong)', margin: '0 0 0.6rem' }}>
          {list.line}
          {list.snoozedCount > 0 ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> {list.snoozedCount === 1 ? '1 job is dismissed' : `${list.snoozedCount} jobs are dismissed`} until next week.</span> : null}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {done.map(doneLine)}
        {list.cards.map(cardView)}
      </div>
    </div>
  )
}
