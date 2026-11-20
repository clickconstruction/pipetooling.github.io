/**
 * Printing a run of filed liens' copies (v2.7916): the tab opens inside the click and says what it is building, the
 * run's PDF lands in it and asks for the print window, and each lien's own papers are kept on its job
 * (`sent_documents`, kind `lien_affidavit_copy`). The kept file is the same PDF that went into the stack, so what is
 * filed on the job is what went in the envelope. The row says the copy was the stamped scan, which file and its
 * SHA-256 (`lienStampedPrintSnapshot`). The mail sheet is a desk paper and is not kept.
 *
 * Nothing here mails anything, and nothing marks a lien as mailed.
 */
import { demandDate } from '../jobsDocuments/demandLetter'
import { filingDocPdfBlob, type FilingDocExtras } from '../jobsDocuments/lienFilingDocuments'
import { LIEN_SERVED_COPY_SENT_KIND, lienServeLetters, lienServedCopySentTitle } from '../jobsDocuments/lienServedCopy'
import { fileSentCopy } from '../sent/sentCopiesIo'
import { lienServeMailSheet, lienServeReturnAddress, type LienServeJob, type LienServeRun } from './lienServePackets'
import { buildLienServeStackPdf, type LienServePdfJob } from './lienServePdf'
import { lienStampedPrintFileName, lienStampedPrintSnapshot } from './lienStampedCopy'
import { formatErrorMessage } from '../../utils/errorHandling'

export const LIEN_SERVE_PRINT_WORDS = {
  building: 'Putting the stamped copies together…',
  blocked: 'Popup blocked — allow popups to print.',
  nothing: 'Nothing could be printed.',
} as const

export type LienServePrintResult =
  | { how: 'blocked' }
  | { how: 'failed'; reason: string; notPrinted: Array<{ job: LienServeJob; reason: string }> }
  | { how: 'opened'; printed: Array<{ jobId: string; filingId: string }>; notPrinted: Array<{ job: LienServeJob; reason: string }> }

/** The run's PDF and each lien's own file, with no window opened and nothing kept: the print half, and what a walk of the print reads. */
export async function buildLienServeRun(run: Pick<LienServeRun, 'ready' | 'held'>, bytesOf: (filingId: string) => Uint8Array | null | undefined, opts: { letter: boolean; letterhead?: FilingDocExtras['letterhead']; todayYmd: string; autoPrint?: boolean }) {
  const missing: Array<{ key: string; reason: string }> = []
  const jobs: LienServePdfJob[] = []
  for (const r of run.ready) {
    const bytes = bytesOf(r.job.filing.id)
    if (!bytes) {
      missing.push({ key: r.job.filing.id, reason: 'its stamped copy was not read' })
      continue
    }
    const letters = lienServeLetters(r.facts, { letter: opts.letter && r.letter, letterhead: opts.letterhead })
    const envelopes: Array<{ letter: Blob | null }> = []
    for (const e of r.envelopes) {
      const letter = letters.find((l) => l.recipient === e.recipient)
      envelopes.push({ letter: letter ? await filingDocPdfBlob(letter.blocks, { fit: 'one-page' }) : null })
    }
    jobs.push({ key: r.job.filing.id, title: lienServedCopySentTitle(r.job.jobNumber), envelopes, copy: { kind: r.file.kind, bytes } })
  }
  const byKey = new Map(run.ready.map((r) => [r.job.filing.id, r]))
  const notPrintedOf = (failed: ReadonlyArray<{ key: string; reason: string }>) => [...missing, ...failed].flatMap((f) => (byKey.get(f.key) ? [{ job: byKey.get(f.key)!.job, reason: f.reason }] : []))
  const out = await buildLienServeStackPdf({
    jobs,
    title: jobs.length === 1 ? (jobs[0]?.title ?? 'Copies of filed lien affidavits') : `Copies of ${jobs.length} filed lien affidavits`,
    autoPrint: opts.autoPrint,
    sheet: (failed) => {
      const out = new Set([...missing, ...failed].map((f) => f.key))
      return lienServeMailSheet({ ready: run.ready.filter((r) => !out.has(r.job.filing.id)), held: run.held }, { printedOn: demandDate(opts.todayYmd), letter: opts.letter, notPrinted: notPrintedOf(failed), from: lienServeReturnAddress(opts.letterhead) })
    },
  })
  return { ...out, ready: out.jobs.map((j) => ({ ...j, ready: byKey.get(j.key)! })), notPrinted: notPrintedOf(out.failed) }
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Print the run. Call it inside the click: the tab must open before the first wait. The run goes on past a lien whose
 * papers cannot be put together and names it with its reason.
 */
export async function printLienServeRun(run: Pick<LienServeRun, 'ready' | 'held'>, bytesOf: (filingId: string) => Uint8Array | null | undefined, opts: { letter: boolean; letterhead?: FilingDocExtras['letterhead']; todayYmd: string }, file: typeof fileSentCopy = fileSentCopy): Promise<LienServePrintResult> {
  const win = window.open('', '_blank')
  if (!win) return { how: 'blocked' }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(LIEN_SERVE_PRINT_WORDS.building)}</title></head><body style="font:14px system-ui,sans-serif;margin:2rem;color:#4b5563">${escapeHtml(LIEN_SERVE_PRINT_WORDS.building)}</body></html>`)
  win.document.close()
  try {
    const built = await buildLienServeRun(run, bytesOf, { ...opts, autoPrint: true })
    if (!built.stack) {
      win.close()
      return { how: 'failed', reason: LIEN_SERVE_PRINT_WORDS.nothing, notPrinted: built.notPrinted }
    }
    const url = URL.createObjectURL(built.stack)
    win.location.href = url
    window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000)
    // A print counts as a send (docs/SENT_COPIES.md): each job keeps its own papers, never the mail sheet.
    for (const j of built.ready) {
      const r = j.ready
      void file(
        {
          kind: LIEN_SERVED_COPY_SENT_KIND,
          title: lienServedCopySentTitle(r.job.jobNumber),
          how: 'print',
          jobIds: [r.job.jobId],
          recipientName: r.envelopes[0]?.name ?? '',
          source: { table: 'job_lien_filings', id: r.job.filing.id },
          sourceSnapshot: lienStampedPrintSnapshot({ fileId: r.copy.fileId, file: r.file, envelopes: r.envelopes.length, letter: opts.letter && r.letter }),
        },
        { blob: j.blob, fileName: lienStampedPrintFileName(r.job.jobNumber), contentType: 'application/pdf' },
      )
    }
    return { how: 'opened', printed: built.ready.map((j) => ({ jobId: j.ready.job.jobId, filingId: j.ready.job.filing.id })), notPrinted: built.notPrinted }
  } catch (e) {
    win.close()
    return { how: 'failed', reason: formatErrorMessage(e, LIEN_SERVE_PRINT_WORDS.nothing), notPrinted: [] }
  }
}
