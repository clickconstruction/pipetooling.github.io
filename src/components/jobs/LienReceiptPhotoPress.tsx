import { useRef, useState, type CSSProperties } from 'react'
import { shrinkPhoto } from '../../lib/materials/photoShrink'
import { putJobFolderFile } from '../../lib/jobs/jobFolderAddFileIo'
import { addFileTooBig } from '../../lib/jobs/jobFolderAddFile'
import { LIEN_SERVICE_PROOF_WORDS, lienReceiptPhotoName, type LienReceiptPhotoOf } from '../../lib/jobs/lienServiceProof'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * One photo of a lien paper's proof, taken on the phone or picked on a computer (punch list #314, change 5): a
 * certified mail receipt for a copy of the filed affidavit, or the clerk's stamped page.
 *
 * The shot is shrunk on the device, as a box photo is, and put in the job's Drive folder under Team only, Sent by us,
 * the moment it is taken, so a failure shows here and not after the record is saved. The link comes back through
 * `onSaved` and the form keeps it until its own press writes the record. A photo never holds that press.
 */
export function LienReceiptPhotoPress({
  jobId,
  jobNumber,
  of,
  day,
  url,
  onSaved,
  label,
  compact,
  put = putJobFolderFile,
}: {
  jobId: string
  jobNumber: string
  of: LienReceiptPhotoOf
  /** The day on the form, for the file's name. */
  day: string
  /** The saved photo's link, or '' when none is taken yet. */
  url: string
  onSaved: (url: string) => void
  /** The press's words; the receipt's by default. */
  label?: string
  /** The computer's record box draws small presses; the phone's sheet draws them 44 px tall. */
  compact?: boolean
  put?: typeof putJobFolderFile
}) {
  const { showToast } = useToastContext()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const words = LIEN_SERVICE_PROOF_WORDS

  const take = async (file: File) => {
    setBusy(true)
    try {
      const shot = await shrinkPhoto(file)
      // A shot the browser could not decode goes as it came, under its own extension.
      const ext = shot.shrunk ? 'jpg' : (file.name.split('.').pop() ?? 'jpg')
      const named = new File([shot.blob], lienReceiptPhotoName(of, jobNumber, day, ext), { type: shot.shrunk ? 'image/jpeg' : file.type || 'application/octet-stream' })
      if (addFileTooBig(named.size)) throw new Error('That file is over 10 MB. Take the photo again, closer to the paper.')
      const added = await put(jobId, 'sent', named)
      onSaved(added.url)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the photo.'), 'error')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const press: CSSProperties = compact
    ? { padding: '0.3rem 0.7rem', fontSize: '0.78rem', background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: busy ? 'wait' : 'pointer' }
    : { minHeight: 44, padding: '0 0.9rem', fontSize: '0.875rem', fontWeight: 600, background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 8, cursor: busy ? 'wait' : 'pointer' }
  const say = label ?? (of === 'clerk' ? words.clerkPhoto : words.photo)

  return (
    <span data-lien-receipt-photo={of} style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={say}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void take(file)
        }}
        style={{ display: 'none' }}
      />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} style={press}>
        {busy ? words.saving : url ? words.again : say}
      </button>
      {url && !busy ? (
        <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: compact ? '0.75rem' : '0.8125rem', fontWeight: 600, color: 'var(--text-link)' }}>
          {words.saved} ›
        </a>
      ) : null}
    </span>
  )
}

export default LienReceiptPhotoPress
