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
 * keeps each paper as a sent copy on the person and its jobs. The window shows that address before the press and
 * hands the function none: the function reads the roster again itself. The papers of one email are registered as a
 * set (`registerSubPaperSet`), so the statement names each work statement by the number on the file beside it.
 * Email is the one way built, so the view is handed `sendBy` with email alone. The office roles who see sub pay
 * may send, and an account in training may not. The subject is built again from the lead paper as numbered, so a
 * sheet's first work statement goes out under a subject that names the number on its file.
 *
 * A payment record says whether the sub marked it received: the window reads this person's Got it marks
 * (`sub_paper_acks`) before it draws, and hands them to the view and to the set that is made. A read that fails
 * leaves every record at *Not marked yet*, and the view says it could not tell.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PaperCompany, PaperContext, StatementRange } from '../../../supabase/functions/_shared/subPapers'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import { fileSentCopy, printPdfAndFile } from '../../lib/sent/sentCopiesIo'
import { saveBlobAs } from '../../lib/storageSave'
import { isOfficeRole } from '../../lib/doorRoles'
import { FunctionsHttpError } from '@supabase/functions-js'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { supabase } from '../../lib/supabase'
import type { SubLaborSheetAssignee } from '../../lib/subLaborOutstanding'
import type { NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/rosterSub'
import { mintRefusal, mintSubPaperArgs, mintedFrom, registerSubPaperSet, subPaperRegister, SUB_PAPER_ROW_COLUMNS, type MintedSubPaper, type SubPaperRow } from '../../lib/subWorkOrders/subPaperRegister'
import { NO_SUB_PAPER_ANSWERS, paymentRecordReceived, subPaperAnswers, SUB_PAPER_ACK_COLUMNS_BEFORE_ANSWERED, type SubPaperAckRow } from '../../lib/subWorkOrders/subPaperAnswers'
import { paperPreparedAt, paperSheetsFor } from '../../lib/subWorkOrders/subPapersInputs'
import { drawSubPaperPdf } from '../../lib/subWorkOrders/subPaperPdfDraw'
import { subPaperAttachmentName, subPaperEmailDoor, subPaperNotSentWords, subPaperSendSubject, subPaperSendUnknownWords, subPaperSentWords, subPaperTitle, SUB_PAPER_SENT_KIND, type SubPaper, type SubPaperSendBy } from '../../lib/subWorkOrders/subPaperSend'
import type { TeamSheetRule } from '../../lib/subWorkOrders/teamSheetRule'
import type { LaborJob } from '../../types/laborJob'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { ROSTER_EMAIL_NOT_KEPT } from '../../lib/subWorkOrders/subPaperRosterEmail'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useAuth } from '../../hooks/useAuth'
import { SubPapersWaiting, SubPapersWindowView, type SubPaperContact, type SubPapersOpen } from './SubPapersWindow'

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
/** A texted link is not built, so email is the one way a paper goes. */
const SEND_BY: readonly SubPaperSendBy[] = ['email']

/**
 * A file as the base64 an email attachment is: read as a data URL, with its prefix taken off. A FileReader, since
 * the test page's Blob has no `arrayBuffer` for the shared `blobToBase64` to read.
 */
function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('The PDF could not be read.'))
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.readAsDataURL(blob)
  })
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
  /** This person's Got it marks from their page. Null while they are not read, or where the read failed. */
  const [acks, setAcks] = useState<SubPaperAckRow[] | null>(null)
  /** The window waits for the marks too: a payment record drawn ahead of them would say *Not marked yet* and be made so. */
  const [marksRead, setMarksRead] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [said, setSaid] = useState<{ tone: 'ok' | 'bad'; words: string } | null>(null)
  /** A send is under way. A ref, since a second click can land before the dead press is drawn, and a paper must not go twice. */
  const sending = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // The letterhead is the bill's own block from Settings. A read that fails leaves the draft's defaults.
      await fetchPhysicalInvoiceIssuerFromAppSettings({ authRole: role }).catch(() => null)
      // The roster's own address: the send step shows where a paper will go, and the function reads it again itself.
      const person = personId ? await supabase.from('people').select('email, phone, account_user_id').eq('id', personId).maybeSingle() : { data: null, error: null }
      if (cancelled) return
      const p = (person.data ?? null) as { email: string | null; phone: string | null; account_user_id: string | null } | null
      // A sub with no address on the roster may sign in with one. It is offered on the To line, never sent to unasked,
      // so a read that fails only leaves the offer out.
      const login = p && !p.email?.trim() && p.account_user_id ? await supabase.from('users').select('email').eq('id', p.account_user_id).maybeSingle() : { data: null }
      if (cancelled) return
      const loginEmail = ((login.data ?? null) as { email: string | null } | null)?.email?.trim() || null
      // A read that failed is not a sub with no email: the step then names the roster's address without quoting it.
      setContact({ email: p?.email?.trim() || null, phone: p?.phone?.trim() || null, portalUrl: null, emailUnread: !!person.error, loginEmail })
      const issuer = getPhysicalInvoiceIssuerForDocument()
      setCompany({ name: issuer.companyName || 'Our company', lines: [issuer.addressText.replace(/\n+/g, ', '), issuer.phone, issuer.email].map((l) => (l ?? '').trim()).filter(Boolean) })
    })()
    return () => {
      cancelled = true
    }
  }, [role, personId])

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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // The marks alone: the notes a sub sent are the Pay view's to show. The older columns do, so one read serves every database.
      const read = personId ? await supabase.from('sub_paper_acks').select(SUB_PAPER_ACK_COLUMNS_BEFORE_ANSWERED).eq('person_id', personId) : { data: [], error: null }
      if (cancelled) return
      setAcks(read.error ? null : ((read.data ?? []) as unknown as SubPaperAckRow[]))
      setMarksRead(true)
    })()
    return () => {
      cancelled = true
    }
  }, [personId])
  const answers = useMemo(() => (acks && acks.length > 0 ? subPaperAnswers(acks, (iso) => calendarYmdInAppTzFromIso(iso)) : NO_SUB_PAPER_ANSWERS), [acks])

  // Today is handed in, so a statement made today does not start *Since the last statement* tomorrow.
  const register = useMemo(() => subPaperRegister(rows ?? [], (iso) => calendarYmdInAppTzFromIso(iso).slice(0, 10), todayYmdInAppTz()), [rows])
  const sheets = useMemo(() => paperSheetsFor(subKey, laborJobs, assigneesByJobId, namesByJobId, roster, { rule, register: register.bySheet }), [subKey, laborJobs, assigneesByJobId, namesByJobId, roster, rule, register])
  const ctx = useMemo<PaperContext | null>(() => (company ? { company, sub: { name, lines: [] }, today: todayYmdInAppTz(), preparedAt: paperPreparedAt(new Date(), APP_CALENDAR_TZ), zone: 'Central time' } : null), [company, name])
  const jobIdsOf = (paper: SubPaper): string[] => {
    const ids = paper.kind === 'work_statement' ? [paper.sheetId] : paper.kind === 'payment_record' ? paper.applied.map((a) => a.sheetId) : paper.rows.map((r) => r.sheetId)
    return [...new Set(ids.map((id) => laborJobs.find((j) => j.id === id)?.job_ledger_id ?? '').filter(Boolean))]
  }
  const filingOf = (paper: SubPaper) => ({ kind: SUB_PAPER_SENT_KIND[paper.kind], title: subPaperTitle(paper), recipientName: name, personId, jobIds: jobIdsOf(paper), source: paper.kind === 'work_statement' ? { table: 'people_labor_jobs', id: paper.sheetId } : null })

  // The window's frame while the letterhead, the register and the marks are read, so the press is seen to have opened something.
  if (!ctx || !registerRead || !marksRead) return <SubPapersWaiting name={name} onClose={onClose} />
  /** Register one paper. Null where the register did not answer with a paper; throws the register's reason when it refuses. */
  const mint = async (paper: SubPaper, range: StatementRange): Promise<MintedSubPaper | null> => {
    if (!personId) return null
    const { data, error } = await supabase.rpc('mint_sub_paper', mintSubPaperArgs(paper, personId, range) as never)
    if (error) {
      const refusal = mintRefusal(error)
      // A database the migration has not reached: the paper goes out as it did before numbers, with no number.
      if (refusal.missing) return null
      throw new Error(refusal.words)
    }
    return mintedFrom(data)
  }
  /** Register the papers that go out together, then hand each back as it reads under its number, in the order given. */
  const makeSet = async (papers: readonly SubPaper[], range: StatementRange): Promise<SubPaper[]> => {
    try {
      return await registerSubPaperSet(papers, { mint: (p) => mint(p, range), sheets, ctx, range, register, received: (key) => paymentRecordReceived(answers, key) })
    } finally {
      // Read again even after a refusal part way: a work statement registered ahead of it keeps its number.
      void loadRegister()
    }
  }
  const make = async (paper: SubPaper, range: StatementRange): Promise<SubPaper> => (await makeSet([paper], range))[0] ?? paper
  const maySend = !readOnly && isOfficeRole(role) && !!personId
  /**
   * The To line's save: the address goes onto the person's roster row, where the function reads it. The office
   * roles who send may write that row. A save that comes back with no row changed nothing, and says so.
   */
  const keepEmail = async (email: string): Promise<void> => {
    if (!personId) throw new Error(ROSTER_EMAIL_NOT_KEPT)
    const { data, error } = await supabase.from('people').update({ email }).eq('id', personId).select('email').maybeSingle()
    if (error) throw new Error(formatErrorMessage(error))
    const kept = ((data ?? null) as { email: string | null } | null)?.email?.trim()
    if (!kept) throw new Error(ROSTER_EMAIL_NOT_KEPT)
    setContact((c) => ({ ...c, email: kept, emailUnread: false }))
  }
  return (
    <SubPapersWindowView
      open={open}
      sheets={sheets}
      ctx={ctx}
      contact={contact}
      lastStatement={rows === null ? undefined : register.lastStatement}
      statementToday={rows === null ? undefined : register.statementToday}
      paymentRecords
      answers={answers}
      marksUnread={acks === null}
      canSend={maySend}
      sendBy={SEND_BY}
      emailDoor={subPaperEmailDoor(maySend)}
      onKeepEmail={keepEmail}
      startOnSend={startOnSend}
      onSend={async (plan, papers, by, sendRange) => {
        if (by !== 'email' || !personId || sending.current) return false
        sending.current = true
        setBusy('Sending…')
        setSaid(null)
        let made: SubPaper[] = []
        try {
          // Each paper is registered before it is drawn, so every file goes out under its number.
          made = await makeSet(papers, sendRange)
          // Only the registering needs an order: the PDFs are drawn together.
          const files = await Promise.all(made.map(async (p) => ({ kind: SUB_PAPER_SENT_KIND[p.kind], number: p.number, title: subPaperTitle(p), file_name: subPaperAttachmentName(p), job_ids: jobIdsOf(p), pdf_base64: await blobBase64(await drawSubPaperPdf(p, sendRange)) })))
          // The subject from the lead paper as numbered: a first work statement had no number when the step was drawn.
          const lead = made[0]
          const subject = lead ? subPaperSendSubject(lead, ctx.company.name, plan.part) : plan.subject
          // No address rides in the body: the function sends to the roster's own, read under the caller's policies.
          const { data, error } = await supabase.functions.invoke('send-sub-paper-email', { body: { person_id: personId, by, subject, message: plan.body, papers: files } })
          if (error) {
            // An answer with a refusal means nothing went. No answer at all means the email may have gone.
            if (!(error instanceof FunctionsHttpError)) {
              setSaid({ tone: 'bad', words: subPaperSendUnknownWords() })
              return false
            }
            throw new Error((await readEdgeFunctionErrorBody(error)) ?? formatErrorMessage(error, 'the send function gave no reason'))
          }
          const answer = (data ?? {}) as { error?: string; to?: string }
          if (answer.error) throw new Error(answer.error)
          setSaid({ tone: 'ok', words: subPaperSentWords({ count: made.length, subName: name, to: answer.to ?? null }) })
          return true
        } catch (e) {
          setSaid({ tone: 'bad', words: subPaperNotSentWords({ reason: formatErrorMessage(e, 'the send function gave no reason'), numbered: made }) })
          return false
        } finally {
          sending.current = false
          setBusy(null)
        }
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
