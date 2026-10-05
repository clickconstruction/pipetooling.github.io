/**
 * "Only my bids" filter toggle, shown to the right of the Search Bids bar on the nine
 * workflow tabs — Counts / Takeoffs / Labor / Pricing / Cover Letter / Submittals / RFI /
 * Change Order / Lien Release (no-bid-selected list view). On by default (v2.2704); one shared
 * state in Bids.tsx. "My bids" = bids the current user is the account manager or estimator for.
 *
 * `BidPickerCheckToggle` is the look, shared with "Hide robots" (`HideRobotsToggle`), which
 * shows just below it while "Only my bids" is off: stacked, each is `compact`, half the row's
 * height; alone, "Only my bids" keeps its full size.
 */
export function BidPickerCheckToggle({ active, onChange, label, title, compact = false }: { active: boolean; onChange: (next: boolean) => void; label: string; title: string; compact?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: compact ? '0.12rem 0.6rem' : '0.5rem 0.85rem',
        whiteSpace: 'nowrap',
        border: `1px solid ${active ? '#2563eb' : '#d1d5db'}`,
        borderRadius: 4,
        cursor: 'pointer',
        background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
        color: active ? 'var(--text-blue-700)' : 'var(--text-700)',
        fontWeight: active ? 600 : 400,
        fontSize: compact ? '0.8125rem' : '0.875rem',
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
      {label}
    </button>
  )
}

export function MyBidsToggle({ active, onChange, compact = false }: { active: boolean; onChange: (next: boolean) => void; compact?: boolean }) {
  return <BidPickerCheckToggle compact={compact} active={active} onChange={onChange} label="Only my bids" title="Show only bids you are the account manager or estimator for" />
}
