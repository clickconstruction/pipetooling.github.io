import { useState } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { loginAsUser } from '../../lib/loginAsUser'
import { lookViewAsConfirm, lookViewAsFailed, lookViewAsLabel, lookViewAsLead, lookViewAsTail } from '../../lib/tasks/taskLook'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * The door from a look to View as (punch list #381, call 7): one quiet line under what a look does not show. A look
 * changes nothing, so to press something as the person a dev signs in as them. That is the app's own View as, with its
 * record and its Exit. The line asks first, since the sign-in ends the look. Who is offered it is `lookOffersViewAs`.
 */
export function TaskLookViewAs({ personName, email, role }: { personName: string; email: string; role: string | null }) {
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)

  async function viewAs() {
    if (busy) return
    const ok = await confirmDialog(lookViewAsConfirm(personName))
    if (!ok) return
    setBusy(true)
    try {
      // Lands on this page as them. A role that has no Review is sent to its own Today, which is the screen in the look.
      await loginAsUser({ email, role })
    } catch (e) {
      showToast(formatErrorMessage(e, lookViewAsFailed(personName)), 'error')
      setBusy(false)
    }
  }

  return (
    <p data-look-view-as style={{ margin: '0.6rem 0 0', fontSize: '0.8125rem', lineHeight: 1.4, color: 'var(--text-700)' }}>
      {lookViewAsLead(personName)}{' '}
      <button
        type="button"
        disabled={busy}
        onClick={() => void viewAs()}
        style={{ font: 'inherit', fontWeight: 600, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', textDecoration: 'underline', cursor: busy ? 'default' : 'pointer' }}
      >
        {lookViewAsLabel(personName)}
      </button>
      . {lookViewAsTail(personName)}
    </p>
  )
}
