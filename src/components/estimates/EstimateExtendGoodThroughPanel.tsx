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
  /** The press: the day, and whether to email them the letter again with the same link (v2.5997). */
  onExtend: (ymd: string, emailAgain: boolean) => void
  /** The customer's address on the row; with none the tick is not offered. */
  emailTo?: string | null
  style?: CSSProperties
  /** The hash the Pipeline's good-through-passed chip lands on (v2.6037): the page scrolls here and hands the date field. */
  id?: string
}

export const EXTEND_EMAIL_AGAIN_WORDS = {
  tick: 'Email them the letter again, same link, with the new date',
  to: (email: string) => `It goes to ${email}.`,
} as const

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

export default function EstimateExtendGoodThroughPanel({ validUntil, todayYmd, busy, onExtend, emailTo = null, style, id }: EstimateExtendGoodThroughPanelProps) {
  const [ymd, setYmd] = useState(() => extendPresetYmd(30))
  const dateId = useId()
  const tickId = useId()
  const state = goodThroughState(validUntil, todayYmd)
  // The owner's call 4 of #206: ticked when the date had passed (they need telling), unticked while it is still good.
  const [emailAgain, setEmailAgain] = useState(state.kind === 'passed')
  // A different row (or its date moved): the field starts again at +30 days, and the tick follows the new state.
  useEffect(() => {
    setYmd(extendPresetYmd(30))
    setEmailAgain(goodThroughState(validUntil, todayYmd).kind === 'passed')
  }, [validUntil, todayYmd])
  const problem = extendDateProblem(ymd, todayYmd, validUntil)
  const preset = extendPresetMatching(ymd)
  return (
    <div
      id={id}
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
      {emailTo ? (
        <label htmlFor={tickId} style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start', marginTop: '0.55rem', fontSize: '0.85rem', color: 'var(--text-700)', cursor: 'pointer' }}>
          <input id={tickId} type="checkbox" checked={emailAgain} disabled={busy} onChange={(e) => setEmailAgain(e.target.checked)} style={{ marginTop: '0.2rem' }} data-testid="estimate-extend-email-again" />
          <span>
            {EXTEND_EMAIL_AGAIN_WORDS.tick} <span style={{ color: 'var(--text-muted)' }}>{EXTEND_EMAIL_AGAIN_WORDS.to(emailTo)}</span>
          </span>
        </label>
      ) : null}
      <div style={{ marginTop: '0.55rem' }}>
        <button
          type="button"
          onClick={() => onExtend(ymd, Boolean(emailTo) && emailAgain)}
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
