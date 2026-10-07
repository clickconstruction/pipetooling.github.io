import type { CustomerProfileView } from '../../lib/customers/customerProfileView'

/** The Customer profile window's Profile | Timeline switch (punch list #97). */
export default function CustomerViewSwitch({ view, onChange }: { view: CustomerProfileView; onChange: (view: CustomerProfileView) => void }) {
  const options: Array<{ key: CustomerProfileView; label: string }> = [
    { key: 'profile', label: 'Profile' },
    { key: 'timeline', label: 'Timeline' },
  ]
  return (
    <span role="group" aria-label="Customer view" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 9999, padding: 2, flexShrink: 0 }}>
      {options.map((o) => {
        const on = o.key === view
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => {
              if (!on) onChange(o.key)
            }}
            style={{
              border: 'none',
              borderRadius: 9999,
              padding: '2px 11px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: on ? 'default' : 'pointer',
              background: on ? 'var(--text-link)' : 'transparent',
              color: on ? 'var(--surface)' : 'var(--text-muted)',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </span>
  )
}
