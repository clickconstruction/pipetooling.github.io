/**
 * Extend good-through (v2.5992, punch list #206 PR 1): under *Waiting for customer* on a sent
 * estimate, the date the pricing is good through, three quick picks and the one press that moves it.
 * The press names the day. The parent calls the `extend_estimate_good_through` RPC, which keeps the
 * link the customer has: the hash never changes, only the dates move. Words and rules from
 * `lib/estimates/estimateGoodThroughExtend.ts`.
 */
import { useEffect, useId, useState, type CSSProperties } from 'react'
import {
  EXTEND_PRESETS,
  EXTEND_WORDS,
  extendButtonLabel,
  extendDateProblem,
  extendDateProblemWords,
  extendLeadWords,
  extendPresetMatching,
  extendPresetYmd,
  goodThroughState,
} from '../../lib/estimates/estimateGoodThroughExtend'

export type EstimateExtendGoodThroughPanelProps = {
  /** `estimates.valid_until` as the row holds it. */
  validUntil: string | null
  /** Today in the company's calendar (YYYY-MM-DD). */
  todayYmd: string
  busy: boolean
  onExtend: (ymd: string) => void
  style?: CSSProperties
}

const presetStyle = (on: boolean): CSSProperties => ({
  font: 'inherit',
  fontSize: '0.78rem',
  fontWeight: on ? 600 : 500,
  padding: '0.25rem 0.6rem',
  borderRadius: 999,
  border: on ? 'none' : '1px solid var(--border-strong)',
  background: on ? '#ea580c' : 'var(--bg-muted)',
  color: on ? 'white' : 'var(--text-700)',
  cursor: 'pointer',
})

export default function EstimateExtendGoodThroughPanel({ validUntil, todayYmd, busy, onExtend, style }: EstimateExtendGoodThroughPanelProps) {
  const [ymd, setYmd] = useState(() => extendPresetYmd(30))
  const dateId = useId()
  // A different row (or its date moved): the field starts again at +30 days.
  useEffect(() => {
    setYmd(extendPresetYmd(30))
  }, [validUntil])
  const state = goodThroughState(validUntil, todayYmd)
  const problem = extendDateProblem(ymd, todayYmd, validUntil)
  const preset = extendPresetMatching(ymd)
  return (
    <div
      style={{
        marginTop: '0.75rem',
        padding: '0.65rem 0.8rem',
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--bg-muted)',
        maxWidth: 'min(560px, 100%)',
        boxSizing: 'border-box',
        ...style,
      }}
      data-testid="estimate-extend-good-through"
    >
      <p style={{ margin: 0, fontSize: '0.85rem', color: state.kind === 'passed' ? 'var(--text-amber-800)' : 'var(--text-700)' }} data-testid="estimate-extend-lead">
        {extendLeadWords(validUntil, todayYmd)}
      </p>
      <label htmlFor={dateId} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-700)', margin: '0.55rem 0 0.25rem' }}>
        {EXTEND_WORDS.label}
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
        <input
          id={dateId}
          type="date"
          value={ymd}
          min={todayYmd}
          onChange={(e) => setYmd(e.target.value)}
          disabled={busy}
          style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)' }}
        />
        {EXTEND_PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            aria-pressed={preset === p.days}
            disabled={busy}
            onClick={() => setYmd(extendPresetYmd(p.days))}
            style={presetStyle(preset === p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {problem ? (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-amber-800)' }} data-testid="estimate-extend-problem">
          {extendDateProblemWords(problem)}
        </p>
      ) : null}
      <div style={{ marginTop: '0.55rem' }}>
        <button
          type="button"
          onClick={() => onExtend(ymd)}
          disabled={busy || problem !== null}
          style={{
            padding: '0.35rem 0.65rem',
            fontSize: '0.8125rem',
            fontWeight: 500,
            border: 'none',
            borderRadius: 4,
            background: busy || problem !== null ? '#9ca3af' : '#3b82f6',
            color: 'white',
            cursor: busy || problem !== null ? 'not-allowed' : 'pointer',
          }}
          title="Moves the good-through date. The link the customer has keeps working through the new day."
        >
          {busy ? EXTEND_WORDS.busy : extendButtonLabel(ymd)}
        </button>
      </div>
    </div>
  )
}
