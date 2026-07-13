import { useRef, type CSSProperties, type KeyboardEvent } from 'react'
import type { BillingStripeModePref } from '../../lib/billingStripeModePref'

export type StripeBillingModeToggleProps = {
  value: BillingStripeModePref
  onChange: (next: BillingStripeModePref) => void
  disabled?: boolean
  /** When set, `radiogroup` uses `aria-labelledby` instead of `aria-label`. */
  labelId?: string
  /** Ignored when `labelId` is set. */
  ariaLabel?: string
}

export default function StripeBillingModeToggle({
  value,
  onChange,
  disabled = false,
  labelId,
  ariaLabel = 'Stripe mode',
}: StripeBillingModeToggleProps) {
  const testRef = useRef<HTMLButtonElement>(null)
  const liveRef = useRef<HTMLButtonElement>(null)

  const onTestKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onChange('live')
      liveRef.current?.focus()
    }
  }

  const onLiveKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onChange('test')
      testRef.current?.focus()
    }
  }

  const trackStyle: CSSProperties = {
    display: 'inline-flex',
    borderRadius: 4,
    border: value === 'live' ? '1px solid #d97706' : '1px solid var(--border-strong)',
    overflow: 'hidden',
    minHeight: 28,
    width: 'auto',
    maxWidth: 152,
    flex: '0 0 auto',
  }

  const segmentStyle = (mode: BillingStripeModePref): CSSProperties => {
    const selected = value === mode
    const isLive = mode === 'live'
    return {
      flex: 1,
      minWidth: 0,
      padding: '0.2rem 0.45rem',
      fontSize: '0.72rem',
      fontWeight: selected ? 600 : 400,
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      background: selected ? (isLive ? 'var(--bg-amber-tint)' : 'var(--bg-blue-tint)') : '#ffffff',
      color: selected && isLive ? 'var(--text-amber-800)' : 'var(--text-strong)',
    }
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-label={labelId ? undefined : ariaLabel}
      style={trackStyle}
    >
      <button
        ref={testRef}
        type="button"
        role="radio"
        aria-checked={value === 'test'}
        disabled={disabled}
        onKeyDown={onTestKeyDown}
        onClick={() => !disabled && onChange('test')}
        style={{
          ...segmentStyle('test'),
          borderRight: '1px solid var(--border)',
        }}
      >
        Test
      </button>
      <button
        ref={liveRef}
        type="button"
        role="radio"
        aria-checked={value === 'live'}
        disabled={disabled}
        onKeyDown={onLiveKeyDown}
        onClick={() => !disabled && onChange('live')}
        style={segmentStyle('live')}
      >
        Live
      </button>
    </div>
  )
}
