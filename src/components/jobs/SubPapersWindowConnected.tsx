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
 * Send is the card's next step, so the view is handed no `onSend`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PaperCompany, PaperContext, StatementRange } from '../../../supabase/functions/_shared/subPapers'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import { fileSentCopy, printPdfAndFile } from '../../lib/sent/sentCopiesIo'
import { saveBlobAs } from '../../lib/storageSave'
import { supabase } from '../../lib/supabase'
import type { SubLaborSheetAssignee } from '../../lib/subLaborOutstanding'
import type { NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/rosterSub'
import { mintRefusal, mintSubPaperArgs, mintedFrom, numberedSubPaper, subPaperRegister, SUB_PAPER_ROW_COLUMNS, type SubPaperRow } from '../../lib/subWorkOrders/subPaperRegister'
import { paperPreparedAt, paperSheetsFor } from '../../lib/subWorkOrders/subPapersInputs'
import { drawSubPaperPdf } from '../../lib/subWorkOrders/subPaperPdfDraw'
import { subPaperAttachmentName, subPaperTitle, SUB_PAPER_SENT_KIND, type SubPaper } from '../../lib/subWorkOrders/subPaperSend'
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
  onClose: () => void
}

/** Nobody is sent a paper from this window yet, so it reads no address. */
const NO_CONTACT: SubPaperContact = { email: null, phone: null, portalUrl: null }

export function SubPapersWindow({ open, subKey, name, laborJobs, assigneesByJobId, namesByJobId, roster, rule, onClose }: SubPapersWindowProps) {
  const { role } = useAuth()
  const personId = subKey.startsWith('id:') ? subKey.slice(3) : null
  const [company, setCompany] = useState<PaperCompany | null>(null)
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
      if (cancelled) return
      const issuer = getPhysicalInvoiceIssuerForDocument()
      setCompany({ name: issuer.companyName || 'Our company', lines: [issuer.addressText.replace(/\n+/g, ', '), issuer.phone, issuer.email].map((l) => (l ?? '').trim()).filter(Boolean) })
    })()
    return () => {
      cancelled = true
    }
  }, [role])

  const loadRegister = useCallback(async () => {
    if (personId) {
      const { data, error } = await supabase.from('sub_papers').select(SUB_PAPER_ROW_COLUMNS).eq('person_id', personId)
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
    const { data, error } = await supabase.rpc('mint_sub_paper', mintSubPaperArgs(paper, personId, range) as never)
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
      contact={NO_CONTACT}
      lastStatement={rows === null ? undefined : register.lastStatement}
      paymentRecords
      canSend={false}
      busy={busy}
      said={said}
      onClose={onClose}
      onDownload={(paper, range) => {
        setBusy('Making the PDF…')
        setSaid(null)
        void (async () => {
          try {
            const made = await make(paper, range)
            const blob = await drawSubPaperPdf(made, range)
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
              return { blob: await drawSubPaperPdf(made, range), fileName: subPaperAttachmentName(made) }
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
