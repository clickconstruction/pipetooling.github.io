import { useMemo, useState, type CSSProperties } from 'react'

import {
  bidTabNoteLine,
  bidTabRangePosition,
  bidTabSummary,
  deriveBidTabInsight,
  hasAnyBidTabValue,
  parseBidTabCapture,
  type BidTabValues,
} from '../../lib/bidTabCapture'

const fieldLabelStyle: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }
const fieldInputStyle: CSSProperties = {
  padding: '0.35rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  fontSize: '0.8125rem',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  font: 'inherit',
  fontVariantNumeric: 'tabular-nums',
}

function moneyFieldText(n: number | null): string {
  return n != null ? String(n) : ''
}

export type BidTabCapturePanelProps = {
  /** Our own `bids.bid_value` — the insight line derives % over the low from it. */
  ourValue: number
  initial: BidTabValues
  saving: boolean
  onSave: (values: BidTabValues, noteLine: string) => void
  /** Secondary action — "Log without numbers" in call mode, "Cancel" when editing. */
  secondaryLabel: string
  onSecondary: () => void
  /** Clears the recorded tab (rendered only while editing an existing one). Quiet data fix — no history note. */
  onRemove?: () => void
}

/**
 * The bid-tab capture fields (v2.2081): low, high, "#N from the bottom, of M".
 * Phrased the way a GC reads a tab on the phone; every field optional. Shared
 * by the Waiting to hear "Bid tab received" flow and the Why we lost lens.
 */
export function BidTabCapturePanel({ ourValue, initial, saving, onSave, secondaryLabel, onSecondary, onRemove }: BidTabCapturePanelProps) {
  const [lowText, setLowText] = useState(() => moneyFieldText(initial.low))
  const [highText, setHighText] = useState(() => moneyFieldText(initial.high))
  const [rankText, setRankText] = useState(() => moneyFieldText(initial.rankFromLow))
  const [countText, setCountText] = useState(() => moneyFieldText(initial.bidderCount))

  const parsed = useMemo(
    () => parseBidTabCapture({ lowText, highText, rankText, countText }),
    [lowText, highText, rankText, countText],
  )
  const insight = useMemo(
    () => (parsed.errors.length === 0 ? deriveBidTabInsight(parsed.values, ourValue) : null),
    [parsed, ourValue],
  )

  const canSave = parsed.errors.length === 0 && hasAnyBidTabValue(parsed.values)

  return (
    <div
      style={{
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: '0.65rem 0.8rem',
        marginBottom: '0.6rem',
      }}
    >
      <p style={{ margin: '0 0 0.45rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        The bid tab — as the GC reads it
      </p>
      <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={fieldLabelStyle}>Low bid</span>
          <input
            type="text"
            inputMode="decimal"
            value={lowText}
            onChange={(e) => setLowText(e.target.value)}
            placeholder="230k"
            style={{ ...fieldInputStyle, width: '6.5rem' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={fieldLabelStyle}>High bid</span>
          <input
            type="text"
            inputMode="decimal"
            value={highText}
            onChange={(e) => setHighText(e.target.value)}
            placeholder="310k"
            style={{ ...fieldInputStyle, width: '6.5rem' }}
          />
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={fieldLabelStyle}>We were #</span>
            <input
              type="text"
              inputMode="numeric"
              value={rankText}
              onChange={(e) => setRankText(e.target.value)}
              placeholder="2"
              style={{ ...fieldInputStyle, width: '3rem' }}
            />
          </label>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', paddingBottom: '0.42rem' }}>from the bottom, of</span>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={fieldLabelStyle}>bids on the tab</span>
            <input
              type="text"
              inputMode="numeric"
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              placeholder="6"
              style={{ ...fieldInputStyle, width: '3rem' }}
            />
          </label>
        </div>
      </div>
      {parsed.errors.length > 0 ? (
        <p style={{ margin: '0.55rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-800)' }}>{parsed.errors[0]}</p>
      ) : insight ? (
        <p style={{ margin: '0.55rem 0 0', fontSize: '0.8125rem', color: insight.tone === 'warn' ? 'var(--text-amber-800)' : 'var(--text-emerald-800)' }}>
          {insight.line}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', alignItems: 'center' }}>
        <button
          type="button"
          disabled={saving || !canSave}
          onClick={() => onSave(parsed.values, bidTabNoteLine(parsed.values, ourValue))}
          style={{
            padding: '0.35rem 0.8rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            border: 'none',
            borderRadius: 6,
            background: '#3b82f6',
            color: '#fff',
            cursor: saving || !canSave ? 'not-allowed' : 'pointer',
            opacity: saving || !canSave ? 0.55 : 1,
            font: 'inherit',
          }}
        >
          {saving ? 'Saving…' : 'Save bid tab'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onSecondary}
          style={{
            padding: '0.35rem 0.7rem',
            fontSize: '0.8125rem',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          {secondaryLabel}
        </button>
        {onRemove && hasAnyBidTabValue(initial) ? (
          <button
            type="button"
            disabled={saving}
            onClick={onRemove}
            title="Clear the recorded bid tab from this bid"
            style={{
              marginLeft: 'auto',
              padding: '0.35rem 0.7rem',
              fontSize: '0.75rem',
              border: 'none',
              background: 'none',
              color: 'var(--text-red-800)',
              textDecoration: 'underline',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            Remove bid tab
          </button>
        ) : null}
      </div>
    </div>
  )
}

export type BidTabRecordedLineProps = {
  values: BidTabValues
  ourValue: number
  onEdit: () => void
}

/** The recorded tab as one line + a low→high range strip (amber dot = us). */
export function BidTabRecordedLine({ values, ourValue, onEdit }: BidTabRecordedLineProps) {
  const summary = bidTabSummary(values, ourValue)
  if (!summary) return null
  const pos = bidTabRangePosition(values, ourValue)
  return (
    <div style={{ margin: '0.35rem 0 0' }}>
      <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '0.1rem 0.5rem',
            borderRadius: 999,
            background: 'var(--bg-emerald-tint)',
            color: 'var(--text-emerald-800)',
            letterSpacing: '0.03em',
          }}
        >
          BID TAB
        </span>
        <span style={{ color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>{summary}</span>
        <button
          type="button"
          onClick={onEdit}
          style={{
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text-link)',
            textDecoration: 'underline',
            font: 'inherit',
            fontSize: '0.75rem',
          }}
        >
          edit
        </button>
      </p>
      {pos != null ? (
        <div style={{ position: 'relative', height: 14, maxWidth: '20rem', margin: '0.4rem 0 0' }}>
          <div style={{ position: 'absolute', top: 5, left: 0, width: '100%', height: 6, borderRadius: 999, background: 'var(--bg-muted)' }} />
          <span style={{ position: 'absolute', top: 3, left: 0, width: 9, height: 9, borderRadius: 999, background: 'var(--text-green-600)' }} title="Low bid" />
          <span style={{ position: 'absolute', top: 3, right: 0, width: 9, height: 9, borderRadius: 999, background: 'var(--text-muted)' }} title="High bid" />
          <span
            style={{ position: 'absolute', top: 3, transform: 'translateX(-50%)', left: `${pos}%`, width: 9, height: 9, borderRadius: 999, background: 'var(--text-amber-700)', boxShadow: '0 0 0 2px var(--surface)' }}
            title="Our bid"
          />
        </div>
      ) : null}
    </div>
  )
}
