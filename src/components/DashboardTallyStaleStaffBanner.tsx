type Props = {
  peopleCount: number
  transactionCount: number
  loading: boolean
  minAgeDays?: number
  onOpen: () => void
}

export default function DashboardTallyStaleStaffBanner({
  peopleCount,
  transactionCount,
  loading,
  minAgeDays = 2,
  onOpen,
}: Props) {
  if (loading || peopleCount === 0 || transactionCount === 0) {
    return null
  }
  const agePhrase =
    minAgeDays === 2
      ? 'Posted more than 2 calendar days ago'
      : `Posted more than ${minAgeDays} calendar days ago`
  return (
    <button
      type="button"
      onClick={() => onOpen()}
      aria-label="Open stale tally follow-up for your team"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1rem',
        width: '100%',
        padding: '1rem 1.25rem',
        border: '1px solid #93c5fd',
        borderRadius: 8,
        background: 'var(--bg-blue-tint)',
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
        {peopleCount}
      </span>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-blue-700)' }}>Stale tally follow-up</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
          <strong>{peopleCount}</strong> {peopleCount === 1 ? 'person' : 'people'} · <strong>{transactionCount}</strong>{' '}
          unlinked transaction{transactionCount === 1 ? '' : 's'} — {agePhrase}. Assign jobs on their behalf.
        </div>
      </div>
    </button>
  )
}
