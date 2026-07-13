/**
 * "Only my bids" filter toggle, shown to the right of the Search Bids bar on the
 * Counts / Takeoffs / Labor / Pricing / Cover Letter tabs (no-bid-selected list view).
 * "My bids" = bids the current user is the account manager or estimator for.
 */
export function MyBidsToggle({ active, onChange }: { active: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      title="Show only bids you are the account manager or estimator for"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.5rem 0.85rem',
        whiteSpace: 'nowrap',
        border: `1px solid ${active ? '#2563eb' : '#d1d5db'}`,
        borderRadius: 4,
        cursor: 'pointer',
        background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
        color: active ? 'var(--text-blue-700)' : 'var(--text-700)',
        fontWeight: active ? 600 : 400,
        fontSize: '0.875rem',
        boxSizing: 'border-box',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `1px solid ${active ? '#2563eb' : '#9ca3af'}`,
          background: active ? '#2563eb' : 'var(--surface)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '0.7rem',
          lineHeight: 1,
        }}
      >
        {active ? '✓' : ''}
      </span>
      Only my bids
    </button>
  )
}
