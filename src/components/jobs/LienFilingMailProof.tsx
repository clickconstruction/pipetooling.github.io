import { useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import type { LienFilingDocument } from '../../lib/jobs/lienFilingDocumentLink'
import { LIEN_MAIL_PROOF_WORDS, lienMailProof, type LienMailProofCopy } from '../../lib/jobs/lienMailProof'
import { addRecordedMailedCopy } from '../../lib/jobs/lienMailProofIo'
import { lienMailedCopyAddedWords, lienMailedCopyProblem, parseLienMailedCopies, type LienMailedCopy } from '../../lib/jobs/lienMailedCopies'
import { keepLienCopyProof } from '../../lib/jobs/lienReceiptKeepIo'
import { parseLienSends } from '../../lib/jobs/lienSendTracking'
import LienMailProofBlock from './LienMailProofBlock'

/**
 * *What went out* for one recorded filing, with its writes (`lienMailProof.ts`): the block, a receipt added or taken
 * off written onto the filing's `sends` at once (`keepLienCopyProof`), and one more mailed file added to a notice
 * already recorded (`addRecordedMailedCopy`). What was just written shows at once, and the host reads again behind it.
 *
 * A reader who cannot edit sees the block with its links alone. An affidavit's stamped scan is changed from its own
 * press in the Filings list, so the block adds no file to an affidavit.
 */
export default function LienFilingMailProof({
  filing,
  item,
  jobId,
  jobNumber,
  hasContractor,
  isMobile,
  canEdit,
  userId,
  todayYmd,
  onChanged,
  bare,
  keep = keepLienCopyProof,
  addCopy = addRecordedMailedCopy,
}: {
  filing: Pick<JobLienFilingRow, 'id' | 'kind' | 'sends' | 'served_at' | 'filed_at'> & LienFilingDocument
  /** The notice's desk item and its mailed files as stored; null on a paper with no desk item. */
  item: { itemId: string; copies: unknown } | null
  jobId: string
  jobNumber: string
  /** Whether an affidavit's copy goes to an original contractor too. */
  hasContractor?: boolean
  isMobile?: boolean
  canEdit: boolean
  userId: string | null
  todayYmd: string
  onChanged: () => void
  bare?: boolean
  keep?: typeof keepLienCopyProof
  addCopy?: typeof addRecordedMailedCopy
}) {
  const { showToast } = useToastContext()
  // What this block just wrote, shown until the host's own read comes back with it.
  const [sendsNow, setSendsNow] = useState<unknown>(null)
  const [added, setAdded] = useState<LienMailedCopy[]>([])
  const [adding, setAdding] = useState(false)
  useEffect(() => setSendsNow(null), [filing.sends])
  useEffect(() => setAdded([]), [item?.copies, filing.document_url])

  const proof = useMemo(
    () =>
      lienMailProof({
        kind: filing.kind,
        sends: sendsNow ?? filing.sends,
        documentUrl: filing.document_url,
        documentNote: filing.document_note,
        mailedCopies: [...parseLienMailedCopies(item?.copies), ...added],
        servedAt: filing.served_at,
        hasContractor,
      }),
    [filing.kind, filing.sends, filing.document_url, filing.document_note, filing.served_at, sendsNow, item?.copies, added, hasContractor],
  )
  if (!proof) return null

  const day = parseLienSends(filing.sends).find((s) => s.sent_on)?.sent_on ?? filing.served_at ?? filing.filed_at ?? todayYmd

  const setReceipt = async (recipient: LienMailProofCopy, url: string) => {
    try {
      setSendsNow(await keep({ filingId: filing.id, recipient, proof: { receiptUrl: url } }))
      showToast(url ? LIEN_MAIL_PROOF_WORDS.receiptKept : LIEN_MAIL_PROOF_WORDS.receiptOff, 'success')
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, LIEN_MAIL_PROOF_WORDS.failed), 'error')
    }
  }

  const hasDocument = !!(filing.document_url ?? '').trim()
  const addFile = async (file: File) => {
    const problem = lienMailedCopyProblem(file)
    if (problem) {
      showToast(problem, 'error')
      return
    }
    setAdding(true)
    try {
      const out = await addCopy({ filingId: filing.id, itemId: item?.itemId ?? null, jobId, jobNumber, file, todayYmd, userId, paper: proof.paper === 'retainage' ? 'retainage' : 'notice', hasDocument })
      setAdded((cur) => [...cur, { url: out.url, driveFileId: '', name: out.name, at: '', by: userId }])
      showToast(lienMailedCopyAddedWords(out.name), 'success')
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, LIEN_MAIL_PROOF_WORDS.failed), 'error')
    } finally {
      setAdding(false)
    }
  }

  // A notice with no desk item keeps one file, its saved copy: once it has one there is nowhere to keep a second.
  const canAddFile = canEdit && proof.paper !== 'affidavit' && (!!item || (!hasDocument && added.length === 0))
  return (
    <LienMailProofBlock
      proof={proof}
      isMobile={isMobile}
      bare={bare}
      receipts={canEdit ? { jobId, jobNumber, day, onSet: (recipient, url) => void setReceipt(recipient, url) } : undefined}
      files={canAddFile ? { onAdd: (file) => void addFile(file), adding } : undefined}
    />
  )
}
