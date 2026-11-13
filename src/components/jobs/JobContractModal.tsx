/**
 * The Contract modal (Contract Desk PR 2): one place to send a job's
 * agreement and see where it stands. Lien-release modal rules: the draft
 * autosaves from the first real edit, Send is the gate that mints the link,
 * fields lock once sent, ✕ just closes. Opened from the Pipeline row chip
 * and the ✍ quick action (PR 3 adds the Job window row and the View bill strip).
 *
 * v2.4154 — the rail: one question (how this one gets signed), pre-picked from what the job knows,
 * one button whose label follows the pick, a sentence that says what it does, the two exits under
 * it; the status pill in the title bar.
 *
 * PR 2 — the paper is the form: the left column is the agreement as the customer sees it,
 * edited in place (JobContractPaper); no field grid and no preview button.
 *
 * v2.4183 — one window across states: a signed agreement (a contract we sent, a paper or link
 * record, an estimate or bid-room acceptance) shows here too — the paper as signed on the left,
 * the signed rail on the right — instead of the Signed agreement view. A history row's View
 * shows that row in place; Start a new agreement… turns the window back into a draft.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { usePromptDialog } from '../../contexts/ConfirmDialogContext'
import ResponsiveModalShell from '../ResponsiveModalShell'
import JobContractFileSheet from './JobContractFileSheet'
import StandardTermsEditModal from './StandardTermsEditModal'
import { reopenBlocker, reopenNote, reopenUnopenedJobContract } from '../../lib/jobs/jobContractReopen'
import JobContractSignedRail from './JobContractSignedRail'
import { RailGroup } from './ContractRailGroup'
import { useJobContractRecordUrls } from './JobContractRecordModal'
import { CustomerAcceptanceRecordBody, type EstimateRecordRow } from '../estimates/CustomerAcceptanceRecordBody'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { normalizeEstimateLineItemsFromJson } from '../../lib/estimateLineItemNormalize'
import { renderContractBodyToSafeHtml } from '../../lib/renderContractBodyToSafeHtml'
import { openHtmlPreviewWindow } from '../../lib/jobsDocuments/printWindow'
import { fetchContractDraftPdf, saveBytesAsFile } from '../../lib/jobs/contractDraftPdf'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import {
  buildJobContractDocumentHtml,
  buildJobContractPrefill,
  DEFAULT_JOB_CONTRACT_TERMS_PLAIN,
  EMPTY_JOB_CONTRACT_FIELDS,
  isGoogleDocsUrl,
  jobContractDatesUnfinished,
  jobContractUnfinishedDateBlocks,
  parseJobContractFields,
  type JobContractFields,
} from '../../lib/jobs/jobContractDocument'
import { draftHeldByDateMessage } from '../../lib/autosaveDateHold'
import { contractAmountDrift, contractAmountSource } from '../../lib/jobs/contractAmountSource'
import {
  formatContractStamp,
  jobContractChipColors,
  jobContractChips,
  jobContractIsEditable,
  jobContractIsLive,
  jobContractLinkOnRow,
  jobContractSignatureAuditLine,
  jobContractSignatureBlocks,
  jobContractSignersAuditLine,
  jobContractSigningUrl,
  jobContractStatus,
  type JobContractRow,
} from '../../lib/jobs/jobContractLifecycle'
import { isAwaitingPaperCopy, isHandedAwaitingPaper, jobContractSentChannel } from '../../lib/jobs/jobContractHandoff'
import { freshJobContractLink } from '../../lib/jobs/jobContractLinkHandOut'
import { CONTRACT_NOT_NEEDED_REASONS, type JobContractCoverage } from '../../lib/jobs/jobContractCoverage'
import { clearJobContractNotNeeded, markJobContractNotNeeded } from '../../lib/jobs/jobContractNotNeeded'
import { handoffBlocker, markJobContractHanded } from '../../lib/jobs/jobContractHandoff'
import { effectiveWindowWay, emailLooksValid, jobTakesTheirSubcontract, phoneLooksUsable, windowStatusPill, windowWayButton, windowWaysPlan, windowWaySentence, type PaperSend, type WindowWay } from '../../lib/jobs/contractWindowWays'
import JobContractSigningRail from './JobContractSigningRail'
import { ContractTextDoor } from './ContractTextDoor'
import { addNumberChipWords, contractSignTextWords, typedNumberOnContact } from '../../lib/jobs/contractTextDoor'
import { firstName, type Contact } from '../../lib/contacts/kernel'
import { jobBoxJobKey, jobBoxJobName } from '../../lib/messages/jobBox'
import { addContactPhone, loadCustomerContact } from '../../lib/messages/messagesIo'
import { supabaseReplyIo } from '../../lib/messages/replyIo'
import JobContractPaper from './JobContractPaper'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { filedOnPaper, frameAsSignerRow, framesLabel, framesProgress, signerFrames, signerNamesLine } from '../../lib/jobs/jobContractSigners'
import { isTheirPaperRow, theirPaperFromRow, theirPaperLine, theirPaperWords, type TheirPaperRecord } from '../../lib/jobs/theirPaper'
import TheirPaperSheet from './TheirPaperSheet'
import { theirPaperPayer } from '../../lib/jobs/theirPaperPayer'
import { payCalendarJobOf } from '../../lib/jobs/payCalendarJob'
import { DEFAULT_JOB_WARRANTY_TERMS_PLAIN, DEFAULT_WARRANTY_INITIAL_LINES, JOB_AGREEMENT_KINDS, JOB_AGREEMENT_WORDS, jobAgreementHeading, jobAgreementKindOf, parseInitials, type JobAgreementKind } from '../../lib/jobs/jobAgreementKind'

type TemplateRow = Pick<
  Database['public']['Tables']['contract_template_documents']['Row'],
  'id' | 'document_name' | 'book_body_html' | 'book_body_format' | 'book_version_date' | 'tags'
>

/** A Contract Book document tagged `warranty` is the warranty's terms; every other customer document is a contract's. */
const templateKind = (t: Pick<TemplateRow, 'tags'>): JobAgreementKind => ((t.tags ?? []).includes('warranty') ? 'warranty' : 'contract')

const BUILTIN_TEMPLATE_ID = '__builtin__'

export type JobContractModalProps = {
  open: boolean
  onClose: () => void
  job: JobWithDetails | null
  /** Fires after any send / void / record so the board can refresh its chips. */
  onChanged?: () => void
  /** Fires when the job row itself changed (Not needed answered or withdrawn, PR 0) — the caller reloads its jobs list. */
  onJobChanged?: () => void
  /** Open straight onto the File a signed contract sheet (PR 0c: the new-job door's "File the builder's subcontract"). */
  initialFilingOpen?: boolean
  /** v2.3707: the door beside the amount — the number is set on the job (its line items or the accepted estimate), never here. */
  onEditJob?: (job: JobWithDetails) => void
  /** v2.4183: the job's coverage when the caller has it — an estimate / bid-room acceptance shows as the signed state. */
  coverage?: JobContractCoverage | null
  /** v2.4183: open on this signed row (Documents → Jobs lists every contract). */
  initialRecordId?: string | null
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.4rem 0.55rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.85rem',
}
const sectionHead: React.CSSProperties = { font: '600 0.68rem/1.2 inherit', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '1rem 0 0.4rem' }
const btn: React.CSSProperties = {
  padding: '0.4rem 0.8rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
}
// border as the full shorthand, not borderColor over btn's border: the rail's buttons flip between btn and btnPrimary
// in place (armed ↔ plain), and React warns when a longhand is removed beside its shorthand on a persisting node.
const btnPrimary: React.CSSProperties = { ...btn, background: '#2563eb', border: '1px solid #2563eb', color: 'white' }

function dispatchChanged() {
  try {
    window.dispatchEvent(new Event('job-contract-changed'))
  } catch {
    /* non-browser */
  }
}

type SignedCoverage = Extract<JobContractCoverage, { kind: 'signed' }>
/** What the window shows when nothing is live: the signed row (ours or a filed record) or the acceptance behind the chip. */
type SignedView = { source: 'contract' | 'paper'; row: JobContractRow } | { source: 'estimate' | 'bid_room'; coverage: SignedCoverage }

export default function JobContractModal({ open, onClose, job, onChanged, onJobChanged, initialFilingOpen = false, onEditJob, coverage = null, initialRecordId = null }: JobContractModalProps) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const promptDialog = usePromptDialog()
  const narrow = useMatchMedia('(max-width: 820px)')

  const [rows, setRows] = useState<JobContractRow[]>([])
  const [liveRow, setLiveRow] = useState<JobContractRow | null>(null)
  const [fields, setFields] = useState<JobContractFields>(EMPTY_JOB_CONTRACT_FIELDS)
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  /** v2.4186: a second signer named on the draft (a spouse on a homestead); '' = one frame. */
  const [coSigner, setCoSigner] = useState<{ name: string; email: string }>({ name: '', email: '' })
  const [ccText, setCcText] = useState('')
  const [message, setMessage] = useState('')
  const [remindersEnabled, setRemindersEnabled] = useState(true)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  /** PR 4 (v2.3642): the Edit standard terms window. */
  const [termsEditOpen, setTermsEditOpen] = useState(false)
  const [templateId, setTemplateId] = useState<string>(BUILTIN_TEMPLATE_ID)
  const [scopeText, setScopeText] = useState('')
  /** The kind of agreement (2026-11-02): our contract, or the warranty sent in place of one; a new draft starts as a contract. */
  const [kind, setKind] = useState<JobAgreementKind>('contract')
  /** A warranty's lines to initial as typed, one per line (`fields.initial_lines` is the kept list). */
  const [initialsText, setInitialsText] = useState('')
  /** v2.3707: the estimate the customer accepted, read once per open, so the amount can say where it comes from. */
  const [acceptedEst, setAcceptedEst] = useState<{ totalCents: number | null; acceptedOn: string | null } | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'held'>('idle')
  const [busy, setBusy] = useState<null | 'send' | 'link' | 'void' | 'preview' | 'pdf' | 'reopen' | 'handed'>(null)
  const [voidArmed, setVoidArmed] = useState(false)
  const [lastLink, setLastLink] = useState<string | null>(null)
  const [paperOpen, setPaperOpen] = useState(false)
  const [recordRow, setRecordRow] = useState<JobContractRow | null>(null)
  /** v2.4183: the rows have been read once this open — until then the window shows neither rail. */
  const [rowsLoaded, setRowsLoaded] = useState(false)
  /** v2.6698 (punch list #173): their paper on this job, kept out of the window's own rows — the band names it and the sheet edits it. */
  const [theirPaper, setTheirPaper] = useState<TheirPaperRecord | null>(null)
  const [theirOpen, setTheirOpen] = useState(false)
  /** v2.4183: Start a new agreement… — a fresh draft while a signed copy is on file. */
  const [startNew, setStartNew] = useState(false)
  /** v2.4183: the estimates row behind an acceptance, handed up by the record on the left. */
  const [estimateRow, setEstimateRow] = useState<EstimateRecordRow | null>(null)
  /** Not needed (PR 0): undefined = read the job; null = withdrawn this session; an object = answered this session. */
  const [notNeededLocal, setNotNeededLocal] = useState<{ at: string; reason: string | null } | null | undefined>(undefined)
  const [notNeededOpen, setNotNeededOpen] = useState(false)
  const [notNeededReason, setNotNeededReason] = useState('')
  const [notNeededBusy, setNotNeededBusy] = useState(false)
  /** The rail (v2.4154): the office's pick, or null for the plan's default. */
  const [pickedWay, setPickedWay] = useState<WindowWay | null>(null)
  const [paperSend, setPaperSend] = useState<PaperSend>('download')
  const [textToo, setTextToo] = useState(false)
  /**
   * Punch list #125 PR 5 (v2.6700): the text door — the customer's box on Text with the signing link filled — in place
   * of an `sms:` on the person's phone. Holds the link the words carry; null while closed.
   */
  const [textDoor, setTextDoor] = useState<{ url: string } | null>(null)
  /** The customer's contact, read once the rail may text, so the chip can say the typed number is not on it yet. */
  const [customerContact, setCustomerContact] = useState<{ customerId: string; contact: Contact | null } | null>(null)
  const [addingNumber, setAddingNumber] = useState(false)
  const [oursShown, setOursShown] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  /** Channel of the live row's latest send event: 'email' = the customer was emailed, 'link' = only minted/copied. */
  const [lastSendChannel, setLastSendChannel] = useState<'email' | 'link' | null>(null)
  const userTouchedRef = useRef(false)
  const hydratedRef = useRef(false)
  const prefillDoneRef = useRef(false)

  const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—'
  // #125 PR 5: the customer's contact, read once a usable number is typed and the link may go by text (Text it too, or no
  // email), so the chip under Mobile can say the number is not on the contact yet; the same read serves the one-press
  // send. A read that fails leaves the chip out, and the press opens the box, which says why itself.
  const customerId = job?.customer_id ?? null
  const wantsContact = open && Boolean(customerId) && phoneLooksUsable(recipientPhone) && (textToo || !emailLooksValid(recipientEmail))
  useEffect(() => {
    if (!wantsContact || !customerId) return
    if (customerContact && customerContact.customerId === customerId) return
    let live = true
    loadCustomerContact(customerId).then(
      (contact) => live && setCustomerContact({ customerId, contact }),
      () => live && setCustomerContact({ customerId, contact: null }),
    )
    return () => {
      live = false
    }
  }, [wantsContact, customerId, customerContact])


  const loadRows = useCallback(async () => {
    if (!job) return
    try {
      const { data } = await supabase.from('job_contracts').select('*').eq('job_id', job.id).order('created_at', { ascending: false })
      const all = (data ?? []) as JobContractRow[]
      const theirs = all.find((r) => isTheirPaperRow(r)) ?? null
      setTheirPaper(theirs ? theirPaperFromRow(theirs) : null)
      const list = all.filter((r) => !isTheirPaperRow(r))
      setRows(list)
      const live = list.find((r) => jobContractIsLive(r)) ?? null
      setLiveRow(live)
      if (initialRecordId) {
        const picked = list.find((r) => r.id === initialRecordId && r.signed_at) ?? null
        if (picked) setRecordRow(picked)
      }
      if (live) {
        const { data: ev } = await supabase
          .from('job_contract_events')
          .select('metadata')
          .eq('contract_id', live.id)
          .eq('event_type', 'sent')
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const channel = (ev as { metadata?: { channel?: unknown } } | null)?.metadata?.channel
        setLastSendChannel(channel === 'email' ? 'email' : channel === 'link' ? 'link' : null)
      } else {
        setLastSendChannel(null)
      }
    } catch {
      setRows([])
    } finally {
      setRowsLoaded(true)
    }
  }, [job, initialRecordId])

  // Open-reset.
  useEffect(() => {
    if (!open || !job) return
    userTouchedRef.current = false
    hydratedRef.current = false
    prefillDoneRef.current = false
    setLiveRow(null)
    setRows([])
    setAutosaveState('idle')
    setVoidArmed(false)
    setReopenArmed(false)
    setLastLink(null)
    setTextDoor(null)
    setMessage('')
    setPaperOpen(initialFilingOpen)
    setRecordRow(null)
    setRowsLoaded(false)
    setStartNew(false)
    setEstimateRow(null)
    setNotNeededLocal(undefined)
    setNotNeededOpen(false)
    setNotNeededReason('')
    setPickedWay(null)
    setPaperSend('download')
    setTextToo(false)
    setOursShown(false)
    setTermsOpen(false)
    setRecipientName((job.customer_name ?? '').trim())
    setRecipientEmail((job.customer_email ?? '').trim())
    setRecipientPhone((job.customer_phone ?? '').trim())
    setCoSigner({ name: '', email: '' })
    setCcText('')
    setRemindersEnabled(true)
    setTemplateId(BUILTIN_TEMPLATE_ID)
    setKind('contract')
    setInitialsText('')
    void loadRows()
    void (async () => {
      try {
        const { data } = await supabase
          .from('contract_template_documents')
          .select('id, document_name, book_body_html, book_body_format, book_version_date, tags')
          .eq('audience', 'customer')
          .is('flow_kind', null)
          .order('document_name')
        const list = (data ?? []) as TemplateRow[]
        setTemplates(list)
        const first = list.find((t) => templateKind(t) === 'contract')
        if (first && !hydratedRef.current) setTemplateId(first.id)
      } catch {
        setTemplates([])
      }
    })()
    void fetchPhysicalInvoiceIssuerFromAppSettings().catch(() => undefined)
  }, [open, job, loadRows, initialFilingOpen])

  // Resume the live row (draft or sent) — its saved fields ARE the document.
  useEffect(() => {
    if (!open || !liveRow || hydratedRef.current) return
    hydratedRef.current = true
    prefillDoneRef.current = true
    const f = parseJobContractFields(liveRow.fields)
    setFields(f)
    setScopeText(f.scope_lines.join('\n'))
    setKind(jobAgreementKindOf(liveRow.kind))
    setInitialsText(f.initial_lines.join('\n'))
    setRecipientName(liveRow.recipient_name ?? '')
    setRecipientEmail(liveRow.recipient_email ?? '')
    setRecipientPhone(liveRow.recipient_phone ?? '')
    setCoSigner({ name: liveRow.co_signer_name ?? '', email: liveRow.co_signer_email ?? '' })
    setCcText((liveRow.cc_emails ?? []).join(', '))
    setRemindersEnabled(liveRow.reminders_enabled)
    setTemplateId(liveRow.template_document_id ?? BUILTIN_TEMPLATE_ID)
    setAutosaveState('saved')
  }, [open, liveRow])

  // The job's accepted estimate, once per open: the amount's source (v2.3707) always, and the first-open prefill when there is no live row.
  useEffect(() => {
    if (!open || !job) return
    setAcceptedEst(null)
    let cancelled = false
    void (async () => {
      let estimateLines: { line_item: string; description: string; quantity: number }[] = []
      let acceptedTotal: number | null = null
      let acceptedOn: string | null = null
      try {
        const { data } = await supabase
          .from('estimates')
          .select('line_items_snapshot, total_cents, status, acceptor_consented_at')
          .eq('job_ledger_id', job.id)
          .eq('status', 'customer_accepted')
          .limit(1)
          .maybeSingle()
        if (data) {
          estimateLines = normalizeEstimateLineItemsFromJson((data as { line_items_snapshot: unknown }).line_items_snapshot).map((l) => ({
            line_item: l.line_item,
            description: l.description,
            quantity: l.quantity,
          }))
          acceptedTotal = (data as { total_cents: number }).total_cents
          acceptedOn = (data as { acceptor_consented_at: string | null }).acceptor_consented_at
        }
      } catch {
        /* fall through to fixtures */
      }
      if (cancelled) return
      setAcceptedEst({ totalCents: acceptedTotal, acceptedOn })
      if (hydratedRef.current || prefillDoneRef.current) return
      prefillDoneRef.current = true
      const f = buildJobContractPrefill({ job, estimateLines, acceptedTotalCents: acceptedTotal })
      setFields(f)
      setScopeText(f.scope_lines.join('\n'))
    })()
    return () => {
      cancelled = true
    }
  }, [open, job])
  /** v2.3707: the job's number with its source; the draft's own number only ever shows up as "differs". */
  const amountSrc = contractAmountSource({ job: job ?? { revenue: null }, acceptedTotalCents: acceptedEst?.totalCents ?? null, acceptedOn: acceptedEst?.acceptedOn ?? null })
  const amountDrift = acceptedEst ? contractAmountDrift(amountSrc, fields.amount_cents) : null

  const editable = jobContractIsEditable(liveRow)
  const status = liveRow ? jobContractStatus(liveRow) : null
  // v2.4183: the signed state — a history row picked to view, else (nothing live, no fresh draft asked for) the newest signed row, else the acceptance behind the chip.
  const signedRows = rows.filter((r) => jobContractStatus(r) === 'signed')
  const signedCoverage: SignedCoverage | null = coverage && coverage.kind === 'signed' && (coverage.source === 'estimate' || coverage.source === 'bid_room') ? coverage : null
  const signedView: SignedView | null = recordRow
    ? { source: filedOnPaper(recordRow) ? 'paper' : 'contract', row: recordRow }
    : liveRow || startNew || !rowsLoaded
      ? null
      : signedRows[0]
        ? { source: filedOnPaper(signedRows[0]) ? 'paper' : 'contract', row: signedRows[0] }
        : signedCoverage
          ? { source: signedCoverage.source as 'estimate' | 'bid_room', coverage: signedCoverage }
          : null
  const shownRow = signedView && 'row' in signedView ? signedView.row : null
  const recordUrls = useJobContractRecordUrls(shownRow, open)
  const shownFields = useMemo(() => (shownRow ? parseJobContractFields(shownRow.fields) : null), [shownRow])
  /** The row whose saved text the paper prints: the signed row shown, or the live row once it is out. */
  const paperRow = shownRow ?? (liveRow && !editable ? liveRow : null)
  const paperEditable = editable && rowsLoaded && !signedView
  /** A record filed from an outside document: the paper prints a note, not a body it never held. */
  const filedDoc = shownRow && filedOnPaper(shownRow) && shownRow.signed_document_url ? { what: isGoogleDocsUrl(shownRow.signed_document_url) ? 'Google Doc' : 'document' } : null
  /** The Book's documents for this kind: a contract's, or the ones tagged `warranty`. A pick from the other kind reads as the built-in terms. */
  const templatesForKind = templates.filter((t) => templateKind(t) === kind)
  const selectedTemplate = templatesForKind.find((t) => t.id === templateId) ?? null
  const bodyHtml = selectedTemplate ? selectedTemplate.book_body_html ?? '' : kind === 'warranty' ? DEFAULT_JOB_WARRANTY_TERMS_PLAIN : DEFAULT_JOB_CONTRACT_TERMS_PLAIN
  const bodyFormat = selectedTemplate ? selectedTemplate.book_body_format : 'plain'
  const templateName = selectedTemplate ? selectedTemplate.document_name : kind === 'warranty' ? 'Built-in warranty terms' : 'Built-in service agreement terms'
  /** The kind the paper on screen is: the signed row shown, else the draft's pick. */
  const paperKind: JobAgreementKind = shownRow ? jobAgreementKindOf(shownRow.kind) : paperRow ? jobAgreementKindOf(paperRow.kind) : kind
  const paperWords = JOB_AGREEMENT_WORDS[paperKind]

  const touch = () => {
    userTouchedRef.current = true
  }
  const setField = <K extends keyof JobContractFields>(key: K, value: JobContractFields[K]) => {
    touch()
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const ccList = useMemo(
    () =>
      ccText
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
        .slice(0, 10),
    [ccText],
  )

  const buildRowPayload = useCallback(() => {
    if (!job) return null
    return {
      job_id: job.id,
      kind,
      fields: { ...fields } as unknown as Database['public']['Tables']['job_contracts']['Insert']['fields'],
      body_html: bodyHtml,
      body_format: bodyFormat,
      template_document_id: selectedTemplate?.id ?? null,
      template_name: templateName,
      template_version_date: selectedTemplate?.book_version_date ?? null,
      recipient_name: recipientName.trim() || null,
      recipient_email: recipientEmail.trim() || null,
      recipient_phone: recipientPhone.trim() || null,
      co_signer_name: coSigner.name.trim() || null,
      co_signer_email: coSigner.name.trim() && emailLooksValid(coSigner.email) ? coSigner.email.trim() : null,
      cc_emails: ccList,
      reminders_enabled: remindersEnabled,
    }
  }, [job, kind, fields, bodyHtml, bodyFormat, selectedTemplate, templateName, recipientName, recipientEmail, recipientPhone, coSigner, ccList, remindersEnabled])

  /** Writes the draft now (insert or update) and returns the row — the send gate uses it too. */
  const flushDraft = useCallback(async (): Promise<JobContractRow | null> => {
    const payload = buildRowPayload()
    if (!payload) return null
    if (liveRow && jobContractStatus(liveRow) !== 'draft') return liveRow
    setAutosaveState('saving')
    try {
      if (liveRow) {
        const data = await withSupabaseRetry<JobContractRow>(
          () => supabase.from('job_contracts').update(payload).eq('id', liveRow.id).eq('status', 'draft').select('*').single(),
          'autosave job contract draft',
        )
        if (data) setLiveRow(data)
        setAutosaveState('saved')
        return data ?? liveRow
      }
      const data = await withSupabaseRetry<JobContractRow>(
        () =>
          supabase
            .from('job_contracts')
            .insert({ ...payload, status: 'draft', created_by: authUser?.id ?? null })
            .select('*')
            .single(),
        'create job contract draft',
      )
      if (data) {
        hydratedRef.current = true
        setLiveRow(data)
        setRows((prev) => [data, ...prev])
      }
      setAutosaveState('saved')
      return data ?? null
    } catch {
      setAutosaveState('error')
      return null
    }
  }, [buildRowPayload, liveRow, authUser?.id])

  // Autosave — debounced from the first real edit; stops once sent. A start or completion date
  // caught half typed (the year "2026" arrives as 0002, 0020, 0202) holds the draft until it is
  // finished: the dates ride inside `fields`, so the rest cannot be written without them.
  // The timer reads the newest flushDraft through a ref: a save stores the row it wrote, which
  // makes a new flushDraft, and re-arming on that set off the next save — one edit saved again
  // every second for as long as the window stayed open, and the status line bounced the window.
  const datesUnfinished = jobContractDatesUnfinished(fields)
  const flushDraftRef = useRef(flushDraft)
  flushDraftRef.current = flushDraft
  useEffect(() => {
    if (!open || !job || !editable || !userTouchedRef.current) return
    const t = window.setTimeout(() => {
      if (datesUnfinished) setAutosaveState('held')
      else void flushDraftRef.current()
    }, 800)
    return () => window.clearTimeout(t)
  }, [open, job, editable, fields, datesUnfinished, recipientName, recipientEmail, recipientPhone, coSigner, ccText, remindersEnabled, templateId])

  const applyScopeText = (text: string) => {
    setScopeText(text)
    setField(
      'scope_lines',
      text.split('\n').map((l) => l.trim()).filter(Boolean),
    )
  }
  /** A warranty's lines to initial, one per line, kept as the draft's `initial_lines`. */
  const applyInitialsText = (text: string) => {
    setInitialsText(text)
    setField(
      'initial_lines',
      text.split('\n').map((l) => l.trim()).filter(Boolean),
    )
  }
  /**
   * The Paper pick (2026-11-02): a warranty in place of a contract. Picking it on a draft with no lines to initial yet
   * prefills the built-in four and takes the Book's warranty document when there is one; back to a contract keeps the
   * lines typed (they print on a warranty alone) and takes the Book's first contract document.
   */
  const pickKind = (next: JobAgreementKind) => {
    if (next === kind) return
    touch()
    setKind(next)
    if (next === 'warranty' && fields.initial_lines.length === 0) {
      setInitialsText(DEFAULT_WARRANTY_INITIAL_LINES.join('\n'))
      // The lines say the price is due when the work is done, so the payment line says the same unless the office picked one.
      setFields((prev) => ({ ...prev, initial_lines: [...DEFAULT_WARRANTY_INITIAL_LINES], payment_terms_key: prev.payment_terms_key === 'half_down' ? 'on_completion' : prev.payment_terms_key }))
    }
    setTemplateId(templates.find((t) => templateKind(t) === next)?.id ?? BUILTIN_TEMPLATE_ID)
  }

  /**
   * Says why and answers true when a half-typed start or completion date stops the draft leaving
   * the window: the clicks that send it, hand it over or file it write it as it reads and lock
   * it. A row that is already out is not stopped — nobody can retype its dates, and Void & redo
   * is how they get fixed.
   */
  const unfinishedDateStops = useCallback(
    (leaving: 'out' | 'filed'): boolean => {
      if (!editable) return false
      const why = jobContractUnfinishedDateBlocks(fields, leaving, new Date().getFullYear())
      if (why) showToast(why, 'error')
      return why !== null
    },
    [editable, fields, showToast],
  )

  const invokeSend = useCallback(
    async (mode: 'email' | 'link'): Promise<string | null> => {
      if (!job) return null
      if (unfinishedDateStops('out')) return null
      const row = editable ? await flushDraft() : liveRow
      if (!row) {
        showToast('Could not save the contract draft.', 'error')
        return null
      }
      if (mode === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
        showToast('Enter a valid email for the signer, or use Copy link.', 'error')
        return null
      }
      setBusy(mode === 'email' ? 'send' : 'link')
      try {
        const { data, error } = await supabase.functions.invoke('send-job-contract', {
          body: {
            contract_id: row.id,
            mode,
            recipient_email: recipientEmail.trim(),
            recipient_name: recipientName.trim(),
            cc_emails: ccList,
            public_origin: window.location.origin,
            message: message.trim() || undefined,
          },
        })
        const res = (data ?? {}) as { ok?: boolean; emailed?: boolean; sign_url?: string; error?: string; email_error?: string }
        if (error || !res.ok) {
          showToast(res.error || error?.message || 'Could not send the contract.', 'error')
          return null
        }
        setLastLink(res.sign_url ?? null)
        if (mode === 'email') {
          showToast(res.emailed ? `Contract sent to ${recipientEmail.trim()}.` : `Link ready — email did not send${res.email_error ? ` (${res.email_error})` : ''}. Copy the link instead.`, res.emailed ? 'success' : 'error')
        }
        await loadRows()
        dispatchChanged()
        onChanged?.()
        return res.sign_url ?? null
      } finally {
        setBusy(null)
      }
    },
    [job, editable, unfinishedDateStops, flushDraft, liveRow, recipientEmail, recipientName, ccList, message, showToast, loadRows, onChanged],
  )

  /**
   * The link to hand out: the one this session made, else the one the sent row already carries
   * (read again first, in case another tab moved it), else a send mints or renews it. Handing out a
   * link the row has records nothing, so a PDF emailed to sign stays a PDF send (punch list #104,
   * v2.5119).
   */
  const linkToHandOut = async (): Promise<string | null> => {
    if (lastLink) return lastLink
    const own = jobContractLinkOnRow(liveRow, window.location.origin) ? await freshJobContractLink(liveRow?.id, window.location.origin) : null
    return own ?? (await invokeSend('link'))
  }

  const copyLink = async () => {
    const url = await linkToHandOut()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      showToast('Signing link copied.', 'success')
    } catch {
      // The clipboard is closed to the app here: the link shows in a window to copy by hand.
      await promptDialog({ title: 'Copy the signing link', message: 'The app could not reach the clipboard. Select the link below and copy it.', defaultValue: url, confirmLabel: 'I copied it' })
    }
  }

  /** Text the link (#125 PR 5): the customer's box on Text with the words and the link filled; the box's send is the confirm. */
  const textLink = async () => {
    const url = await linkToHandOut()
    if (!url) return
    setTextDoor({ url })
  }

  const signInPerson = async () => {
    const url = await linkToHandOut()
    if (!url) return
    window.open(`${url}&inperson=1`, '_blank', 'noopener')
  }

  const preview = () => {
    if (!job) return
    setBusy('preview')
    try {
      const issuer = getPhysicalInvoiceIssuerForDocument()
      // v2.4590: the blocks the editor holds — a second signer named here prints a second block.
      const blocks = jobContractSignatureBlocks(
        liveRow
          ? { ...liveRow, recipient_name: recipientName, co_signer_name: coSigner.name }
          : { id: '', signed_at: null, signer_printed_name: null, signer_mode: null, signer_consented_at: null, recipient_name: recipientName, co_signer_name: coSigner.name },
      )
      const html = buildJobContractDocumentHtml({
        heading: jobAgreementHeading(kind, job),
        kind,
        initials: liveRow ? parseInitials(liveRow.initials) : null,
        jobNumber,
        jobAddress: job.job_address ?? '',
        customerName: job.customer_name ?? '',
        recipientName,
        dateLabel: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        revision: liveRow?.revision ?? 1,
        fields,
        termsHtml: renderContractBodyToSafeHtml(liveRow && !editable ? liveRow.body_html : bodyHtml, liveRow && !editable ? liveRow.body_format : bodyFormat),
        templateName: liveRow && !editable ? liveRow.template_name : templateName,
        issuer: issuer.companyName ? issuer : null,
        ...blocks,
      })
      if (!openHtmlPreviewWindow(html)) showToast('Allow pop-ups to preview the contract.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const viewHistoryRow = (row: JobContractRow) => {
    if (!job) return
    const issuer = getPhysicalInvoiceIssuerForDocument()
    const html = buildJobContractDocumentHtml({
      heading: jobAgreementHeading(jobAgreementKindOf(row.kind), job),
      kind: jobAgreementKindOf(row.kind),
      initials: parseInitials(row.initials),
      jobNumber,
      jobAddress: job.job_address ?? '',
      customerName: job.customer_name ?? '',
      recipientName: row.recipient_name ?? '',
      dateLabel: formatContractStamp(row.last_sent_at ?? row.created_at) ?? '',
      revision: row.revision,
      fields: parseJobContractFields(row.fields),
      termsHtml: renderContractBodyToSafeHtml(row.body_html, row.body_format),
      templateName: row.template_name,
      issuer: issuer.companyName ? issuer : null,
      ...jobContractSignatureBlocks(row),
    })
    if (!openHtmlPreviewWindow(html)) showToast('Allow pop-ups to view the contract.', 'error')
  }

  /** Void & redo: the sent row is voided, its token moves to a fresh draft (revision + 1) — the customer's link keeps working. */
  /**
   * Edit & re-send (PR 6, v2.3647): an agreement nobody has opened unlocks in place — same row,
   * same link, one revision on — instead of void-and-revise. Armed first, like Void & redo,
   * because the note says what the customer may still be holding.
   */
  const [reopenArmed, setReopenArmed] = useState(false)
  const editAndResend = async () => {
    if (!liveRow || busy != null) return
    if (!reopenArmed) {
      setReopenArmed(true)
      setVoidArmed(false)
      return
    }
    setBusy('reopen')
    try {
      const res = await reopenUnopenedJobContract({ row: liveRow, authUserId: authUser?.id ?? null })
      if (!res.ok) {
        showToast(res.message, 'error')
        if (res.reason === 'opened') await loadRows()
        return
      }
      hydratedRef.current = false
      setLiveRow(null)
      setRows([])
      await loadRows()
      setLastLink(null)
      showToast(`Unlocked as revision ${res.row.revision} — edit it and send again; the same link carries it.`, 'success')
      dispatchChanged()
      onChanged?.()
    } finally {
      setReopenArmed(false)
      setBusy(null)
    }
  }

  const voidAndRedo = async () => {
    if (!liveRow || !job) return
    if (!voidArmed) {
      setVoidArmed(true)
      return
    }
    setBusy('void')
    try {
      const token = liveRow.public_token
      await withSupabaseRetry(
        () =>
          supabase
            .from('job_contracts')
            .update({ status: 'voided', voided_at: new Date().toISOString(), voided_by: authUser?.id ?? null, void_reason: 'Revised by the office', public_token: null })
            .eq('id', liveRow.id),
        'void job contract',
      )
      const payload = buildRowPayload()
      const created = await withSupabaseRetry<JobContractRow>(
        () =>
          supabase
            .from('job_contracts')
            .insert({ ...(payload ?? { job_id: job.id }), status: 'draft', revision: liveRow.revision + 1, public_token: token, created_by: authUser?.id ?? null })
            .select('*')
            .single(),
        'create replacement contract draft',
      )
      if (created) {
        await withSupabaseRetry(() => supabase.from('job_contracts').update({ superseded_by: created.id }).eq('id', liveRow.id), 'link superseded contract')
        hydratedRef.current = false
        setLiveRow(null)
        setRows([])
        await loadRows()
      }
      setVoidArmed(false)
      setLastLink(null)
      showToast('Contract voided — edit the new draft and send again on the same link.', 'success')
      dispatchChanged()
      onChanged?.()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not void the contract.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  /** The filing sheet recorded a signed row (paper / Google Doc) — reload and tell the board (the sheet itself writes through fileSignedJobContract). */
  const onPaperFiled = async () => {
    setPaperOpen(false)
    hydratedRef.current = false
    setLiveRow(null)
    await loadRows()
    dispatchChanged()
    onChanged?.()
  }

  /** Not needed (PR 0): the office says this job needs no agreement of ours — a fact on the job, not a contract row. */
  const notNeeded: { at: string; reason: string | null } | null =
    notNeededLocal !== undefined ? notNeededLocal : job?.contract_not_needed_at ? { at: job.contract_not_needed_at, reason: (job.contract_not_needed_reason ?? '').trim() || null } : null
  const writeNotNeeded = async (value: { reason: string } | null) => {
    if (!job || notNeededBusy) return
    setNotNeededBusy(true)
    try {
      if (value) {
        setNotNeededLocal(await markJobContractNotNeeded(job.id, value.reason, authUser?.id ?? null))
      } else {
        await clearJobContractNotNeeded(job.id)
        setNotNeededLocal(null)
      }
      setNotNeededOpen(false)
      showToast(value ? 'Marked not needed — this job leaves the contract count.' : 'Needed after all — this job is back in the count.', 'success')
      dispatchChanged()
      onChanged?.()
      onJobChanged?.()
    } catch {
      showToast('Could not save that.', 'error')
    } finally {
      setNotNeededBusy(false)
    }
  }

  if (!open || !job) return null

  const historyRows = rows.filter((r) => r.id !== liveRow?.id && r.id !== shownRow?.id)
  const canReopen = Boolean(liveRow) && reopenBlocker(liveRow) === null
  // v2.3629: a row handed over on paper has no link to resend — it waits for the signed page.
  const amberStrip: React.CSSProperties = { padding: '0.55rem 0.75rem', borderRadius: 8, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8rem', lineHeight: 1.4 }
  const sentRail =
    liveRow && status === 'sent' && isHandedAwaitingPaper(liveRow) ? (
      <div data-testid="contract-handed-strip" style={{ display: 'grid', gap: '0.6rem' }}>
        <div style={amberStrip}>📄 Handed over on paper {formatContractStamp(liveRow.last_sent_at ?? liveRow.sent_at) ?? ''} — waiting for the signed copy. Nothing was emailed, and no reminders go out.</div>
        <RailGroup label="It's back">
          <button type="button" style={btnPrimary} disabled={busy != null} onClick={() => setPaperOpen(true)}>
            File the signed copy
          </button>
        </RailGroup>
        <RailGroup label="Change it">
          <button type="button" style={{ ...btn, color: voidArmed ? 'var(--text-red-700)' : undefined }} disabled={busy != null} onClick={() => void voidAndRedo()}>
            {busy === 'void' ? 'Voiding…' : voidArmed ? 'Confirm void & redo' : 'Void & redo'}
          </button>
        </RailGroup>
      </div>
    ) : liveRow && status === 'sent' ? (
      <div style={{ display: 'grid', gap: '0.6rem' }} data-testid="contract-sent-rail">
        <div style={amberStrip}>
          {jobContractSentChannel(liveRow) === 'pdf_email' ? '📎 PDF emailed to sign by hand ' : lastSendChannel === 'link' ? '🔗 Link copied ' : '✉ Sent '}
          {formatContractStamp(liveRow.last_sent_at ?? liveRow.sent_at) ?? ''}
          {liveRow.recipient_email ? (lastSendChannel === 'link' ? ` — nothing emailed yet to ${liveRow.recipient_email}` : ` to ${liveRow.recipient_email}`) : lastSendChannel === 'link' ? ' — nothing emailed yet' : ''}
          {liveRow.send_count > 1 ? ` · ${liveRow.send_count} sends` : ''}
          {liveRow.view_count > 0 ? ` · opened ${liveRow.view_count}×` : ' · not opened yet'}
          {(() => {
            const fp = framesProgress(liveRow)
            return fp ? ` · ${fp.done} of ${fp.of} signed${fp.waitingOn.length ? ` — waiting on ${fp.waitingOn.join(' and ')}` : ''}` : ''
          })()}
          {liveRow.public_token_expires_at ? ` · link good until ${formatContractStamp(liveRow.public_token_expires_at)?.split(',')[0] ?? ''}` : ''}
        </div>
        <RailGroup label="Nudge">
          {isAwaitingPaperCopy(liveRow) ? (
            <button type="button" style={btnPrimary} disabled={busy != null} onClick={() => setPaperOpen(true)} data-testid="contract-file-signed-copy">
              File the signed copy
            </button>
          ) : null}
          <button type="button" style={lastSendChannel === 'link' || !isAwaitingPaperCopy(liveRow) ? btnPrimary : btn} disabled={busy != null} onClick={() => void invokeSend('email')}>
            {busy === 'send' ? 'Sending…' : lastSendChannel === 'link' ? 'Send by email' : 'Resend email'}
          </button>
          {recipientPhone.trim() ? (
            <button type="button" style={btn} disabled={busy != null} onClick={() => void textLink()}>
              Text the link
            </button>
          ) : null}
          <button type="button" style={btn} disabled={busy != null} onClick={() => void copyLink()}>
            Copy link
          </button>
        </RailGroup>
        <RailGroup label="Sign here">
          <button type="button" style={btn} disabled={busy != null} onClick={() => void signInPerson()}>
            Open the signing page on this device
          </button>
        </RailGroup>
        <RailGroup label="Change it">
          {canReopen ? (
            <button type="button" style={reopenArmed ? btnPrimary : btn} disabled={busy != null} onClick={() => void editAndResend()} title="They have not opened it — unlock it here, fix it, and send again on the same link" data-testid="contract-edit-resend">
              {busy === 'reopen' ? 'Unlocking…' : reopenArmed ? 'Confirm — unlock to edit' : 'Edit & re-send'}
            </button>
          ) : null}
          <button type="button" style={{ ...btn, color: voidArmed ? 'var(--text-red-700)' : undefined }} disabled={busy != null} onClick={() => void voidAndRedo()}>
            {busy === 'void' ? 'Voiding…' : voidArmed ? 'Confirm void & redo' : 'Void & redo'}
          </button>
        </RailGroup>
        {reopenArmed && liveRow && canReopen ? (
          <span style={{ fontSize: '0.76rem', color: 'var(--text-amber-800)' }} data-testid="contract-reopen-note">
            {reopenNote(liveRow)}{' '}
            <button type="button" onClick={() => setReopenArmed(false)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
              Never mind
            </button>
          </span>
        ) : !canReopen && liveRow && (liveRow.first_viewed_at || liveRow.view_count > 0) ? (
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>They have opened it, so it cannot be edited in place — Void &amp; redo keeps what they read on the record and starts a fresh draft on the same link.</span>
        ) : null}
      </div>
    ) : null

  /** Download PDF (v2.3527): the unsigned agreement from what the editor holds — nothing written. */
  const downloadPdf = async () => {
    if (!job) return
    setBusy('pdf')
    try {
      const payload = buildRowPayload()
      if (!payload) return
      const { filename, bytes } = await fetchContractDraftPdf({
        jobId: job.id,
        draft: {
          fields: payload.fields,
          body_html: liveRow && !editable ? liveRow.body_html : (payload.body_html ?? null),
          body_format: liveRow && !editable ? liveRow.body_format : (payload.body_format ?? 'plain'),
          template_name: liveRow && !editable ? liveRow.template_name : (payload.template_name ?? null),
          recipient_name: payload.recipient_name ?? null,
          revision: liveRow?.revision ?? 1,
          // v2.4590: the second signer's own Sign and Date rules — a homestead page needs both spouses.
          co_signer_name: payload.co_signer_name ?? null,
          kind: liveRow && !editable ? jobAgreementKindOf(liveRow.kind) : kind,
        },
      })
      saveBytesAsFile(bytes, filename)
    } catch (err) {
      showToast(formatErrorMessage(err, 'Could not build the PDF.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  // ---- The rail (v2.4154): one question, one button ----
  const gcJob = jobTakesTheirSubcontract(job)
  const gcName = (job.gcCustomer?.name ?? '').trim() || null
  const emailOk = emailLooksValid(recipientEmail)
  const phoneOk = phoneLooksUsable(recipientPhone)
  const plan = windowWaysPlan({ emailOk, phoneOk, gcJob, gcName })
  const way = effectiveWindowWay(plan, pickedWay)
  /**
   * v2.4657: a builder's job filing the builder's own subcontract (the way the rail leads with, until
   * Send ours anyway; no copy of ours out on paper). The GC signs it, and our draft's second signer
   * has no line on it.
   */
  const filingTheirs = Boolean(gcJob && gcName && way === 'file_theirs' && !(liveRow && isAwaitingPaperCopy(liveRow)))
  const issuerForSentence = getPhysicalInvoiceIssuerForDocument()
  const paperIssuer = issuerForSentence.companyName ? issuerForSentence : null
  const sentence = windowWaySentence({ way, paperSend, recipientName, email: recipientEmail, phone: recipientPhone, textToo, remindersEnabled, fromAddress: issuerForSentence.email || 'the office' })
  const wayButton = windowWayButton({ way, paperSend, email: recipientEmail, phone: recipientPhone, textToo })

  // #125 PR 5: the chip under Mobile draws once the rail may text the typed number (the contact was read above).
  const mayText = way === 'link' && phoneOk && (textToo || !emailOk)
  const contactForChip = customerContact && customerContact.customerId === customerId ? customerContact.contact : null
  const typedChannel = contactForChip ? typedNumberOnContact(contactForChip, recipientPhone) : null
  const addTypedNumber = async () => {
    if (!contactForChip || addingNumber) return
    setAddingNumber(true)
    try {
      const channel = await addContactPhone(contactForChip.id, recipientPhone.trim())
      setCustomerContact({ customerId: contactForChip.customerId ?? customerId ?? '', contact: { ...contactForChip, channels: [...contactForChip.channels.filter((ch) => ch.id !== channel.id), channel] } })
      showToast(`${recipientPhone.trim()} added to ${firstName(contactForChip) || contactForChip.name}’s contact.`, 'success')
    } catch (err) {
      showToast(formatErrorMessage(err, 'The number was not added.'), 'error')
    } finally {
      setAddingNumber(false)
    }
  }
  const phoneNote =
    mayText && contactForChip && !typedChannel ? (
      <button type="button" style={{ ...btn, padding: '0.22rem 0.6rem', fontSize: '0.75rem', borderRadius: 999, border: '1px solid var(--border-orange)', background: 'var(--bg-orange-tint)', color: 'var(--text-orange-700)' }} disabled={addingNumber} onClick={() => void addTypedNumber()} data-testid="contract-add-number-chip">
        {addingNumber ? 'Adding…' : addNumberChipWords(firstName(contactForChip) || contactForChip.name, recipientPhone)}
      </button>
    ) : null
  /**
   * Send a link: email when there is one, the text in the same press when asked (#125 PR 5: `quo-send` from the company
   * number, the rail's sentence its confirm); a typed number not on the contact, or a phone alone, opens the customer's
   * box instead, where the chip adds the number and the box's send is the confirm.
   */
  const sendLink = async () => {
    const phone = recipientPhone.trim()
    if (emailOk) {
      const url = await invokeSend('email')
      if (!url || !textToo || !phone) return
      if (contactForChip && typedChannel) {
        try {
          await supabaseReplyIo().sendText({ contactId: contactForChip.id, channelId: typedChannel.id, jobKey: jobBoxJobKey(job.id), body: contractSignTextWords(job.job_address, url), held: false })
          showToast(`Signing link texted to ${phone} from the company number.`, 'success')
          dispatchChanged()
          onChanged?.()
        } catch (err) {
          showToast(`${formatErrorMessage(err, 'The text did not go.')} Copy the link to send it another way.`, 'error')
        }
        return
      }
      setTextDoor({ url })
      return
    }
    if (phone) {
      const url = await linkToHandOut()
      if (url) setTextDoor({ url })
    }
  }
  /** On paper, download: the PDF with pen rules, and the hand-off recorded so the job leaves the count (the sweep's rule, v2.3629). */
  const downloadHanded = async () => {
    if (unfinishedDateStops('out')) return
    const row = await flushDraft()
    if (!row) {
      showToast('Could not save the agreement.', 'error')
      return
    }
    const blocker = handoffBlocker(row)
    if (blocker) {
      showToast(blocker, 'error')
      return
    }
    await downloadPdf()
    setBusy('handed')
    try {
      const handed = await markJobContractHanded({ row, authUserId: authUser?.id ?? null })
      if (!handed) {
        showToast('Could not record the hand-off — the agreement may already be out.', 'error')
        return
      }
      showToast('Downloaded and marked as handed over — it waits for the signed copy. File it here when it comes back.', 'success')
      hydratedRef.current = false
      setLiveRow(null)
      await loadRows()
      dispatchChanged()
      onChanged?.()
    } finally {
      setBusy(null)
    }
  }
  /** On paper, by email: the unsigned PDF to print, sign and send back, the signing link riding along (share-job-contract send_to_sign, v2.3631). */
  const emailPdf = async () => {
    if (!emailOk) {
      showToast('Enter a valid email for the PDF.', 'error')
      return
    }
    if (unfinishedDateStops('out')) return
    const row = await flushDraft()
    if (!row) {
      showToast('Could not save the agreement.', 'error')
      return
    }
    setBusy('send')
    try {
      const { data, error } = await supabase.functions.invoke('share-job-contract', {
        body: { contract_id: row.id, mode: 'send_to_sign', recipient_email: recipientEmail.trim(), recipient_name: recipientName.trim(), public_origin: window.location.origin, message: message.trim() || undefined },
      })
      const res = (data ?? {}) as { ok?: boolean; error?: string }
      if (error || !res.ok) {
        showToast(res.error || error?.message || 'Could not send the PDF.', 'error')
        return
      }
      showToast(`PDF emailed to ${recipientEmail.trim()} — they print, sign and send it back.`, 'success')
      hydratedRef.current = false
      setLiveRow(null)
      await loadRows()
      dispatchChanged()
      onChanged?.()
    } finally {
      setBusy(null)
    }
  }
  /** The filing sheet records the draft as signed, so it does not open over a half-typed date. */
  const openFiling = () => {
    if (unfinishedDateStops('filed')) return
    setPaperOpen(true)
  }
  const goWay = () => {
    if (way === 'link') return void sendLink()
    if (way === 'here') return void signInPerson()
    if (way === 'paper') return void (paperSend === 'pdf_email' ? emailPdf() : downloadHanded())
    openFiling()
  }

  const signedOnFile = status === null && signedRows.length > 0 && !signedView
  const pill = windowStatusPill({
    status: signedView ? 'signed' : status,
    channel: liveRow ? jobContractSentChannel(liveRow) : 'link',
    sentAt: liveRow?.last_sent_at ?? liveRow?.sent_at ?? null,
    viewCount: liveRow?.view_count ?? 0,
    signedAt: signedView ? ('row' in signedView ? signedView.row.signed_at : estimateRow?.acceptor_consented_at ?? signedView.coverage.signedAt) : null,
    signerName: signedView ? ('row' in signedView ? signerNamesLine(signedView.row) : estimateRow?.acceptor_printed_name ?? signedView.coverage.signerName) : null,
    signedVerb: signedView && !('row' in signedView) ? 'Accepted' : 'Signed',
    frames: liveRow ? framesLabel(liveRow) : '',
    signedOnFile,
    notNeeded: Boolean(notNeeded) && !liveRow,
    draftSaved: autosaveState === 'saved',
    stamp: (iso) => formatContractStamp(iso)?.split(',')[0] ?? '',
  })
  const pillColors = pill.tone === 'amber' ? { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' } : pill.tone === 'green' ? { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' } : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }
  const paperBodyHtml = paperRow ? paperRow.body_html ?? '' : bodyHtml
  const paperBodyFormat = paperRow ? paperRow.body_format : bodyFormat
  const clauseCount = paperBodyFormat === 'plain' ? (paperBodyHtml.match(/^\d+\. /gm) ?? []).length : 0
  const paperVersionDate = paperRow ? paperRow.template_version_date : selectedTemplate?.book_version_date ?? null
  const versionLabel = paperVersionDate ? formatContractStamp(`${paperVersionDate}T12:00:00Z`)?.split(',')[0] ?? null : null
  const linkBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.72rem', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }

  const notNeededPanel =
    notNeededOpen && !notNeeded ? (
      <div style={{ display: 'grid', gap: '0.45rem', padding: '0.55rem 0.75rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: '0.8rem' }} data-testid="contract-not-needed-panel">
        <div>
          <b>Why doesn&apos;t this job need an agreement of ours?</b>
          <span style={{ color: 'var(--text-muted)' }}> It leaves the count; the row reads <i>No contract · not needed</i>.</span>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {CONTRACT_NOT_NEEDED_REASONS.map((r) => {
            const on = notNeededReason === r
            return (
              <button
                key={r}
                type="button"
                onClick={() => setNotNeededReason(on ? '' : r)}
                style={{ ...btn, padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: 999, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-700)' : 'var(--text-700)', borderColor: on ? 'var(--border-blue)' : 'var(--border-strong)' }}
              >
                {r}
              </button>
            )
          })}
        </div>
        <input
          style={inputStyle}
          value={(CONTRACT_NOT_NEEDED_REASONS as ReadonlyArray<string>).includes(notNeededReason) ? '' : notNeededReason}
          onChange={(e) => setNotNeededReason(e.target.value)}
          placeholder="Or say it in your own words (optional)"
          aria-label="Reason the job needs no contract"
        />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" style={btn} disabled={notNeededBusy} onClick={() => setNotNeededOpen(false)}>
            Cancel
          </button>
          <button type="button" style={btnPrimary} disabled={notNeededBusy} onClick={() => void writeNotNeeded({ reason: notNeededReason })}>
            {notNeededBusy ? 'Saving…' : 'Mark not needed'}
          </button>
        </div>
      </div>
    ) : null

  return (
    <ResponsiveModalShell
      title={`${paperWords.Noun} · J${jobNumber}`}
      onRequestClose={onClose}
      maxWidthDesktop={1000}
      fullScreenKey="job-contract"
      headerAction={
        <span data-testid="contract-status-pill" style={{ ...pillColors, fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.6rem', borderRadius: 999, whiteSpace: 'nowrap' }}>
          {pill.text}
        </span>
      }
    >
      <div style={{ fontSize: '0.85rem', display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 1.25fr) minmax(300px, 1fr)', gap: '1rem 1.4rem', alignItems: 'start' }}>
        <div style={{ minWidth: 0, display: 'grid', gap: '0.6rem' }}>
          {theirPaper ? (
            <div data-testid="contract-their-paper-band" style={{ padding: '0.5rem 0.75rem', borderRadius: 8, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', fontSize: '0.8rem', display: 'flex', gap: '0.5rem 0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 260px', minWidth: 0 }}>
                <b>{theirPaperLine(theirPaper)}</b> — {theirPaperWords(theirPaper)}
              </span>
              <button type="button" onClick={() => setTheirOpen(true)} style={{ padding: '0.25rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-blue)', background: 'var(--surface)', color: 'var(--text-blue-700)', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                Edit the record
              </button>
              <TheirPaperSheet open={theirOpen} onClose={() => setTheirOpen(false)} onDone={() => { void loadRows(); onChanged?.() }} job={{ id: job?.id ?? '', num: jobNumber, partyName: (job?.customer_name ?? '').trim() || (job?.gcCustomer?.name ?? '').trim() }} payer={job ? theirPaperPayer(job) : null} payCalendarJob={job ? payCalendarJobOf(job) : null} existing={theirPaper} overlayZIndex={1400} />
            </div>
          ) : null}
          {signedOnFile ? (
            <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', fontSize: '0.8rem' }}>
              ✍ A signed agreement is already on file for this job (see history below). Starting a new one supersedes it only if the customer signs again.
            </div>
          ) : null}

          {/* v2.4175: the paper is the form — the agreement as the customer sees it, edited in place; v2.4183: as signed, or the acceptance record. */}
          {signedView && !('row' in signedView) ? (
            <div data-testid="contract-acceptance-record">
              <CustomerAcceptanceRecordBody open={open} estimateId={signedView.coverage.estimateId} onLoaded={setEstimateRow} previewBanner="Record of what the customer accepted — this acceptance is the job's agreement." />
            </div>
          ) : (
            <>
            {paperEditable ? (
              <div role="radiogroup" aria-label="Which paper" data-testid="contract-kind-pick" style={{ display: 'flex', gap: '0.35rem 0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Paper</span>
                {JOB_AGREEMENT_KINDS.map((k) => {
                  const on = kind === k
                  return (
                    <button key={k} type="button" role="radio" aria-checked={on} onClick={() => pickKind(k)} data-testid={`contract-kind-${k}`} style={{ padding: '0.25rem 0.7rem', borderRadius: 999, border: `1.5px solid ${on ? 'var(--text-orange-700)' : 'var(--border-strong)'}`, background: on ? 'var(--bg-orange-tint)' : 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                      {JOB_AGREEMENT_WORDS[k].Noun}
                    </button>
                  )
                })}
                <span style={{ color: 'var(--text-muted)' }}>{kind === 'warranty' ? 'In place of a contract: they initial each line and certify the work, and we warrant it.' : 'Our service agreement: the work, the price, the terms and a signature.'}</span>
              </div>
            ) : null}
            <JobContractPaper
              job={job}
              jobNumber={jobNumber}
              issuer={paperIssuer}
              kind={paperKind}
              initialLines={{ text: shownRow || (paperRow && !paperEditable) ? parseJobContractFields((shownRow ?? paperRow)!.fields).initial_lines.join('\n') : initialsText, apply: applyInitialsText, entries: shownRow ? parseInitials(shownRow.initials) : paperRow ? parseInitials(paperRow.initials) : null }}
              dateLabel={
                paperRow
                  ? formatContractStamp(paperRow.signed_at ?? paperRow.last_sent_at ?? paperRow.created_at)?.split(',').slice(0, 2).join(',') ?? ''
                  : new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              }
              revision={paperRow?.revision ?? liveRow?.revision ?? 1}
              editable={paperEditable}
              fields={shownFields ?? fields}
              setField={setField}
              scopeText={scopeText}
              applyScopeText={applyScopeText}
              recipientName={shownRow ? (signerNamesLine(shownRow) || shownRow.recipient_name || '') : recipientName}
              setRecipientName={(v) => {
                touch()
                setRecipientName(v)
              }}
              amount={{
                src: amountSrc,
                frozenCents: (shownFields ?? fields).amount_cents,
                drift: paperEditable ? amountDrift : null,
                onOpenJob: onEditJob && job ? () => onEditJob(job) : null,
                onUseJobAmount: () => {
                  touch()
                  setField('amount_cents', amountSrc.cents)
                },
              }}
              terms={{
                name: paperRow ? paperRow.template_name ?? paperWords.Noun : templateName,
                clauseCount,
                versionLabel,
                bodyHtml: paperBodyHtml,
                bodyFormat: paperBodyFormat,
                open: termsOpen,
                onToggle: () => setTermsOpen((v) => !v),
                onEdit: paperEditable && selectedTemplate ? () => setTermsEditOpen(true) : null,
                builtInNote: paperEditable && !selectedTemplate ? 'The built-in wording, until the office adds a customer document to the Contract Book.' : null,
              }}
              signature={
                shownRow?.signed_at
                  ? jobContractSignatureBlocks(shownRow, { signatureUrl: recordUrls.signatureUrl }).signature
                  : paperRow?.signer_printed_name && paperRow.signer_consented_at
                    ? { printedName: paperRow.signer_printed_name, auditLine: jobContractSignatureAuditLine(frameAsSignerRow(signerFrames(paperRow)[0]!)) ?? '', imageUrl: recordUrls.signatureUrl }
                    : null
              }
              filed={filedDoc}
              // A paper record's signatures are on the scan: no open second frame beside it (v2.4590).
              coSigner={paperRow ? (paperRow.signer_mode === 'paper' ? { name: '', email: '' } : { name: paperRow.co_signer_name ?? '', email: paperRow.co_signer_email ?? '' }) : coSigner}
              setCoSigner={
                paperEditable
                  ? (v) => {
                      touch()
                      setCoSigner(v)
                    }
                  : undefined
              }
              // A second frame filed from the paper is named in the paper's one mark, as its print does (v2.4657);
              // one signed through the link keeps its own mark, and so does one filed from the paper after the
              // first signed through the link (v2.5101): the print's blocks say which.
              coSignature={
                shownRow?.signed_at
                  ? jobContractSignatureBlocks(shownRow, { coSignatureUrl: recordUrls.coSignatureUrl }).coSignature
                  : paperRow?.co_signer_name && paperRow.co_signed_at && paperRow.co_signer_mode !== 'paper'
                  ? { printedName: paperRow.co_signer_printed_name ?? '', auditLine: jobContractSignatureAuditLine(frameAsSignerRow(signerFrames(paperRow)[1]!)) ?? '', imageUrl: recordUrls.coSignatureUrl }
                  : null
              }
            />
            </>
          )}
          {templatesForKind.length > 1 && paperEditable ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>Terms document</span>
              <select style={{ ...inputStyle, maxWidth: 360 }} value={templateId} onChange={(e) => { touch(); setTemplateId(e.target.value) }} aria-label="Standard terms document">
                {templatesForKind.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.document_name}
                    {t.book_version_date ? ` · ${t.book_version_date}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '0.3rem 0.8rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span style={{ color: autosaveState === 'error' || autosaveState === 'held' ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
              {shownRow ? (shownRow.signed_at ? 'The agreement as signed.' : 'The agreement as sent.') : signedView ? '' : !rowsLoaded ? 'Loading…' : !editable ? 'Locked — it is out' : autosaveState === 'saving' ? 'Saving…' : autosaveState === 'saved' ? 'Saved as you type.' : autosaveState === 'error' ? 'Save failed' : autosaveState === 'held' ? draftHeldByDateMessage(new Date().getFullYear()) : 'Saves as you type. Hover a line to see what edits.'}
            </span>
            {(signedView && !('row' in signedView)) || filedDoc ? null : (
              <button type="button" style={linkBtn} disabled={busy != null} onClick={shownRow ? () => viewHistoryRow(shownRow) : preview}>
                Open full size
              </button>
            )}
            {signedView ? null : (
              <>
            <button type="button" style={linkBtn} disabled={busy != null} onClick={() => void downloadPdf()} title="The agreement as it reads right now, with blank Sign and Date rules — nothing is sent or recorded" data-testid="contract-download-pdf">
              {busy === 'pdf' ? 'Building…' : 'Download the PDF'}
            </button>
            <span>— records nothing; the rail's On paper does.</span>
              </>
            )}
          </div>
          {historyRows.length > 0 ? (
            <>
              <div style={sectionHead}>History</div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {historyRows.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      rev {r.revision} · {r.template_name ?? JOB_AGREEMENT_WORDS[jobAgreementKindOf(r.kind)].Noun}
                      {r.signed_at ? ` · ${jobContractSignersAuditLine(r) ?? ''}` : r.last_sent_at ? ` · sent ${formatContractStamp(r.last_sent_at) ?? ''}` : ` · ${formatContractStamp(r.created_at) ?? ''}`}
                    </span>
                    {jobContractChips(r).map((chip) => (
                      <span key={chip.label} style={{ ...jobContractChipColors(chip.tone), padding: '0.05rem 0.45rem', borderRadius: 999, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {chip.label}
                      </span>
                    ))}
                    <button type="button" style={{ ...btn, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }} onClick={() => (r.signed_at ? setRecordRow(r) : viewHistoryRow(r))}>
                      View
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {lastLink ? (
            <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              Signing link: <a href={lastLink} target="_blank" rel="noopener noreferrer">{jobContractSigningUrl(window.location.origin, '…')}</a>
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: '0.6rem', alignContent: 'start', minWidth: 0 }}>
          {notNeeded && !signedView ? (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem' }} data-testid="contract-not-needed-strip">
              <span style={{ flex: 1, minWidth: 200 }}>
                <b style={{ color: 'var(--text-700)' }}>Not needed</b>
                {formatContractStamp(notNeeded.at) ? ` · marked ${formatContractStamp(notNeeded.at)}` : ''}
                {notNeeded.reason ? ` · ${notNeeded.reason}` : ''}
                {' — this job is out of the contract count. Sending or filing an agreement still works.'}
              </span>
              <button type="button" style={btn} disabled={notNeededBusy} onClick={() => void writeNotNeeded(null)}>
                {notNeededBusy ? 'Saving…' : 'Needed after all'}
              </button>
            </div>
          ) : null}
          {!rowsLoaded ? <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading the agreement…</div> : null}
          {signedView ? (
            <JobContractSignedRail
              job={job}
              jobNumber={jobNumber}
              source={signedView.source}
              row={shownRow}
              estimate={'row' in signedView ? null : { estimateId: signedView.coverage.estimateId, estimateNumber: signedView.coverage.estimateNumber, signerName: signedView.coverage.signerName, signedAt: signedView.coverage.signedAt }}
              estimateRow={estimateRow}
              urls={recordUrls}
              onStartNew={
                liveRow
                  ? null
                  : () => {
                      setRecordRow(null)
                      setStartNew(true)
                    }
              }
              onOpenJob={onEditJob && job ? () => onEditJob(job) : null}
              onBack={recordRow && (liveRow || startNew || signedRows[0]?.id !== recordRow.id) ? () => setRecordRow(null) : null}
              onClose={onClose}
            />
          ) : null}
          {signedView ? null : sentRail}
          {textDoor && job && !signedView ? (
            <ContractTextDoor
              title="Text the signing link"
              jobId={job.id}
              jobName={jobBoxJobName(job)}
              jobStatus={job.status ?? null}
              customerId={job.customer_id ?? null}
              typedPhone={recipientPhone}
              words={contractSignTextWords(job.job_address, textDoor.url)}
              onClose={() => setTextDoor(null)}
              onCopyLink={() => void copyLink()}
              onSent={() => {
                setTextDoor(null)
                dispatchChanged()
                onChanged?.()
              }}
            />
          ) : null}
          {paperEditable ? (
            <JobContractSigningRail
              plan={plan}
              way={way}
              onPick={(w) => setPickedWay(w)}
              oursShown={oursShown}
              onShowOurs={() => {
                setOursShown(true)
                setPickedWay(effectiveWindowWay({ ...plan, ways: plan.demoted, demoted: [] }, null))
              }}
              gcName={gcName}
              recipientName={recipientName}
              setRecipientName={(v) => { touch(); setRecipientName(v) }}
              email={recipientEmail}
              setEmail={(v) => { touch(); setRecipientEmail(v) }}
              phone={recipientPhone}
              setPhone={(v) => { touch(); setRecipientPhone(v) }}
              textToo={textToo}
              setTextToo={setTextToo}
              phoneNote={phoneNote}
              cc={ccText}
              setCc={(v) => { touch(); setCcText(v) }}
              message={message}
              setMessage={setMessage}
              remindersEnabled={remindersEnabled}
              setRemindersEnabled={(v) => { touch(); setRemindersEnabled(v) }}
              paperSend={paperSend}
              setPaperSend={setPaperSend}
              sentence={sentence}
              button={wayButton}
              busy={busy != null}
              onGo={goWay}
              onCopyLink={() => void copyLink()}
              onFileSigned={openFiling}
              onNotNeeded={() => setNotNeededOpen(true)}
              notNeededPanel={notNeededPanel}
            />
          ) : null}
          {!editable && !signedView && notNeededPanel}
        </div>
      </div>
      {termsEditOpen && selectedTemplate ? (
        <StandardTermsEditModal
          doc={selectedTemplate}
          openJobs={0}
          onClose={() => setTermsEditOpen(false)}
          onSaved={(saved) => {
            setTemplates((prev) => prev.map((t) => (t.id === saved.id ? { ...t, document_name: saved.document_name, book_body_html: saved.book_body_html, book_version_date: saved.book_version_date } : t)))
            setTermsEditOpen(false)
            touch()
          }}
        />
      ) : null}
      {paperOpen && job ? (
        <JobContractFileSheet
          layout="sheet"
          jobId={job.id}
          defaultSignerName={filingTheirs && gcName ? gcName : recipientName.trim() || (job.customer_name ?? '').trim()}
          // v2.4657: the second signer gets a box of their own, filed as the second signature.
          defaultCoSignerName={filingTheirs ? '' : coSigner.name}
          existingDraft={liveRow && (jobContractStatus(liveRow) === 'draft' || isAwaitingPaperCopy(liveRow)) ? liveRow : null}
          basePayload={buildRowPayload()}
          onFiled={() => void onPaperFiled()}
          onCancel={() => setPaperOpen(false)}
        />
      ) : null}
    </ResponsiveModalShell>
  )
}
