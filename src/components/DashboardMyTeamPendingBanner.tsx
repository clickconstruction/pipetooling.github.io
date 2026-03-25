type Props = {
  pendingApprovalCount: number
  loadingSessions: boolean
  onGoToPendingSessions?: () => void
}

export default function DashboardMyTeamPendingBanner({
  pendingApprovalCount,
  loadingSessions,
  onGoToPendingSessions,
}: Props) {
  if (loadingSessions || pendingApprovalCount === 0) {
    return null
  }
  return (
    <button
      type="button"
      onClick={() => onGoToPendingSessions?.()}
      aria-label="Go to pending sessions in My Team"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1rem',
        width: '100%',
        padding: '1rem 1.25rem',
        border: '1px solid #fcd34d',
        borderRadius: 8,
        background: '#fffbeb',
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
          background: '#d97706',
          color: '#fff',
          fontSize: '0.9375rem',
          fontWeight: 700,
        }}
        aria-hidden
      >
        {pendingApprovalCount}
      </span>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', color: '#b45309' }}>Pending clock sessions</div>
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>
          Approve or reject in the table below (same Start–End range).
        </div>
      </div>
    </button>
  )
}
