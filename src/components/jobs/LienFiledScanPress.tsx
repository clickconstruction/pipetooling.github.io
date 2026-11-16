import { useRef, useState, type CSSProperties } from 'react'
import { putJobFolderFile } from '../../lib/jobs/jobFolderAddFileIo'
import { LIEN_FILED_SCAN_WORDS, LIEN_SCAN_ACCEPT, lienFiledScanName, lienScanProblem } from '../../lib/jobs/lienScanFile'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * *Upload the scanned PDF* on a filed lien affidavit (punch list #366, the owner's ask of 2026-11-16): the county
 * clerk's stamped copy as the office scanned it, picked from this computer. It sits beside **Take a photo of the
 * stamped page**, which stays the phone's way.
 *
 * The file goes up as it is, never shrunk: a scan's words must stay readable. It lands in the job's Drive folder under
 * Team only, Sent by us, the moment it is picked, so a failure shows here and not after the record is saved. The link
 * comes back through `onSaved` and the form keeps it as the filing's saved copy until its own press writes the record.
 * A file the folder cannot take is refused with what to do about it.
 */
export function LienFiledScanPress({
  jobId,
  jobNumber,
  day,
  url,
  onSaved,
  compact,
  put = putJobFolderFile,
}: {
  jobId: string
  jobNumber: string
  /** The day filed, for the file's name. */
  day: string
  /** The saved scan's link, or '' when none is added yet. */
  url: string
  onSaved: (url: string) => void
  /** The computer's record box draws small presses; the phone's sheet draws them 44 px tall. */
  compact?: boolean
  put?: typeof putJobFolderFile
}) {
  const { showToast } = useToastContext()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const words = LIEN_FILED_SCAN_WORDS

  const take = async (file: File) => {
    const problem = lienScanProblem(file, 'affidavit')
    if (problem) {
      showToast(problem, 'error')
      if (input.current) input.current.value = ''
      return
    }
    setBusy(true)
    try {
      const named = new File([file], lienFiledScanName(jobNumber, day, file), { type: file.type || 'application/pdf' })
      const added = await put(jobId, 'sent', named)
      onSaved(added.url)
    } catch (e) {
      showToast(formatErrorMessage(e, words.failed), 'error')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const press: CSSProperties = compact
    ? { padding: '0.3rem 0.7rem', fontSize: '0.78rem', background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: busy ? 'wait' : 'pointer' }
    : { minHeight: 44, padding: '0 0.9rem', fontSize: '0.875rem', fontWeight: 600, background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 8, cursor: busy ? 'wait' : 'pointer' }

  return (
    <span data-lien-filed-scan style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
      <input
        ref={input}
        type="file"
        accept={LIEN_SCAN_ACCEPT}
        aria-label={words.press}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void take(file)
        }}
        style={{ display: 'none' }}
      />
      <button type="button" disabled={busy} title={words.title} onClick={() => input.current?.click()} style={press}>
        {busy ? words.saving : url ? words.again : words.press}
      </button>
      {url && !busy ? (
        <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: compact ? '0.75rem' : '0.8125rem', fontWeight: 600, color: 'var(--text-link)' }}>
          {words.saved} ›
        </a>
      ) : null}
    </span>
  )
}

export default LienFiledScanPress
