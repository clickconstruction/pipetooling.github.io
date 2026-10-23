import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { StagesStageBar } from '../jobs/StagesStageBar'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { parsePercentInput, percentDismissedWords, percentSavedWords, type PercentCompleteCard, type PercentCompleteList } from '../../lib/quickfill/percentComplete'

/**
 * Quickfill → "Percent complete" (v2.5764): one card per open job whose ticked stages
 * or paid money disagree with its % done. The card shows the job, the stage bar as
 * the Pipeline draws it, the paid share, the sentence that says what disagrees, a %
 * box pre-filled with the number the facts suggest, **Save** (the Pipeline box's
 * write, with the same activity note) and **Dismiss for one week** (shared by the
 * office). A save or a dismissal turns the card into a line with Undo; a save that
 * fails names the job and the reason on its own card and the rest stay workable.
 */

type DoneLine = { key: string; card: PercentCompleteCard; kind: 'saved' | 'dismissed'; words: string }

const cardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: '0.6rem 1.25rem',
  alignItems: 'start',
  padding: '0.75rem 0.9rem',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
}

const KIND_WORDS: Record<PercentCompleteCard['kind'], string> = {
  'paid-in-full': 'Paid in full',
  'nothing-done': 'Paid, nothing done',
  'behind-the-stages': 'Behind the stages',
  'behind-the-money': 'Behind the money',
}

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
  const [pctText, setPctText] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<DoneLine[]>([])

  const textFor = (card: PercentCompleteCard) => pctText[card.jobId] ?? String(card.suggestedPct)

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
    const error = errors[card.jobId]
    return (
      <div key={card.jobId} data-testid="percent-complete-card" style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Link to={`/jobs?tab=stages&stagesJob=${encodeURIComponent(card.jobId)}`} title="Open on the Pipeline" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none', minWidth: 0, overflowWrap: 'anywhere' }}>
              {card.label}
            </Link>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: 'var(--bg-amber-tint, var(--bg-subtle))', color: 'var(--text-amber-800)' }}>{KIND_WORDS[card.kind]}</span>
          </div>
          <StagesStageBar view={card.view} pctComplete={card.pct} compact />
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
            Suggested {card.suggestedPct}%, {card.suggestedWords}. Change it if the crew says otherwise.
          </div>
          {error ? (
            <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
              {error}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'stretch', minWidth: 150 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
            <input
              type="text"
              inputMode="numeric"
              aria-label={`% done for ${card.label}`}
              value={text}
              disabled={busy}
              onChange={(e) => setPctText((prev) => ({ ...prev, [card.jobId]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void run(card, 'save')
              }}
              style={{ width: 56, padding: '0.35rem 0.4rem', fontSize: '1rem', fontWeight: 600, textAlign: 'right', border: `1px solid ${typed == null ? 'var(--text-red-700)' : 'var(--border-strong)'}`, borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}
            />
            <span>% done</span>
          </label>
          <button
            type="button"
            disabled={busy || typed == null}
            onClick={() => void run(card, 'save')}
            style={{ font: 'inherit', fontSize: '0.875rem', fontWeight: 600, padding: '0.45rem 0.8rem', borderRadius: 6, border: 'none', background: busy || typed == null ? 'var(--bg-muted)' : '#3b82f6', color: busy || typed == null ? 'var(--text-muted)' : '#fff', cursor: busy || typed == null ? 'not-allowed' : 'pointer' }}
          >
            {busy ? 'Saving…' : typed == null ? 'Save' : `Save ${typed}%`}
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
    )
  }

  return (
    <div data-testid="quickfill-percent-complete">
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
        One card per open job whose ticked stages or paid money disagree with its % done. The box holds the number the facts suggest. Fix the number and press Save, or press Dismiss for one week. The office shares the list.
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
