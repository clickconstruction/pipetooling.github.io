import { useMemo } from 'react'

import { buildTeammateEmailChips, chipMatchesValue, type TeammateChipUser } from '../../lib/teammateEmailChips'

/**
 * Tap-to-fill office-staff chips for a typed-email To field (v2.1455).
 * Tapping a chip fills the field with that teammate's email; tapping the
 * selected chip clears it; typing anything else just deselects — the field
 * stays free-form for outside addresses. Renders nothing when the roster
 * yields no chips.
 */
export function TeammateEmailChips({
  users,
  value,
  onPick,
  disabled,
}: {
  users: TeammateChipUser[]
  value: string
  onPick: (email: string) => void
  disabled?: boolean
}) {
  const chips = useMemo(() => buildTeammateEmailChips(users), [users])
  if (chips.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
      {chips.map((c) => {
        const selected = chipMatchesValue(c.email, value)
        return (
          <button
            key={c.email}
            type="button"
            onClick={() => onPick(selected ? '' : c.email)}
            disabled={disabled}
            title={c.title}
            aria-pressed={selected}
            style={{
              padding: '0.25rem 0.7rem',
              fontSize: '0.8125rem',
              borderRadius: 999,
              cursor: disabled ? 'default' : 'pointer',
              border: `1px solid ${selected ? 'var(--border-indigo-soft)' : 'var(--border-strong)'}`,
              background: selected ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: selected ? 'var(--text-blue-700)' : 'var(--text-700)',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
