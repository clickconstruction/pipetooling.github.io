import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { approvedToast, type ClauseNeedRow } from '../../lib/contracts/approval'
import { clausePaperHref } from '../../lib/contracts/clauseRows'
import { approveClauseProposal, tellClauseEditor } from '../../lib/contracts/clausesIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ClauseDeclineWindow } from './ClauseDeclineWindow'
import { clauseButtonStyle, clausePrimaryStyle } from './clauseStyles'
import { ageChipStyle } from '../../lib/ageState'

/**
 * Messages, cut 4c: a change waiting on a controller's or a dev's approval, as a Needs you row (the prototype's
 * `clauseNeedRow`, v1.178): who changed what, the badge, the facts, the words asked for, then Approve, Decline with a why,
 * and Open in Settings. Follow up's Needs you draws these (helper 2's `followUpQueue` → `clauses`), from the same rows
 * the Dashboard counts, so the two never drift. The RPC refuses a change the clause has moved on from, in its own words.
 */
export function ClauseNeedRows({ rows, onDecided }: { rows: readonly ClauseNeedRow[]; onDecided: () => void }) {
  const { showToast } = useToastContext()
  const { profileName } = useAuth()
  const [busy, setBusy] = useState<string | null>(null)
  const [declining, setDeclining] = useState<ClauseNeedRow | null>(null)

  const approve = async (row: ClauseNeedRow) => {
    setBusy(row.proposal.id)
    try {
      await approveClauseProposal(row.proposal.id)
      const told = await tellClauseEditor(row.proposal.id)
      showToast(approvedToast(profileName ?? 'you', row.proposal.by, row.proposal.kind, Boolean(told?.emailSent)), 'success')
      onDecided()
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  if (rows.length === 0) return null
  return (
    <div data-clause-need-rows style={{ display: 'grid', gap: '0.5rem' }}>
      {rows.map((row) => (
        <div key={row.proposal.id} data-clause-need={row.proposal.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <strong>{row.title}</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)', border: '1px solid var(--bg-amber-200)', background: 'var(--bg-amber-tint)', borderRadius: 999, padding: '0 0.5rem' }}>{row.badge}</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0 0.6rem' }}>
            {row.facts.map((f, i) => (
              <span key={f}>
                {f}
                {/* The kernel puts `when` second; the age chip (CLAUSE_APPROVAL_AGE, punch list #184 sweep B) sits beside it. */}
                {i === 1 && row.age ? (
                  <span
                    title={new Date(row.proposal.at).toLocaleString()}
                    style={{ marginLeft: '0.35rem', fontSize: '0.68rem', fontWeight: 600, padding: '0.05rem 0.45rem', borderRadius: 7, whiteSpace: 'nowrap', ...ageChipStyle(row.age.state) }}
                  >
                    {row.age.label}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          <div style={{ fontSize: '0.88rem', borderLeft: '3px solid var(--border-strong)', paddingLeft: '0.6rem' }}>{row.words}</div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <button type="button" disabled={busy === row.proposal.id} onClick={() => void approve(row)} style={clausePrimaryStyle}>
              {busy === row.proposal.id ? 'Approving…' : 'Approve'}
            </button>
            <button type="button" onClick={() => setDeclining(row)} style={clauseButtonStyle}>
              Decline
            </button>
            <Link to={clausePaperHref(row.proposal.paperId)} style={{ ...clauseButtonStyle, textDecoration: 'none' }}>
              Open in Settings
            </Link>
          </div>
        </div>
      ))}
      {declining && (
        <ClauseDeclineWindow
          proposalId={declining.proposal.id}
          by={declining.proposal.by}
          onClose={() => setDeclining(null)}
          onDone={() => {
            setDeclining(null)
            onDecided()
          }}
        />
      )}
    </div>
  )
}
