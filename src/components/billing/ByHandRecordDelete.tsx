import { useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import { BY_HAND_RECORD_DELETED, byHandRecordDeleteConfirm, byHandRecordDeleteDrawn, byHandRecordDeleteProblem, type ByHandRecordLine } from '../../lib/billing/byHandRecordDelete'
import { deleteByHandRecord } from '../../lib/billing/byHandRecordDeleteIo'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * **Delete this record…** on a by-hand line of a bill's record (punch list #443, row 4): the take-back of **Record
 * how it went**, for a dev on a test bill. It draws nothing for any other role, and nothing on any other send.
 *
 * On a by-hand record of a real bill the press is dead and says why. On a test bill it asks first, in a confirm
 * whose button names the act, then deletes through `deleteByHandRecord`, which reads the row, its bill and its job
 * again and runs the same rule on them. `onGone` reads the page again.
 */
export function ByHandRecordDelete({ line, head, when, onGone }: { line: ByHandRecordLine & { id: string }; /** The record's own words, read back in the confirm: *Handed over by Priya*. */ head: string; /** The day it says it went. */ when: string; onGone: () => void }) {
  const { role } = useAuth()
  const phone = useIsMobile()
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  if (!byHandRecordDeleteDrawn(role, line)) return null
  const problem = byHandRecordDeleteProblem(line)
  const dead = !!problem || busy

  const remove = async () => {
    if (dead) return
    if (!(await confirmDialog({ ...byHandRecordDeleteConfirm(head, when), danger: true }))) return
    setBusy(true)
    try {
      await deleteByHandRecord(line.id)
      showToast(BY_HAND_RECORD_DELETED, 'success')
      onGone()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The record was not deleted.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const press: CSSProperties = {
    fontFamily: 'inherit',
    fontSize: 'inherit',
    border: 'none',
    background: 'transparent',
    padding: 0,
    minHeight: phone ? 44 : undefined,
    cursor: dead ? 'default' : 'pointer',
    color: problem ? 'var(--text-muted)' : 'var(--text-red-700)',
    textDecoration: problem ? 'none' : 'underline',
    textUnderlineOffset: 2,
  }
  return (
    <div data-testid="bills-sent-by-hand-delete" style={{ display: 'flex', flexWrap: 'wrap', gap: '0 0.6rem', alignItems: 'baseline', marginTop: '0.25rem' }}>
      <button type="button" onClick={() => void remove()} disabled={dead} style={press}>
        {busy ? 'Deleting…' : 'Delete this record…'}
      </button>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{problem || 'Only a developer sees this. It is for a record of a test bill.'}</span>
    </div>
  )
}
