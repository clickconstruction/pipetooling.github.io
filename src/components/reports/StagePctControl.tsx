import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  STAGE_PCT_STEP,
  STAGE_PCT_WORDS,
  STAGE_QUICK_PICKS,
  STAGE_QUICK_PICK_MIN_HEIGHT,
  STAGE_STEP_MIN_HEIGHT,
  quickPickLabel,
  stepPct,
  typedPct,
} from '../../lib/reports/stagePct'

const BLUE = '#2563eb'

const quickPick: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: STAGE_QUICK_PICK_MIN_HEIGHT,
  padding: '0 0.25rem',
  fontSize: '0.9375rem',
  fontWeight: 700,
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const stepBtn: CSSProperties = {
  minHeight: STAGE_STEP_MIN_HEIGHT,
  minWidth: 64,
  padding: '0 0.75rem',
  fontSize: '1.125rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

/**
 * The precise-number control (punch list #189, PR 5a): four quick picks at 48 px, then a −5 and a
 * +5 at 56 px around the number, which a tap turns into a box for the phone's keypad. It draws on
 * every stage row of a report and of the stepper, and alone for the job on a one-stage job. The
 * steps and the clamps are `lib/reports/stagePct.ts`; the host owns the number.
 */
export function StagePctControl({ name, value, onChange, disabled = false }: { name: string; value: number; onChange: (pct: number) => void; disabled?: boolean }) {
  const [typing, setTyping] = useState<string | null>(null)
  const boxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (typing != null) boxRef.current?.select()
  }, [typing])
  const commitTyped = () => {
    if (typing == null) return
    const n = typedPct(typing)
    setTyping(null)
    if (n != null && n !== value) onChange(n)
  }
  return (
    <div data-testid="stage-pct-control">
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: 8 }}>
        {STAGE_QUICK_PICKS.map((p) => {
          const active = value === p
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p)}
              aria-pressed={active}
              aria-label={`Set ${name} to ${p} percent`}
              style={{
                ...quickPick,
                border: active ? `1px solid ${BLUE}` : '1px solid var(--border-strong)',
                background: active ? BLUE : 'var(--surface)',
                color: active ? '#fff' : 'var(--text-700)',
              }}
            >
              {quickPickLabel(p)}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'center' }}>
        <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(stepPct(value, -STAGE_PCT_STEP))} aria-label={`${name} down 5`} style={stepBtn}>
          {STAGE_PCT_WORDS.minus}
        </button>
        {typing == null ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setTyping(String(value))}
            aria-label={`${name} is ${value} percent. Tap to type a number`}
            style={{ minHeight: STAGE_STEP_MIN_HEIGHT, border: '1px dashed var(--border-strong)', borderRadius: 10, background: 'transparent', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: '1.75rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', cursor: 'text', lineHeight: 1 }}
          >
            {value}
            <span style={{ fontSize: '1rem', fontWeight: 600, marginLeft: 2 }}>%</span>
          </button>
        ) : (
          <input
            ref={boxRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            value={typing}
            onChange={(e) => setTyping(e.target.value)}
            onBlur={commitTyped}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitTyped()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                setTyping(null)
              }
            }}
            aria-label={`${name} percent, type a number`}
            style={{ minHeight: STAGE_STEP_MIN_HEIGHT, width: '100%', boxSizing: 'border-box', border: `2px solid ${BLUE}`, borderRadius: 10, background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: '1.75rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}
          />
        )}
        <button type="button" disabled={disabled || value >= 100} onClick={() => onChange(stepPct(value, STAGE_PCT_STEP))} aria-label={`${name} up 5`} style={stepBtn}>
          {STAGE_PCT_WORDS.plus}
        </button>
      </div>
      <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{STAGE_PCT_WORDS.typeHint}</div>
    </div>
  )
}
