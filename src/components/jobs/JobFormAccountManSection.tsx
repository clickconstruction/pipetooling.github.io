import AccountManIcon from '../icons/AccountManIcon'
import {
  ACCOUNT_MAN_RELATIONSHIPS,
  ACCOUNT_MAN_RELATIONSHIP_LABELS,
  parseAccountManRelationship,
} from '../../lib/jobs/accountMan'

/**
 * Edit Job "Account Man" section (v2.1466): sits between Job Address and the
 * Team picker. The Who select lists ONLY the job's current team members —
 * the invariant the DB trigger also enforces (clearing the Account Man when
 * they leave the team). Relationship defaults to primary on pick.
 */
export function JobFormAccountManSection({
  users,
  teamMemberIds,
  accountManagerUserId,
  setAccountManagerUserId,
  accountManagerRelationship,
  setAccountManagerRelationship,
}: {
  users: Array<{ id: string; name: string }>
  teamMemberIds: string[]
  accountManagerUserId: string | null
  setAccountManagerUserId: (v: string | null) => void
  accountManagerRelationship: string | null
  setAccountManagerRelationship: (v: string) => void
}) {
  const teamUsers = users
    .filter((u) => teamMemberIds.includes(u.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  const relationship = parseAccountManRelationship(accountManagerRelationship) ?? 'primary'

  const selectStyle = {
    width: '100%',
    padding: '0.45rem 0.6rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    fontSize: '0.875rem',
    boxSizing: 'border-box' as const,
    background: 'var(--surface)',
    color: 'var(--text-strong)',
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.85rem', background: 'var(--bg-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        <AccountManIcon size={15} />
        Account Man
      </div>
      {teamUsers.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Add team members below first — the Account Man must be on the team.
        </p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
          <label style={{ flex: '1 1 160px', minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Who</span>
            <select
              value={accountManagerUserId ?? ''}
              onChange={(e) => {
                const v = e.target.value || null
                setAccountManagerUserId(v)
                if (v && !parseAccountManRelationship(accountManagerRelationship)) setAccountManagerRelationship('primary')
              }}
              style={selectStyle}
            >
              <option value="">— none —</option>
              {teamUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          {accountManagerUserId ? (
            <label style={{ flex: '1 1 200px', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Relationship</span>
              <select value={relationship} onChange={(e) => setAccountManagerRelationship(e.target.value)} style={selectStyle}>
                {ACCOUNT_MAN_RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {ACCOUNT_MAN_RELATIONSHIP_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      )}
      {relationship === 'only' && accountManagerUserId ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)', fontWeight: 500 }}>
          Only communicator — the job shows a red banner everywhere so the crew knows just the Account Man speaks to this customer.
        </p>
      ) : null}
    </div>
  )
}
