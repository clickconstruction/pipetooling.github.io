import { useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { LIEN_PAGE_EXPORT_WORDS, lienExportPressLabel, type LienExportPageKey } from '../../lib/jobs/lienPageExport'
import { openPdfInNewTab } from '../../lib/jobs/lienPageExportIo'
import { fileSentCopy } from '../../lib/sent/sentCopiesIo'
import type { SentFiling } from '../../lib/sent/sentCopies'
import { saveBlobAs } from '../../lib/storageSave'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * The two presses at the right end of a notice's page bar (v2.7432, Taunya's ask of 2026-11-15, the drawing she
 * approved): *Open ↗* shows that page alone in a new tab, in the browser's own PDF viewer, and *PDF ↓* saves the same
 * file. They sit beside the bar's own button, never inside it, so the bar still scrolls to its page.
 *
 * Nothing here writes to the notice, so training mode and every role that opens the desk may export. A download of
 * an approved notice files a copy as *Saved as a file* (`filing`, null for a draft). Opening is a look and files nothing.
 */
export default function LienPageExportPresses({
  pageKey,
  phone,
  build,
  fileName,
  filing,
}: {
  pageKey: LienExportPageKey
  /** A phone draws the arrows alone, thumb-sized. */
  phone: boolean
  /** Makes the page's PDF: the page as it mails, with the draft line until the notice is approved. */
  build: () => Promise<Blob>
  fileName: string
  /** What the download files under Sent from this job, or null when it is not a send (a draft). */
  filing: Omit<SentFiling, 'how'> | null
}) {
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState<'open' | 'pdf' | null>(null)
  const W = LIEN_PAGE_EXPORT_WORDS

  const failed = (e: unknown) => showToast(`${W.failed}: ${formatErrorMessage(e, 'the page could not be drawn')}`, 'error')

  const open = async () => {
    if (busy) return
    setBusy('open')
    try {
      if ((await openPdfInNewTab(build, W.busy)) === 'blocked') showToast(W.blocked, 'error')
    } catch (e) {
      failed(e)
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (busy) return
    setBusy('pdf')
    try {
      const blob = await build()
      saveBlobAs(blob, fileName)
      if (filing) void fileSentCopy({ ...filing, how: 'download' }, { blob, fileName, contentType: 'application/pdf' })
    } catch (e) {
      failed(e)
    } finally {
      setBusy(null)
    }
  }

  const words = (press: 'open' | 'pdf') => (busy === press ? (phone ? '…' : W.busy) : phone ? W[press].arrow : `${W[press].label} ${W[press].arrow}`)

  return (
    <span className="lienPageExport" data-lien-page-export={pageKey} data-phone={phone ? 'yes' : 'no'}>
      <button type="button" className="lienPageExportBtn" data-lien-page-open={pageKey} onClick={() => void open()} disabled={busy != null} aria-busy={busy === 'open'} aria-label={lienExportPressLabel('open', pageKey)} title={W.open.title}>
        {words('open')}
      </button>
      {phone ? null : <span className="lienPageExportSep" aria-hidden="true" />}
      <button type="button" className="lienPageExportBtn" data-lien-page-pdf={pageKey} onClick={() => void save()} disabled={busy != null} aria-busy={busy === 'pdf'} aria-label={lienExportPressLabel('pdf', pageKey)} title={W.pdf.title}>
        {words('pdf')}
      </button>
    </span>
  )
}
