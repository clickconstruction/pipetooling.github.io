type Props = {
  staleCount: number
  loading: boolean
  minAgeDays?: number
  onGoToTally?: () => void
}

export default function DashboardTallyStaleBanner({
  staleCount,
  loading,
  minAgeDays = 2,
  onGoToTally,
}: Props) {
  if (loading || staleCount === 0) {
    return null
  }
  return (
    <button
      type="button"
      onClick={() => onGoToTally?.()}
      aria-label="Go to Job Parts Tally to sort purchases that aren't on a job yet"
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
        {staleCount}
      </span>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-orange-700)' }}>Purchases waiting to be sorted</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {staleCount === 1
            ? `One purchase over ${minAgeDays} days old isn't on a job yet — tap to sort it in Job Parts Tally.`
            : `${staleCount} purchases over ${minAgeDays} days old aren't on a job yet — tap to sort them in Job Parts Tally.`}
        </div>
      </div>
    </button>
  )
}
