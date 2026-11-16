/**
 * The papers window on real rows (punch list #350): it picks one person's sheets by the rule every sub screen uses,
 * reads the letterhead from Settings and hands `SubPapersWindowView` its acts.
 *
 * Download and Print draw the PDF here with pdf-lib and file a sent copy, as the hours statement does.
 *
 * No paper has a number yet: each carries the day and time it was prepared in its foot. The numbers, the payment
 * record's press and Send are the card's next steps, so the view is handed no register, no `paymentRecords` and no
 * `onSend`.
 */
import { useEffect, useMemo, useState } from 'react'
import type { PdfLibLike } from '../../../supabase/functions/_shared/jobContractPdf'
import type { PaperCompany, PaperContext, StatementRange } from '../../../supabase/functions/_shared/subPapers'
import { buildPaymentRecordPdf, buildStatementOfAccountPdf, buildWorkStatementPdf } from '../../../supabase/functions/_shared/subPapersPdf'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import { fileSentCopy, printPdfAndFile } from '../../lib/sent/sentCopiesIo'
import { saveBlobAs } from '../../lib/storageSave'
import type { SubLaborSheetAssignee } from '../../lib/subLaborOutstanding'
import type { NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/rosterSub'
import { paperPreparedAt, paperSheetsFor } from '../../lib/subWorkOrders/subPapersInputs'
import { subPaperAttachmentName, subPaperTitle, SUB_PAPER_SENT_KIND, type SubPaper } from '../../lib/subWorkOrders/subPaperSend'
import type { TeamSheetRule } from '../../lib/subWorkOrders/teamSheetRule'
import type { LaborJob } from '../../types/laborJob'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useAuth } from '../../hooks/useAuth'
import { SubPapersWindowView, type SubPaperContact, type SubPapersOpen } from './SubPapersWindow'

export type SubPapersWindowProps = {
  open: SubPapersOpen
  /** `id:<people id>`: whose papers. */
  subKey: string
  name: string
  laborJobs: readonly LaborJob[]
  assigneesByJobId: ReadonlyMap<string, readonly SubLaborSheetAssignee[]>
  namesByJobId: Record<string, string>
  roster: readonly NeedsWorkOrderRosterPerson[]
  rule: TeamSheetRule
  onClose: () => void
}

/** Nobody is sent a paper from this window yet, so it reads no address. */
const NO_CONTACT: SubPaperContact = { email: null, phone: null, portalUrl: null }

async function drawPdf(paper: SubPaper, range: StatementRange): Promise<Blob> {
  const lib = (await import('pdf-lib')) as unknown as PdfLibLike
  const bytes = paper.kind === 'statement_of_account' ? await buildStatementOfAccountPdf(lib, paper, range) : paper.kind === 'work_statement' ? await buildWorkStatementPdf(lib, paper) : await buildPaymentRecordPdf(lib, paper)
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export function SubPapersWindow({ open, subKey, name, laborJobs, assigneesByJobId, namesByJobId, roster, rule, onClose }: SubPapersWindowProps) {
  const { role } = useAuth()
  const personId = subKey.startsWith('id:') ? subKey.slice(3) : null
  const [company, setCompany] = useState<PaperCompany | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [said, setSaid] = useState<{ tone: 'ok' | 'bad'; words: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // The letterhead is the bill's own block from Settings. A read that fails leaves the draft's defaults.
      await fetchPhysicalInvoiceIssuerFromAppSettings({ authRole: role }).catch(() => null)
      if (cancelled) return
      const issuer = getPhysicalInvoiceIssuerForDocument()
      setCompany({ name: issuer.companyName || 'Our company', lines: [issuer.addressText.replace(/\n+/g, ', '), issuer.phone, issuer.email].map((l) => (l ?? '').trim()).filter(Boolean) })
    })()
    return () => {
      cancelled = true
    }
  }, [role])

  const sheets = useMemo(() => paperSheetsFor(subKey, laborJobs, assigneesByJobId, namesByJobId, roster, { rule }), [subKey, laborJobs, assigneesByJobId, namesByJobId, roster, rule])
  const ctx = useMemo<PaperContext | null>(() => (company ? { company, sub: { name, lines: [] }, today: todayYmdInAppTz(), preparedAt: paperPreparedAt(new Date(), APP_CALENDAR_TZ), zone: 'Central time' } : null), [company, name])
  const jobIdsOf = (paper: SubPaper): string[] => {
    const ids = paper.kind === 'work_statement' ? [paper.sheetId] : paper.kind === 'payment_record' ? paper.applied.map((a) => a.sheetId) : paper.rows.map((r) => r.sheetId)
    return [...new Set(ids.map((id) => laborJobs.find((j) => j.id === id)?.job_ledger_id ?? '').filter(Boolean))]
  }
  const filingOf = (paper: SubPaper) => ({ kind: SUB_PAPER_SENT_KIND[paper.kind], title: subPaperTitle(paper), recipientName: name, personId, jobIds: jobIdsOf(paper), source: paper.kind === 'work_statement' ? { table: 'people_labor_jobs', id: paper.sheetId } : null })

  if (!ctx) return null
  return (
    <SubPapersWindowView
      open={open}
      sheets={sheets}
      ctx={ctx}
      contact={NO_CONTACT}
      canSend={false}
      busy={busy}
      said={said}
      onClose={onClose}
      onDownload={(paper, range) => {
        setBusy('Making the PDF…')
        setSaid(null)
        void (async () => {
          try {
            const blob = await drawPdf(paper, range)
            const fileName = subPaperAttachmentName(paper)
            saveBlobAs(blob, fileName)
            const filed = await fileSentCopy({ ...filingOf(paper), how: 'download' }, { blob, fileName, contentType: 'application/pdf' })
            setSaid(filed ? { tone: 'ok', words: `${fileName} is downloaded, and a copy is filed under Documents → Sent copies.` } : { tone: 'bad', words: `${fileName} is downloaded. The copy could not be filed under Documents → Sent copies.` })
          } catch (e) {
            setSaid({ tone: 'bad', words: `The PDF could not be made: ${formatErrorMessage(e, 'no reason was given')}` })
          } finally {
            setBusy(null)
          }
        })()
      }}
      onPrint={(paper, range) => {
        setSaid(null)
        void printPdfAndFile(async () => ({ blob: await drawPdf(paper, range), fileName: subPaperAttachmentName(paper) }), filingOf(paper), `Making ${subPaperAttachmentName(paper)}…`).then((r) => {
          if (r === 'blocked') setSaid({ tone: 'bad', words: 'The browser blocked the print tab. Allow pop-ups for this site, or use Download the PDF.' })
          if (r === 'failed') setSaid({ tone: 'bad', words: 'The PDF could not be made.' })
        })
      }}
    />
  )
}

export default SubPapersWindow
