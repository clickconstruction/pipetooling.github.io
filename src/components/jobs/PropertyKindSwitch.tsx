import type { CSSProperties } from 'react'
import { PROPERTY_KIND_OPTIONS, type PropertyKind } from '../../lib/jobs/propertyKind'

/**
 * Residential | Commercial — the property's kind as a two-part switch (v2.3667).
 * Amber while unanswered, the picked half filled once it is. Every screen says
 * "Commercial" (the owner's call of 2026-10-09; the property sheet and Edit Job
 * said "Non-residential" until then); `voice` still picks each screen's case and
 * its words for an unset kind. Picking the pressed half again clears it only
 * where `allowClear` says the screen offers that.
 */
type Props = {
  value: PropertyKind
  onPick: (kind: PropertyKind) => void
  voice?: 'lien' | 'sheet'
  size?: 'row' | 'field'
  disabled?: boolean
  allowClear?: boolean
  /** What the switch is about, for a screen reader — "Property kind for 273 · Dudley". */
  label: string
  /** What the app leans toward (v2.4727, Quickfill → Property kinds): that half is outlined and reads "looks right"; nothing is picked until the tap. */
  hint?: Exclude<PropertyKind, ''> | null
}

/** Literal fill: a white label sits on it in both themes (v2.3656). */
const PICKED_FILL = '#2563eb'

const HINT_RING = { residential: '#2563eb', non_residential: '#ea580c' } as const

export default function PropertyKindSwitch({ value, onPick, voice = 'lien', size = 'row', disabled = false, allowClear = false, label, hint = null }: Props) {
  const unset = value === ''
  const edge = unset ? 'var(--border-amber)' : 'var(--border-strong)'
  const half = (on: boolean, first: boolean): CSSProperties => ({
    font: 'inherit',
    fontSize: size === 'field' ? '0.8125rem' : '0.75rem',
    fontWeight: 600,
    padding: size === 'field' ? '6px 14px' : '3px 10px',
    border: 'none',
    borderLeft: first ? 'none' : `1px solid ${edge}`,
    background: on ? PICKED_FILL : unset ? 'var(--bg-amber-tint)' : 'var(--surface)',
    color: on ? '#fff' : unset ? 'var(--text-amber-800)' : 'var(--text-700)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  })
  return (
    <span role="group" aria-label={label} data-testid="property-kind-switch" data-kind={value || 'unset'} style={{ display: 'inline-flex', border: `1px solid ${edge}`, borderRadius: 7, overflow: 'hidden', verticalAlign: 'middle' }}>
      {PROPERTY_KIND_OPTIONS.map((o, i) => {
        const on = value === o.kind
        const hinted = unset && hint === o.kind
        return (
          <button key={o.kind} type="button" aria-pressed={on} disabled={disabled} onClick={() => (on ? (allowClear ? onPick('') : undefined) : onPick(o.kind))} style={hinted ? { ...half(on, i === 0), boxShadow: `inset 0 0 0 2px ${HINT_RING[o.kind]}`, color: HINT_RING[o.kind] } : half(on, i === 0)}>
            {o[voice]}
            {hinted ? <span style={{ fontWeight: 500 }}> · looks right</span> : null}
          </button>
        )
      })}
    </span>
  )
}
