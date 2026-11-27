/** One line on a deleted job's card in Settings → Recently deleted (punch list #443, row 18): the press that sends
 * the job's own Drive folder to Drive's trash, for a job deleted before the app asked at the delete, or by the
 * office. Drawn for a dev on a ZZ-named job whose kept copy has a Drive link, and for nothing else. The function
 * decides (`job-drive-folders` → `trash`); this line asks, and says what it answered. The rule is
 * lib/jobs/deletedJobFolderOffer.ts. */
import { useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import {
  DELETED_BUNDLE_FOLDER_LINE,
  DELETED_BUNDLE_FOLDER_OPEN,
  DELETED_BUNDLE_FOLDER_PRESS,
  deletedBundleFolderConfirm,
  deletedBundleFolderOffered,
  deletedBundleFolderOutcome,
  type JobFolderTrashJob,
} from '../../lib/jobs/deletedJobFolderOffer'
import { trashDeletedJobFolder } from '../../lib/jobs/jobDriveFoldersIo'
import { formatErrorMessage } from '../../utils/errorHandling'

export default function DeletedJobFolderLine({
  role,
  bundle,
  job,
}: {
  role: string | null | undefined
  /** The bundle's handle (the deleted job's id), its kind and the name its card shows. */
  bundle: { group_key: string; kind: string; label: string }
  /** The kept copy's name, customer and Drive link; undefined until read, or when the archive keeps none. */
  job: JobFolderTrashJob | null | undefined
}) {
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  /** What the function answered this visit: where the folder went, or why it stays. */
  const [said, setSaid] = useState<{ words: string; tone: 'done' | 'stays' } | null>(null)
  if (!deletedBundleFolderOffered(role, bundle.kind, job)) return null

  const send = async () => {
    if (busy || said?.tone === 'done') return
    if (!(await confirmDialog({ ...deletedBundleFolderConfirm(bundle.label), danger: true }))) return
    setBusy(true)
    try {
      const outcome = deletedBundleFolderOutcome({ answer: await trashDeletedJobFolder(bundle.group_key) })
      setSaid(outcome)
      showToast(outcome.words, 'success')
    } catch (e) {
      // A refusal is the function's own sentence, and it stays on the card: nothing failed, the folder stays.
      setSaid(deletedBundleFolderOutcome({ problem: formatErrorMessage(e, 'Its Drive folder was not moved to the trash.') }))
    } finally {
      setBusy(false)
    }
  }

  const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem' }
  const word: CSSProperties = { fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }
  const link = String(job?.google_drive_link ?? '').trim()
  const done = said?.tone === 'done'
  return (
    <div data-testid="deleted-job-folder" style={{ marginTop: '0.35rem' }}>
      <div style={muted}>{DELETED_BUNDLE_FOLDER_LINE}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.9rem', alignItems: 'center', marginTop: '0.1rem' }}>
        {done ? null : (
          <button type="button" onClick={() => void send()} disabled={busy} style={{ ...word, color: busy ? 'var(--text-muted)' : 'var(--text-red-700)', cursor: busy ? 'default' : 'pointer' }}>
            {busy ? 'Asking Drive…' : DELETED_BUNDLE_FOLDER_PRESS}
          </button>
        )}
        <a href={link} target="_blank" rel="noreferrer" style={{ ...word, color: 'var(--text-blue-500)', textDecoration: 'none' }}>
          {DELETED_BUNDLE_FOLDER_OPEN}
        </a>
      </div>
      {said ? (
        // No width of its own, then as wide as the card's words: a long answer wraps here and never pushes Preview and Restore to a line below.
        <div role="status" data-testid="deleted-job-folder-said" data-tone={said.tone} style={{ ...muted, width: 0, minWidth: '100%', marginTop: '0.2rem', color: done ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>
          {said.words}
        </div>
      ) : null}
    </div>
  )
}
