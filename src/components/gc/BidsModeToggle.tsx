import { useNavigate } from 'react-router-dom'

/**
 * GC mode design spike: the switch between the two faces of Bids. Trades mode is the page as it
 * is (we bid a trade to a GC). GC mode is the mirror (we are the GC and trades bid to us).
 */
export function BidsModeToggle({ mode }: { mode: 'trades' | 'gc' }) {
  const navigate = useNavigate()
  const options = [
    { key: 'trades' as const, label: 'Trades', to: '/bids', title: 'We bid our trade to a general contractor.' },
    { key: 'gc' as const, label: 'GC', to: '/bids/gc', title: 'We are the general contractor. Trades bid to us.' },
  ]
  return (
    <div
      role="group"
      aria-label="Bids mode"
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        border: '1px solid var(--text-violet-700)',
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      {options.map((o) => {
        const active = o.key === mode
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            title={o.title}
            onClick={() => {
              if (!active) navigate(o.to)
            }}
            style={{
              padding: '0.4rem 0.9rem',
              border: 'none',
              background: active ? 'var(--text-violet-700)' : 'var(--surface)',
              color: active ? 'white' : 'var(--text-violet-700)',
              fontWeight: 600,
              cursor: active ? 'default' : 'pointer',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
