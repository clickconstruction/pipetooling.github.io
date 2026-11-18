import { billCustomerMemoActivePresetId, type BillCustomerMemoPreset } from '../../lib/billCustomerMemoPresets'

/** Bill Customer's memo presets as a row of presses: one press writes the memo on every channel, a second press or Clear empties it. */
export function BillCustomerMemoPresetRow({
  presets,
  valueForHighlight,
  onApplyBoth,
}: {
  presets: BillCustomerMemoPreset[]
  valueForHighlight: string
  onApplyBoth: (body: string) => void
}) {
  const activeId = billCustomerMemoActivePresetId(valueForHighlight)
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.35rem',
        alignItems: 'center',
        marginBottom: '0.35rem',
      }}
    >
      {presets.map((p) => {
        const pressed = activeId === p.id
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => {
              if (pressed) {
                onApplyBoth('')
                return
              }
              onApplyBoth(p.body)
            }}
            title={`${p.label} memo (click again to clear)`}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              border: pressed ? '2px solid #2563eb' : '1px solid var(--border-strong)',
              borderRadius: 4,
              background: pressed ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
              color: 'var(--text-700)',
              cursor: 'pointer',
              fontWeight: pressed ? 600 : 500,
            }}
          >
            {p.label}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => onApplyBoth('')}
        style={{
          padding: '0.25rem 0.5rem',
          fontSize: '0.75rem',
          border: '1px solid var(--border-strong)',
          borderRadius: 4,
          background: 'var(--surface)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}
      >
        Clear
      </button>
    </div>
  )
}
