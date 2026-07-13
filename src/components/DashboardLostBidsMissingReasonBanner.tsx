type Props = {
  count: number
  loading: boolean
  onGoToLostSummary?: () => void
}

export default function DashboardLostBidsMissingReasonBanner({ count, loading, onGoToLostSummary }: Props) {
  if (loading || count === 0) {
    return null
  }
  const ariaLabel = `Open Bid Tabs on Lost for ${count} lost bid${count === 1 ? '' : 's'} missing a reason for loss`
  return (
    <button
      type="button"
      onClick={() => onGoToLostSummary?.()}
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1rem',
        width: '100%',
        padding: '1rem 1.25rem',
        border: '1px solid var(--border-orange)',
        borderRadius: 8,
        background: 'var(--bg-orange-tint)',
        marginBottom: '1rem',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          minWidth: '2.25rem',
          height: '2.25rem',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          background: '#ea580c',
          color: '#fff',
          fontSize: '0.9375rem',
          fontWeight: 700,
        }}
        aria-hidden
      >
        {count > 99 ? '99+' : count}
      </span>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-orange-700)' }}>Lost bids need a reason</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {count === 1
            ? 'One lost bid you work on has no “Reason for loss” — '
            : `${count} lost bids you work on have no “Reason for loss” — `}
          open Bid Tabs on Lost to record it.
        </div>
      </div>
    </button>
  )
}
