import { staffOutcomeWonPctDisplay } from '../../lib/bids/bidBoardStaffOutcomes'
import type { BidBoardStaffOutcomeRow, BidBoardStaffOutcomesByRole } from '../../lib/bids/bidBoardStaffOutcomes'

function BidBoardEstimatingHealthWonPctSliderRow({ row }: { row: BidBoardStaffOutcomeRow }) {
  const { pct } = staffOutcomeWonPctDisplay(row)
  const pctStr = pct === null ? '—' : `${pct.toFixed(1)}%`
  return (
    <div
      role="group"
      aria-label={pct === null ? `${row.displayName}, no decided bids` : `${row.displayName}, Won percent ${pctStr}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.35rem 0.5rem',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ flex: '0 1 9rem', minWidth: 0, fontSize: '0.8125rem', color: 'var(--text-700)' }}>{row.displayName}</div>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', padding: '6px 0' }}>
        <div
          aria-hidden
          style={{
            height: 10,
            position: 'relative',
            borderRadius: 4,
            border: '1px solid var(--border)',
            overflow: 'visible',
            opacity: pct === null ? 0.45 : 1,
            background:
              'linear-gradient(90deg, var(--bg-red-100) 0%, var(--bg-red-100) 20%, #fef9c3 20%, #fef9c3 40%, var(--bg-green-100) 40%, var(--bg-green-100) 60%, #fef9c3 60%, #fef9c3 80%, var(--bg-red-100) 80%, var(--bg-red-100) 100%)',
          }}
        >
          {pct !== null ? (
            <div
              style={{
                position: 'absolute',
                left: `${pct}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 5,
                height: 18,
                background: '#111827',
                borderRadius: 2,
                boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
              }}
            />
          ) : null}
        </div>
      </div>
      <div
        style={{
          flex: '0 0 auto',
          minWidth: '3.25rem',
          textAlign: 'right',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--text-700)',
        }}
      >
        {pctStr}
      </div>
    </div>
  )
}

export function BidBoardEstimatingHealthWonPctSliders({ stats }: { stats: BidBoardStaffOutcomesByRole }) {
  if (stats.estimators.length === 0 && stats.accountManagers.length === 0) return null
  return (
    <div style={{ margin: '0 0 0.625rem 0', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
      {stats.estimators.length > 0 ? (
        <>
          <div
            style={{
              padding: '0.375rem 0.75rem',
              background: 'var(--bg-subtle)',
              borderBottom: '1px solid var(--border)',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Estimators
          </div>
          {stats.estimators.map((row) => (
            <BidBoardEstimatingHealthWonPctSliderRow key={`est-health-${row.userId}`} row={row} />
          ))}
        </>
      ) : null}
      {stats.accountManagers.length > 0 ? (
        <>
          <div
            style={{
              padding: '0.375rem 0.75rem',
              background: 'var(--bg-subtle)',
              borderBottom: '1px solid var(--border)',
              borderTop: stats.estimators.length > 0 ? '1px solid #e5e7eb' : undefined,
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Account managers
          </div>
          {stats.accountManagers.map((row) => (
            <BidBoardEstimatingHealthWonPctSliderRow key={`am-health-${row.userId}`} row={row} />
          ))}
        </>
      ) : null}
    </div>
  )
}
