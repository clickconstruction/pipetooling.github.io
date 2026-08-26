import { useMemo, useState } from 'react'
import { buildAddressStatementPreview, suggestAddressComma } from '../../lib/addressCommaNudge'

/**
 * The comma nudge under the Job Address input (v2.2323, approved mockup):
 * a live "how it reads on statements" preview — street bold, city quiet,
 * exactly the portal's split — plus a one-tap chip that inserts the missing
 * comma when a pasted address ends in a known city. Advice, never law: no
 * state here ever blocks a save, and the chip only rewrites the field when
 * tapped. "ignore" dismisses per address string (typing resets it).
 */
export default function JobFormAddressNudge({
  address,
  onApply,
}: {
  address: string
  onApply: (fixed: string) => void
}) {
  const [ignoredFor, setIgnoredFor] = useState<string | null>(null)
  const preview = useMemo(() => buildAddressStatementPreview(address), [address])
  const suggestion = useMemo(() => suggestAddressComma(address), [address])
  if (!preview) return null
  const showChip = suggestion != null && ignoredFor !== address
  return (
    <div style={{ marginTop: 5 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', fontSize: '0.75rem' }}>
        <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          On statements
        </span>
        <span style={{ fontWeight: 600 }}>{preview.street}</span>
        {preview.quiet && <span style={{ color: 'var(--text-muted)' }}>{preview.quiet}</span>}
        {suggestion ? (
          <span style={{ color: '#d97706' }}>city is stuck in the street</span>
        ) : preview.quiet ? (
          <span aria-hidden style={{ color: '#16a34a' }}>✓</span>
        ) : (
          <span style={{ color: 'var(--text-faint)' }}>no city found — shown as-is</span>
        )}
      </div>
      {showChip && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 6,
            padding: '6px 10px',
            border: '1px solid #b0662f',
            borderRadius: 6,
            background: 'var(--bg-subtle)',
            fontSize: '0.75rem',
          }}
        >
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>{suggestion.fixed}</span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => onApply(suggestion.fixed)}
            style={{
              background: '#b0662f',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '4px 12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            Add comma
          </button>
          <button
            type="button"
            onClick={() => setIgnoredFor(address)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '4px 2px',
            }}
          >
            ignore
          </button>
        </div>
      )}
    </div>
  )
}
