import { useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { CLAUSE_NOTIFY_LIVE, declinedToast } from '../../lib/contracts/approval'
import { declineClauseProposal, tellClauseEditor } from '../../lib/contracts/clausesIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ClauseField, ClauseWindow } from './ClauseWindow'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from './clauseStyles'

/**
 * Messages, cut 4c: *Decline the change* (the prototype's `declineClause`, v1.178). A controller or a dev says why, and
 * the proposer reads it on the clause's history and gets it by email (messages-notify). A decline with no why is refused,
 * here and by the RPC.
 */
export function ClauseDeclineWindow({ proposalId, by, onClose, onDone }: { proposalId: string; by: string; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToastContext()
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const decline = async () => {
    if (why.trim() === '') {
      setProblem(`Say why, for ${by}.`)
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      await declineClauseProposal(proposalId, why.trim())
      const told = await tellClauseEditor(proposalId)
      showToast(declinedToast(by, Boolean(told?.emailSent)), 'success')
      onDone()
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ClauseWindow label="Decline the change" title="Decline the change" lede={CLAUSE_NOTIFY_LIVE ? `${by} gets your why by email. It stays on the clause's history.` : `${by} reads your why on the clause's history.`} width={520} onClose={onClose}>
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
      <ClauseField label={`Why, for ${by}`}>
        <textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="For example: keep the old wording." style={clauseInputStyle} />
      </ClauseField>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={clauseButtonStyle}>
          Keep it waiting
        </button>
        <button type="button" disabled={busy} onClick={() => void decline()} style={clausePrimaryStyle}>
          {busy ? 'Declining…' : 'Decline'}
        </button>
      </div>
    </ClauseWindow>
  )
}
