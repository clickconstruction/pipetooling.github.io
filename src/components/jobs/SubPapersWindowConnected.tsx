/**
 * The papers window on real rows (punch list #350): it picks one person's sheets by the rule every sub screen uses,
 * reads the letterhead from Settings, the person's email and phone from the roster and the register's numbers, and
 * hands `SubPapersWindowView` the three acts.
 *
 *  - Download and Print draw the PDF here with pdf-lib and file a sent copy, as the hours statement does.
 *  - Send posts the PDFs to `send-sub-paper-email`, which sends them and files the copies on the sub and each job.
 *
 * The register (`sub_papers`, migration `…_sub_papers.sql`) may not be pushed yet. A refused read means no paper has
 * a number: each carries the day and time it was prepared in its foot.
 */
import { useEffect, useMemo, useState } from 'react'
import type { PdfLibLike } from '../../../supabase/functions/_shared/jobContractPdf'
import type { PaperCompany, PaperContext, StatementRange } from '../../../supabase/functions/_shared/subPapers'
import { buildPaymentRecordPdf, buildStatementOfAccountPdf, buildWorkStatementPdf } from '../../../supabase/functions/_shared/subPapersPdf'
import { supabase } from '../../lib/supabase'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import { fileSentCopy, printPdfAndFile } from '../../lib/sent/sentCopiesIo'
import { saveBlobAs } from '../../lib/storageSave'
import type { SubLaborSheetAssignee } from '../../lib/subLaborOutstanding'
import type { NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/rosterSub'
import { paperPreparedAt, paperSheetsFor, type PaperRegisterRow } from '../../lib/subWorkOrders/subPapersInputs'
import { subPaperAttachmentName, subPaperTitle, SUB_PAPER_SENT_KIND, type SubPaper, type SubPaperSendBy, type SubPaperSendPlan } from '../../lib/subWorkOrders/subPaperSend'
import type { TeamSheetRule } from '../../lib/subWorkOrders/teamSheetRule'
import type { LaborJob } from '../../types/laborJob'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useAuth } from '../../hooks/useAuth'
import { SubPapersWindowView, type SubPaperContact, type SubPapersOpen } from './SubPapersWindow'

/** The roles who see sub pay today: they make, download and send. */
const CAN_SEND = new Set(['dev', 'master_technician', 'assistant', 'controller'])

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
  startOnSend?: boolean
  onClose: () => void
}

async function drawPdf(paper: SubPaper, range: StatementRange): Promise<Blob> {
  const lib = (await import('pdf-lib')) as unknown as PdfLibLike
  const bytes = paper.kind === 'statement_of_account' ? await buildStatementOfAccountPdf(lib, paper, range) : paper.kind === 'work_statement' ? await buildWorkStatementPdf(lib, paper) : await buildPaymentRecordPdf(lib, paper)
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

async function blobBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function SubPapersWindow({ open, subKey, name, laborJobs, assigneesByJobId, namesByJobId, roster, rule, startOnSend, onClose }: SubPapersWindowProps) {
  const { role, readOnly } = useAuth()
  const personId = subKey.startsWith('id:') ? subKey.slice(3) : null
  const [company, setCompany] = useState<PaperCompany | null>(null)
  const [contact, setContact] = useState<SubPaperContact>({ email: null, phone: null, portalUrl: null })
  const [register, setRegister] = useState<Map<string, PaperRegisterRow>>(new Map())
  const [lastStatement, setLastStatement] = useState<{ number: string; endedOn: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [said, setSaid] = useState<{ tone: 'ok' | 'bad'; words: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await fetchPhysicalInvoiceIssuerFromAppSettings({ authRole: role }).catch(() => null)
      const issuer = getPhysicalInvoiceIssuerForDocument()
      const person = personId ? await supabase.from('people').select('email, phone').eq('id', personId).maybeSingle() : { data: null }
      // The register: a refused read means it is not pushed yet, and no paper has a number.
      const reg = personId ? await supabase.from('sub_papers' as never).select('kind, number, revision, labor_job_id, period_to, issued_at, replaced_by').eq('person_id', personId) : { data: null }
      if (cancelled) return
      setCompany({ name: issuer.companyName || 'Our company', lines: [issuer.addressText.replace(/\n+/g, ', '), issuer.phone, issuer.email].map((l) => (l ?? '').trim()).filter(Boolean) })
      const p = (person.data ?? null) as { email: string | null; phone: string | null } | null
      setContact({ email: p?.email?.trim() || null, phone: p?.phone?.trim() || null, portalUrl: null })
      const rows = ((reg as { data: unknown[] | null }).data ?? []) as Array<{ kind: string; number: string; revision: number; labor_job_id: string | null; period_to: string | null; issued_at: string; replaced_by: string | null }>
      const map = new Map<string, PaperRegisterRow>()
      for (const r of rows) if (r.kind === 'work_statement' && r.labor_job_id && !r.replaced_by) map.set(r.labor_job_id, { number: r.number, revision: r.revision })
      setRegister(map)
      const sa = rows.filter((r) => r.kind === 'statement_of_account' && r.period_to).sort((a, b) => (a.period_to! < b.period_to! ? 1 : -1))[0]
      setLastStatement(sa ? { number: sa.number, endedOn: sa.period_to! } : null)
    })()
    return () => {
      cancelled = true
    }
  }, [personId, role])

  const sheets = useMemo(() => paperSheetsFor(subKey, laborJobs, assigneesByJobId, namesByJobId, roster, { rule, register }), [subKey, laborJobs, assigneesByJobId, namesByJobId, roster, rule, register])
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
      contact={contact}
      lastStatement={lastStatement}
      canSend={!readOnly && role != null && CAN_SEND.has(role)}
      startOnSend={startOnSend}
      busy={busy}
      said={said}
      onClose={onClose}
      onDownload={(paper, range) => {
        setBusy('Making the PDF…')
        setSaid(null)
        void drawPdf(paper, range)
          .then((blob) => {
            const fileName = subPaperAttachmentName(paper)
            saveBlobAs(blob, fileName)
            void fileSentCopy({ ...filingOf(paper), how: 'download' }, { blob, fileName, contentType: 'application/pdf' })
            setSaid({ tone: 'ok', words: `${fileName} is downloaded, and a copy is filed under Sent copies.` })
          })
          .catch((e) => setSaid({ tone: 'bad', words: `The PDF could not be made: ${formatErrorMessage(e, 'no reason was given')}` }))
          .finally(() => setBusy(null))
      }}
      onPrint={(paper, range) => {
        setSaid(null)
        void printPdfAndFile(async () => ({ blob: await drawPdf(paper, range), fileName: subPaperAttachmentName(paper) }), filingOf(paper), `Making ${subPaperAttachmentName(paper)}…`).then((r) => {
          if (r === 'blocked') setSaid({ tone: 'bad', words: 'The browser blocked the print tab. Allow pop-ups for this site, or use Download the PDF.' })
          if (r === 'failed') setSaid({ tone: 'bad', words: 'The PDF could not be made.' })
        })
      }}
      onSend={(plan: SubPaperSendPlan, papers: SubPaper[], by: SubPaperSendBy, range) => {
        if (by === 'link') {
          void navigator.clipboard?.writeText(contact.portalUrl ?? '').then(() => setSaid({ tone: 'ok', words: 'The link is copied.' }))
          return
        }
        setBusy('Sending…')
        setSaid(null)
        void (async () => {
          try {
            const files = by === 'email' ? await Promise.all(papers.map(async (p) => ({ kind: SUB_PAPER_SENT_KIND[p.kind], number: p.number, title: subPaperTitle(p), file_name: subPaperAttachmentName(p), job_ids: jobIdsOf(p), pdf_base64: await blobBase64(await drawPdf(p, range)) }))) : []
            const { data, error } = await supabase.functions.invoke('send-sub-paper-email', { body: { person_id: personId, by, to_email: contact.email, to_phone: contact.phone, subject: plan.subject, message: by === 'email' ? plan.body : plan.text, papers: files } })
            if (error) throw error
            const reason = (data as { error?: string } | null)?.error
            if (reason) throw new Error(reason)
            setSaid({ tone: 'ok', words: `${plan.confirmLabel?.replace(/^Send/, 'Sent').replace(/^Text a link to/, 'Texted a link to')} to ${name}. The copies are under Sent copies.` })
          } catch (e) {
            setSaid({ tone: 'bad', words: `Nothing was sent: ${formatErrorMessage(e, 'the send function gave no reason')}` })
          } finally {
            setBusy(null)
          }
        })()
      }}
    />
  )
}

export default SubPapersWindow
