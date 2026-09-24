/**
 * Share with… (v2.3802, to-dos/helper-tryout-loop PR 5): a full Hiring-board holder ticks the
 * accounts one role column is shared with. Each tick writes or removes one
 * `team_prospect_role_shares` row at once — there is no Save. The list is prospects staff without
 * the Hiring switch (`shareableAccounts`); full holders are not listed because they already see
 * everything.
 */
import { displayName, sharedByLine, type ColumnShare, type ShareableAccount } from '../../lib/hiring/columnShares'
import { humanRoleLabel } from '../../lib/roleLabels'

type Props = {
  columnName: string
  accounts: ShareableAccount[]
  /** The shares on this column. */
  shares: ColumnShare[]
  loading: boolean
  busy: boolean
  nameOf: (userId: string) => string | null
  onToggle: (userId: string, on: boolean) => void
  onClose: () => void
}

export default function ShareColumnDialog({ columnName, accounts, shares, loading, busy, nameOf, onToggle, onClose }: Props) {
  const shareByUser = new Map(shares.map((s) => [s.user_id, s]))
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-column-title"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 8, padding: '1.25rem', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}
      >
        <h3 id="share-column-title" style={{ margin: '0 0 0.35rem', fontSize: '1.0625rem' }}>Share {columnName} with</h3>
        <p style={{ margin: '0 0 0.85rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          They see this column on Screen, Interview and Try-out, can add and call candidates, Advance them and press Try out. They never see Hire, Review or other columns, and cannot Hire, Pass or move a card out.
        </p>
        {loading ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading accounts…</p>
        ) : accounts.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Nobody to share with — everyone with Prospects access already holds the Hiring board.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {accounts.map((u) => {
              const share = shareByUser.get(u.id)
              return (
                <li key={u.id}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', padding: '0.4rem 0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: share ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)', cursor: busy ? 'not-allowed' : 'pointer' }}>
                    <input type="checkbox" checked={Boolean(share)} disabled={busy} onChange={(e) => onToggle(u.id, e.target.checked)} style={{ marginTop: '0.2rem' }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{displayName(u)}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>{humanRoleLabel(u.role)}</span>
                      {share && (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sharedByLine(share, nameOf)}</span>
                      )}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        <p style={{ margin: '0.85rem 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
          Full Hiring holders are not listed — they already see everything. Sharing never turns the Hiring switch on.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
          <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
