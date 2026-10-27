/**
 * Download PDF (v2.5993, punch list #206 PR 3): the estimate as a file beside Copy / Open customer
 * link, for a customer who routes a quote to people who are not the link's addressee. The press
 * draws the paper (`lib/estimates/estimatePaperPdf.ts`), hands the browser the file, and files a
 * sent copy — a download is a send (`docs/SENT_COPIES.md`) — so the Documents tab shows it went.
 * The parent builds the model; this button owns the busy state and the words.
 */
import { useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { fileSentCopy } from '../../lib/sent/sentCopiesIo'
import type { SentFiling } from '../../lib/sent/sentCopies'
import { saveBlobAs } from '../../lib/storageSave'

export const DOWNLOAD_PDF_WORDS = {
  label: 'Download PDF',
  busy: 'Drawing the PDF…',
  title: 'Save this estimate as a PDF to send to anyone. The link to approve is not in the file.',
  failed: 'Could not draw the PDF.',
} as const

export type EstimateDownloadPdfButtonProps = {
  /** Draws the file; the name is the paper's own. */
  build: () => Promise<{ blob: Blob; fileName: string }>
  /** What the sent copy says about itself; `how` is the download. */
  filing: Omit<SentFiling, 'how'>
  disabled?: boolean
  style?: CSSProperties
}

export default function EstimateDownloadPdfButton({ build, filing, disabled = false, style }: EstimateDownloadPdfButtonProps) {
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  const held = busy || disabled
  async function press() {
    if (held) return
    setBusy(true)
    try {
      const { blob, fileName } = await build()
      saveBlobAs(blob, fileName)
      void fileSentCopy({ ...filing, how: 'download' }, { blob, fileName, contentType: 'application/pdf' })
    } catch {
      showToast(DOWNLOAD_PDF_WORDS.failed, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      type="button"
      onClick={() => void press()}
      disabled={held}
      title={DOWNLOAD_PDF_WORDS.title}
      aria-label={DOWNLOAD_PDF_WORDS.label}
      style={style}
      data-testid="estimate-download-pdf"
    >
      {busy ? DOWNLOAD_PDF_WORDS.busy : DOWNLOAD_PDF_WORDS.label}
    </button>
  )
}
