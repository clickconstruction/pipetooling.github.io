/**
 * The papers window on real rows (punch list #350): it picks one person's sheets by the rule every sub screen uses,
 * reads the letterhead from Settings and hands `SubPapersWindowView` its acts.
 *
 * Download and Print draw the PDF here with pdf-lib and file a sent copy, as the hours statement does.
 *
 * A paper is numbered the moment it is made. Print and Download first register it (`mint_sub_paper`), then draw
 * the PDF under the number the register answered: `WS-<job>-<n>` for a sheet, kept for good, with a revision when
 * its figures changed; `SA-<n>` for each statement of account; a payment record carries its sending's own
 * `PR-<n>`. A paper the register refuses is not made, and the window says why. Where the register is not on the
 * database yet, a paper is made with no number and its foot carries the day and time it was prepared.
 *
 * Send posts the PDFs to `send-sub-paper-email`, which mails them to the roster's own address for the person and
 * keeps each as a sent copy. Each paper is registered first, as for a print. Email is the one way built: a texted
 * link is not, so the view is handed `sendBy` with email alone. The office roles who see sub pay may send, and an
 * account in training may not.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PdfLibLike } from '../../../supabase/functions/_shared/jobContractPdf'
import type { PaperCompany, PaperContext, StatementRange } from '../../../supabase/functions/_shared/subPapers'
import { buildPaymentRecordPdf, buildStatementOfAccountPdf, buildWorkStatementPdf } from '../../../supabase/functions/_shared/subPapersPdf'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import { fileSentCopy, printPdfAndFile } from '../../lib/sent/sentCopiesIo'
import { saveBlobAs } from '../../lib/storageSave'
import { supabase } from '../../lib/supabase'
import type { SubLaborSheetAssignee } from '../../lib/subLaborOutstanding'
import type { NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/rosterSub'
import { mintRefusal, mintSubPaperArgs, mintedFrom, numberedSubPaper, subPaperRegister, SUB_PAPER_ROW_COLUMNS, type SubPaperRow } from '../../lib/subWorkOrders/subPaperRegister'
import { paperPreparedAt, paperSheetsFor } from '../../lib/subWorkOrders/subPapersInputs'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { subPaperAttachmentName, subPaperTitle, SUB_PAPER_SENT_KIND, type SubPaper, type SubPaperSendBy } from '../../lib/subWorkOrders/subPaperSend'
import type { TeamSheetRule } from '../../lib/subWorkOrders/teamSheetRule'
import type { LaborJob } from '../../types/laborJob'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
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
  /** Open on the send step (the window after Record payment does). */
  startOnSend?: boolean
  onClose: () => void
}

const NO_CONTACT: SubPaperContact = { email: null, phone: null, portalUrl: null }
/** The roles who see sub pay today: they make, download and send. */
const CAN_SEND = new Set(['dev', 'master_technician', 'assistant', 'controller'])
/** A texted link is not built, so email is the one way a paper goes. */
const SEND_BY: readonly SubPaperSendBy[] = ['email']

/** A file as the base64 an email attachment is: read as a data URL, with its prefix taken off. */
function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('The PDF could not be read.'))
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.readAsDataURL(blob)
  })
}

async function drawPdf(paper: SubPaper, range: StatementRange): Promise<Blob> {
  const lib = (await import('pdf-lib')) as unknown as PdfLibLike
  const bytes = paper.kind === 'statement_of_account' ? await buildStatementOfAccountPdf(lib, paper, range) : paper.kind === 'work_statement' ? await buildWorkStatementPdf(lib, paper) : await buildPaymentRecordPdf(lib, paper)
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export function SubPapersWindow({ open, subKey, name, laborJobs, assigneesByJobId, namesByJobId, roster, rule, startOnSend, onClose }: SubPapersWindowProps) {
  const { role, readOnly } = useAuth()
  const personId = subKey.startsWith('id:') ? subKey.slice(3) : null
  const [company, setCompany] = useState<PaperCompany | null>(null)
  const [contact, setContact] = useState<SubPaperContact>(NO_CONTACT)
  /** This person's rows in the register. Null while it is not read, or where the database does not have it yet. */
  const [rows, setRows] = useState<SubPaperRow[] | null>(null)
  /** The window waits for the first read: the period it opens on is *Since the last statement* when there is one. */
  const [registerRead, setRegisterRead] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [said, setSaid] = useState<{ tone: 'ok' | 'bad'; words: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // The letterhead is the bill's own block from Settings. A read that fails leaves the draft's defaults.
      await fetchPhysicalInvoiceIssuerFromAppSettings({ authRole: role }).catch(() => null)
      // The roster's own address: the send window shows where a paper will go, and the function reads it again itself.
      const person = personId ? await supabase.from('people').select('email, phone').eq('id', personId).maybeSingle() : { data: null }
      if (cancelled) return
      const p = (person.data ?? null) as { email: string | null; phone: string | null } | null
      setContact({ email: p?.email?.trim() || null, phone: p?.phone?.trim() || null, portalUrl: null })
      const issuer = getPhysicalInvoiceIssuerForDocument()
      setCompany({ name: issuer.companyName || 'Our company', lines: [issuer.addressText.replace(/\n+/g, ', '), issuer.phone, issuer.email].map((l) => (l ?? '').trim()).filter(Boolean) })
    })()
    return () => {
      cancelled = true
    }
  }, [role, personId])

  const loadRegister = useCallback(async () => {
    if (personId) {
      const { data, error } = await supabase.from('sub_papers' as never).select(SUB_PAPER_ROW_COLUMNS).eq('person_id', personId)
      setRows(error ? null : ((data ?? []) as unknown as SubPaperRow[]))
    }
    setRegisterRead(true)
  }, [personId])
  useEffect(() => {
    void loadRegister()
  }, [loadRegister])

  const register = useMemo(() => subPaperRegister(rows ?? [], (iso) => calendarYmdInAppTzFromIso(iso).slice(0, 10)), [rows])
  const sheets = useMemo(() => paperSheetsFor(subKey, laborJobs, assigneesByJobId, namesByJobId, roster, { rule, register: register.bySheet }), [subKey, laborJobs, assigneesByJobId, namesByJobId, roster, rule, register])
  const ctx = useMemo<PaperContext | null>(() => (company ? { company, sub: { name, lines: [] }, today: todayYmdInAppTz(), preparedAt: paperPreparedAt(new Date(), APP_CALENDAR_TZ), zone: 'Central time' } : null), [company, name])
  const jobIdsOf = (paper: SubPaper): string[] => {
    const ids = paper.kind === 'work_statement' ? [paper.sheetId] : paper.kind === 'payment_record' ? paper.applied.map((a) => a.sheetId) : paper.rows.map((r) => r.sheetId)
    return [...new Set(ids.map((id) => laborJobs.find((j) => j.id === id)?.job_ledger_id ?? '').filter(Boolean))]
  }
  const filingOf = (paper: SubPaper) => ({ kind: SUB_PAPER_SENT_KIND[paper.kind], title: subPaperTitle(paper), recipientName: name, personId, jobIds: jobIdsOf(paper), source: paper.kind === 'work_statement' ? { table: 'people_labor_jobs', id: paper.sheetId } : null })

  if (!ctx || !registerRead) return null
  /** Register the paper, then hand back the paper as it reads under its number. Throws the register's reason when it refuses. */
  const make = async (paper: SubPaper, range: StatementRange): Promise<SubPaper> => {
    if (!personId) return paper
    const { data, error } = await supabase.rpc('mint_sub_paper' as never, mintSubPaperArgs(paper, personId, range) as never)
    if (error) {
      const refusal = mintRefusal(error)
      // A database the migration has not reached: the paper goes out as it did before numbers, with no number.
      if (refusal.missing) return paper
      throw new Error(refusal.words)
    }
    const minted = mintedFrom(data)
    if (!minted) return paper
    void loadRegister()
    return numberedSubPaper(paper, minted, sheets, ctx, range, register)
  }
  return (
    <SubPapersWindowView
      open={open}
      sheets={sheets}
      ctx={ctx}
      contact={contact}
      lastStatement={rows === null ? undefined : register.lastStatement}
      paymentRecords
      canSend={!readOnly && role != null && CAN_SEND.has(role) && !!personId}
      sendBy={SEND_BY}
      startOnSend={startOnSend}
      onSend={(plan, papers, by, sendRange) => {
        if (by !== 'email' || !personId) return
        setBusy('Sending…')
        setSaid(null)
        void (async () => {
          try {
            // Each paper is registered before it goes, one after another, so a statement and its attachments take their numbers in order.
            const made: SubPaper[] = []
            for (const p of papers) made.push(await make(p, sendRange))
            const files = await Promise.all(made.map(async (p) => ({ kind: SUB_PAPER_SENT_KIND[p.kind], number: p.number, title: subPaperTitle(p), file_name: subPaperAttachmentName(p), job_ids: jobIdsOf(p), pdf_base64: await blobBase64(await drawPdf(p, sendRange)) })))
            const { data, error } = await supabase.functions.invoke('send-sub-paper-email', { body: { person_id: personId, by, subject: plan.subject, message: plan.body, papers: files } })
            if (error) throw new Error((await readEdgeFunctionErrorBody(error)) ?? formatErrorMessage(error, 'the send function gave no reason'))
            const answer = (data ?? {}) as { error?: string; to?: string }
            if (answer.error) throw new Error(answer.error)
            setSaid({ tone: 'ok', words: `Sent ${made.length} ${made.length === 1 ? 'paper' : 'papers'} to ${name}${answer.to ? ` at ${answer.to}` : ''}. ${made.length === 1 ? 'A copy is' : 'The copies are'} under Documents → Sent copies.` })
          } catch (e) {
            setSaid({ tone: 'bad', words: `Nothing was sent: ${formatErrorMessage(e, 'the send function gave no reason')}` })
          } finally {
            setBusy(null)
          }
        })()
      }}
      busy={busy}
      said={said}
      onClose={onClose}
      onDownload={(paper, range) => {
        setBusy('Making the PDF…')
        setSaid(null)
        void (async () => {
          try {
            const made = await make(paper, range)
            const blob = await drawPdf(made, range)
            const fileName = subPaperAttachmentName(made)
            saveBlobAs(blob, fileName)
            const filed = await fileSentCopy({ ...filingOf(made), how: 'download' }, { blob, fileName, contentType: 'application/pdf' })
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
        // The tab opens inside the click, so the paper is registered while it waits. The filing is read after the
        // PDF is built, and by then it names the paper under its number.
        const filing = filingOf(paper)
        let reason = ''
        void printPdfAndFile(
          async () => {
            try {
              const made = await make(paper, range)
              Object.assign(filing, filingOf(made))
              return { blob: await drawPdf(made, range), fileName: subPaperAttachmentName(made) }
            } catch (e) {
              reason = formatErrorMessage(e, 'no reason was given')
              throw e
            }
          },
          filing,
          `Making the ${paper.title.toLowerCase()}…`,
        ).then((r) => {
          if (r === 'blocked') setSaid({ tone: 'bad', words: 'The browser blocked the print tab. Allow pop-ups for this site, or use Download the PDF.' })
          if (r === 'failed') setSaid({ tone: 'bad', words: `The PDF could not be made${reason ? `: ${reason}` : '.'}` })
        })
      }}
    />
  )
}

export default SubPapersWindow
