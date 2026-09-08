/**
 * Stage Plan controls (PR 2): the badge at the left of a line item (a numbered
 * circle for an Order stage, a diamond for an Any stage, a dashed circle for a
 * plain line) and the Order / Any / — selector on the row's second line.
 * Pure render; the plan row comes from `stagePlan.ts`.
 */
import type { CSSProperties } from 'react'
import type { StageKind, StageLinePart, StagePlanRow, StageTone } from '../../lib/jobs/stagePlan'

/** Saturated stage colors stay literal per the theme rules. */
const ORDER_FILL = 'var(--text-strong)'
const DONE_FILL = '#16a34a'
const ANY_FILL = '#b45309'

export function StageKindBadge({ row, size = 26 }: { row: StagePlanRow | null; size?: number }) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    flexShrink: 0,
    fontSize: size * 0.5,
    fontWeight: 700,
    lineHeight: 1,
    boxSizing: 'border-box',
  }
  if (!row || row.kind === null) {
    return <span aria-label="Plain line item" title="Not a stage — bills with the final draw" style={{ ...base, borderRadius: '50%', border: '1.5px dashed var(--border-strong)', color: 'var(--text-muted)' }} />
  }
  if (row.kind === 'any') {
    const done = row.badge === 'any-done'
    const d = Math.round(size * 0.68)
    return (
      <span aria-label={done ? 'Any-time stage, done' : 'Any-time stage'} title={done ? 'Any time · done' : 'Any time · its own dates'} style={{ ...base }}>
        <span style={{ width: d, height: d, transform: 'rotate(45deg)', borderRadius: 3, background: done ? ANY_FILL : 'transparent', border: `2px solid ${ANY_FILL}`, boxSizing: 'border-box' }} />
      </span>
    )
  }
  if (row.badge === 'done') {
    return (
      <span aria-label={`Stage ${row.number}, done`} title={`Stage ${row.number} · paid`} style={{ ...base, borderRadius: '50%', background: DONE_FILL, color: '#ffffff' }}>
        ✓
      </span>
    )
  }
  if (row.badge === 'live') {
    return (
      <span aria-label={`Stage ${row.number}, current`} title={`Stage ${row.number} · the stage the job is on`} style={{ ...base, borderRadius: '50%', background: ORDER_FILL, color: 'var(--surface)' }}>
        {row.number}
      </span>
    )
  }
  return (
    <span aria-label={`Stage ${row.number}`} title={`Stage ${row.number} · waits for the one above it`} style={{ ...base, borderRadius: '50%', border: '1.5px solid var(--border-strong)', color: 'var(--text-muted)' }}>
      {row.number}
    </span>
  )
}

const KIND_OPTIONS: Array<{ value: StageKind | null; label: string; title: string; on: CSSProperties }> = [
  { value: 'order', label: 'Order', title: 'In order: numbered, waits for the stage above it to pass inspection, draws when it passes', on: { background: ORDER_FILL, color: 'var(--surface)' } },
  { value: 'any', label: 'Any', title: 'Any time: its own dates, bills when its work is done', on: { background: ANY_FILL, color: '#ffffff' } },
  { value: null, label: '—', title: 'Not a stage: a plain line item that bills with the final draw', on: { background: 'var(--bg-200)', color: 'var(--text-700)' } },
]

export function StageKindSelector({ value, onChange, disabled = false, rowName }: { value: StageKind | null; onChange: (kind: StageKind | null) => void; disabled?: boolean; rowName?: string }) {
  return (
    <span
      role="radiogroup"
      aria-label={rowName ? `Stage kind for ${rowName}` : 'Stage kind'}
      style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 5, overflow: 'hidden', flexShrink: 0, opacity: disabled ? 0.6 : 1 }}
    >
      {KIND_OPTIONS.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            title={disabled ? 'On an invoice — send it back or delete the draft to change the kind' : o.title}
            onClick={() => {
              if (!on) onChange(o.value)
            }}
            style={{
              padding: '0.1rem 0.5rem',
              fontSize: '0.6875rem',
              fontWeight: on ? 700 : 500,
              lineHeight: 1.6,
              border: 'none',
              borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
              background: on ? o.on.background : 'transparent',
              color: on ? o.on.color : 'var(--text-muted)',
              cursor: disabled || on ? 'default' : 'pointer',
              fontFamily: 'inherit',
              minWidth: o.value === null ? '1.6rem' : undefined,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </span>
  )
}

const TONE_COLOR: Record<StageTone, string> = {
  plain: 'var(--text-700)',
  muted: 'var(--text-muted)',
  green: 'var(--text-green-700)',
  blue: 'var(--text-blue-700)',
  amber: 'var(--text-amber-800)',
}

/** The words after the selector: "Stage 2 · on site Sep 9 – 10 · 50% · draw 2 billed Sep 5", toned per part. */
export function StageStateLine({ parts }: { parts: StageLinePart[] }) {
  return (
    <span style={{ fontSize: '0.75rem', lineHeight: 1.5, minWidth: 0 }}>
      {parts.map((p, i) => (
        <span key={i} style={{ color: TONE_COLOR[p.tone], fontWeight: i === 0 && p.tone === 'plain' ? 600 : 400 }}>
          {i > 0 ? <span style={{ color: 'var(--text-muted)' }}> · </span> : null}
          {p.text}
        </span>
      ))}
    </span>
  )
}
