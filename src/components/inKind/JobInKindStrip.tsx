import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { JOB_ON_DEAL_SAVED, JOB_PICK_DEAL_PRESS, JOB_PUT_ON_DEAL_PRESS, jobOffTheDealWords, type InKindStanding } from '../../lib/inKind/inKindChip'
import { addJobToInKindArrangement } from '../../lib/inKind/inKindStandingIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { linePress, noteStrip, redText } from './inKindStyles'

/**
 * On a job whose customer pays in kind while the job is not on the deal (punch list #301, mock-up 2): it says so, and
 * one press puts the job on the deal. With more than one open deal the press opens the customer's page instead, since
 * a person has to pick the deal.
 */
export default function JobInKindStrip({
  jobId,
  customerName,
  standing,
  onAdded,
  add = addJobToInKindArrangement,
}: {
  jobId: string
  customerName: string
  standing: InKindStanding
  /** The job is on the deal now. */
  onAdded: (arrangementId: string) => void
  add?: (arrangementId: string, jobId: string) => Promise<void>
}) {
  const toast = useToastContext()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const words = jobOffTheDealWords(customerName)
  const only = standing.arrangementIds.length === 1 ? standing.arrangementIds[0]! : null

  const put = async () => {
    if (!only || saving) return
    setSaving(true)
    setError(null)
    try {
      await add(only, jobId)
      toast.showToast(JOB_ON_DEAL_SAVED, 'success')
      onAdded(only)
    } catch (e) {
      setError(formatErrorMessage(e, 'The job was not put on the arrangement.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ ...noteStrip, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 10 }} data-testid="job-in-kind-strip">
      <span style={{ flex: '1 1 260px', minWidth: 0 }}>
        <b style={{ color: 'var(--text-strong)' }}>{words.lead}</b> {words.rest}
        {error ? <span style={{ ...redText, display: 'block', marginTop: 4 }}>{error}</span> : null}
      </span>
      {only ? (
        <button type="button" onClick={() => void put()} disabled={saving} style={{ ...linePress, opacity: saving ? 0.6 : 1 }} data-testid="job-in-kind-put">
          {saving ? 'Saving…' : JOB_PUT_ON_DEAL_PRESS}
        </button>
      ) : (
        <Link to={`/customers/${standing.customerId}`} style={{ ...linePress, textDecoration: 'none' }}>
          {JOB_PICK_DEAL_PRESS}
        </Link>
      )}
    </div>
  )
}
