type Props = {
  count: number
  loading: boolean
  onGoToAr?: () => void
}

export default function DashboardArBankUnallocatedBanner({ count, loading, onGoToAr }: Props) {
  if (loading || count === 0) {
    return null
  }
  const ariaLabel = `Go to Jobs Stages Accounts Receivable, ${count} unallocated bank transaction${count === 1 ? '' : 's'}`
  return (
    <button
      type="button"
      onClick={() => onGoToAr?.()}
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1rem',
        width: '100%',
        padding: '1rem 1.25rem',
        border: '1px solid #93c5fd',
        borderRadius: 8,
        background: '#eff6ff',
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
          background: '#2563eb',
          color: '#fff',
          fontSize: '0.9375rem',
          fontWeight: 700,
        }}
        aria-hidden
      >
        {count > 99 ? '99+' : count}
      </span>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', color: '#1d4ed8' }}>Unallocated bank deposits</div>
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>
          {count === 1
            ? 'One Mercury transaction still has balance to apply — '
            : `${count} Mercury transactions still have balance to apply — `}
          match them to billed lines in Jobs → Stages → Accounts Receivable.
        </div>
      </div>
    </button>
  )
}
