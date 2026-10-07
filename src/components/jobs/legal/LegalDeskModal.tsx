import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { JobWithDetails } from '../../../types/jobWithDetails'
import type { Database } from '../../../types/database'
import type { JobContractCoverage } from '../../../lib/jobs/jobContractCoverage'
import { envelopeAnswersWords, envelopeKindWords, envelopeMonthsWords, envelopeSharesWords, envelopeWentOutWords, legalLastWorkWords, type LegalEnvelope } from '../../../lib/legal/legalLienPaper'
import { conversationRows, conversationStateWords, conversationWho, entryRecordedByWords, isConversationEntry, legalEntryKindWords, newAskMeta, officeAnswerMeta, stepProposalOf, type LegalAskFlavor } from '../../../lib/legal/legalAsks'
import LienTimelineStrip from '../LienTimelineStrip'
import {
  formatLegalMoney,
  groupCollectionsByPayer,
  quickNet,
  sortAccountsByNet,
  type LegalAccountSummary,
  type LegalGap,
  type LegalPacket,
  type LegalPayerKey,
  legalLargestOpenLine,
  legalSessionWords,
} from '../../../lib/legal/legalPacket'
import {
  feeModelOf,
  heldOverridesOf,
  legalStageLabel,
  releaseRecipients,
  WEEKDAY_LABELS,
  matterAwaitsClose,
  matterIsClosed,
  matterIsWithFirm,
  heldReasonsOf,
  withHold,
  type LegalMatterRow,
} from '../../../lib/legal/legalMatters'
import { buildLegalPacketPrintHtml } from '../../../lib/legal/legalPacketPrint'
import { CONTINGENCY_ENTRY_META, contingencyEntries, contingencyEntryBody, firmFeeEntries, firmFeeRows, legalRunningLedger } from '../../../lib/legal/legalMoney'
import { propertyKindCell, propertySourceNote } from '../../../lib/legal/legalProperty'
import { FirmMatterView } from './LegalFirmMatterView'
import type { FirmTab } from './legalFirmMatterViewShared'
import type { LegalEntryRow } from '../../../lib/legal/legalMatters'
import { INK as PORTAL_INK, MUTED as PORTAL_MUTED, PAPER as PORTAL_PAPER, PORTAL_FONT } from '../../../lib/portal/portalTheme'
import { printAndFile } from '../../../lib/sent/sentCopiesIo'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../../utils/dateUtils'
import { useEditCustomerModal } from '../../../contexts/EditCustomerModalContext'
import { useToastContext } from '../../../contexts/ToastContext'
import { legalRpc, legalRpcData, type LegalMattersData } from '../../../hooks/useLegalMatters'
import { settlementFloorDollars, settlementFloorOf, settlementFloorWords, type LegalSettlementFloor } from '../../../../supabase/functions/_shared/legalSettlement'
import { isVoidedEntry, officeCanVoid } from '../../../../supabase/functions/_shared/legalPortalActs'
import AgreedWriteDownModal from '../AgreedWriteDownModal'
import LegalPortalLinkButton from './LegalPortalLinkButton'
import LegalFirmWindow from './LegalFirmWindow'
import { legalNotReachingLine } from '../../../lib/legal/legalNotifyLedger'
import { useLegalPacketData } from './useLegalPacketData'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * The Legal desk (PR 1 v2.3293 read side; PR 2 v2.3313 the gate): the office's
 * review of every Collections account BEFORE anything is released to an
 * attorney. The five tabs the firm's portal mirrors — Account · Paper · Their
 * word · Evidence · Fees & steps — under the theory an attorney could plead,
 * what Click keeps after the firm's cut, and the gap list a firm asks about
 * first. Every door opens the surface that owns the record.
 *
 * Two exits: a dev's **Mark attorney ready** IS the release (stage → referred,
 * the firm's portal picks it up); **Write down…** opens the agreed write-down
 * and closes the matter. The office asks a dev with one click. Every "what
 * was said" entry goes to counsel unless the office holds it back with a
 * reason (#85 item 29), stored on the matter.
 *
 * Opens from the ⚖ Legal button in the Collections header tier (mirrors the
 * Accounts Receivable button: modal in place, `?legal=<payer key>` deep link).
 */
const TABS = ['account', 'paper', 'their_word', 'evidence', 'fees_steps'] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, string> = { account: 'Account', paper: 'Paper', their_word: 'Their word', evidence: 'Evidence', fees_steps: 'Fees & steps' }

export type LegalDeskModalProps = {
  open: boolean
  onClose: () => void
  /** Every job the board has in Collections (all payers). */
  collectionsJobs: JobWithDetails[]
  /** Punch list #94 (v2.4794): the Collections jobs the office gave up on — the rail's *Given up on* group, never released to the firm. */
  uncollectibleJobs?: JobWithDetails[]
  /** The board still fetching the billed/Collections scope — show a wait, not an empty rail. */
  jobsLoading?: boolean
  contractCoverage: ReadonlyMap<string, JobContractCoverage>
  users: ReadonlyArray<{ id: string; name: string | null }>
  companyName: string
  /** `?legal=<payer key>` — which account to open on. */
  initialPayerKey?: LegalPayerKey | null
  /** `&legalTab=fees` — which tab to open on (the office's Needs You card lands on the firm's acts). */
  initialTab?: 'account' | 'paper' | 'their_word' | 'evidence' | 'fees_steps' | null
  /** The stored side (PR 2): matters, the firm, entries. Absent in tests / before the migration. */
  legal?: LegalMattersData | null
  /** Only a dev marks attorney-ready and pulls back. */
  canMarkReady?: boolean
  /** Office roles curate: held entries, ask a dev, write down. */
  canEditReview?: boolean
  /** Only a dev changes the collections law firm (RLS on `legal_firms`); the firm window is read only for everyone else. Defaults to `canMarkReady`. */
  canEditFirm?: boolean
  onOpenContract: (job: JobWithDetails) => void
  onOpenLienInstruments: (job: JobWithDetails) => void
  onOpenEditJob: (jobId: string) => void
  onOpenCallMode: () => void
  onOpenAccountsReceivable: () => void
  onOpenSessionNotes: (job: JobWithDetails) => void
  onOpenReports: (job: JobWithDetails) => void
  onOpenJobThread: (jobId: string) => void
  onOpenPromisedPay: (args: { jobId: string; jobLabel: string; initialYmd: string | null }) => void
  onFocusJob: (jobId: string) => void
  /** After a write-down succeeds — reload the board so balances and the row follow. */
  onAfterWriteDown: () => void | Promise<void>
  overlayZIndex?: number
}

const MUTED: CSSProperties = { color: 'var(--text-muted)' }
const NUM: CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }
const TH: CSSProperties = { textAlign: 'left', fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, padding: '6px 8px', borderBottom: '1px solid var(--border)' }
const TD: CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top', fontSize: '0.84rem' }
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 0.55rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.74rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }
/** The firm's name in the header, as the door to its window (v2.4711); amber while no firm is set. */
const FIRM_CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%', padding: '0 8px', border: '1px solid var(--border-blue)', borderRadius: 999, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', font: 'inherit', fontSize: '0.76rem', fontWeight: 600, lineHeight: 1.6, cursor: 'pointer', textAlign: 'left', verticalAlign: 'baseline' }
const FIRM_CHIP_NONE: CSSProperties = { ...FIRM_CHIP, border: '1px solid var(--border-amber-soft)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }
const sheetInput: CSSProperties = { width: '100%', font: 'inherit', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', margin: '4px 0 8px' }

type Tone = 'stop' | 'warn' | 'ok' | 'neutral' | 'legal' | 'blue'
function pill(text: string, tone: Tone): ReactNode {
  const colors: Record<Tone, CSSProperties> = {
    stop: { background: 'rgba(180,35,24,0.12)', color: '#b42318' },
    warn: { background: 'rgba(154,103,0,0.14)', color: '#9a6700' },
    ok: { background: 'rgba(31,122,58,0.14)', color: '#1f7a3a' },
    neutral: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
    legal: { background: 'rgba(122,46,46,0.12)', color: '#7a2e2e' },
    blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  }
  return <span style={{ ...colors[tone], fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{text}</span>
}

function Door({ label, onClick, title }: { label: string; onClick: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} style={{ ...btn, height: 24, fontSize: '0.72rem', textTransform: 'none', letterSpacing: 0 }}>
      {label} ↗
    </button>
  )
}

/** Under a § 53.056 notice on the desk's Paper tab (#41 PR 1b) — the same words the firm reads. */
function DeskEnvelopeAnswersBand({ e, packet }: { e: LegalEnvelope; packet: LegalPacket }) {
  if (!e.answers) return null
  const w = envelopeAnswersWords(e.answers, { todayYmd: packet.todayYmd, gcName: packet.account.payer.viaGc ? packet.account.payer.name : 'the GC', formatMoney: formatLegalMoney })
  return (
    <div data-legal-envelope-answers={e.key} style={{ background: 'var(--bg-200)', borderRadius: 6, padding: '6px 10px', fontSize: '0.8rem', lineHeight: 1.45 }}>
      <div><b>The owner's answers</b> <span style={MUTED}>· {w.owner}</span></div>
      <div><b>Letter two</b> <span style={MUTED}>· {w.letterTwo}</span> <b style={{ marginLeft: 10 }}>GC's written okay to pay Click direct:</b> <span style={MUTED}>{w.gcOkay}</span></div>
    </div>
  )
}

function SectionTitle({ children, doors }: { children: ReactNode; doors?: ReactNode }) {
  return (
    <h4 style={{ margin: '18px 0 6px', fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span>{children}</span>
      {doors ? <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{doors}</span> : null}
    </h4>
  )
}

function Table({ head, rows, empty, numCols = [], subRows = [] }: { head: string[]; rows: ReactNode[][]; empty: string; numCols?: number[]; /** A full-width row under row i when set (the answers band under a notice, #41 PR 1b). */ subRows?: Array<ReactNode | null> }) {
  if (rows.length === 0) return <p style={{ ...MUTED, fontSize: '0.84rem', margin: '4px 0' }}>{empty}</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{head.map((h, i) => <th key={`${h}-${i}`} style={{ ...TH, ...(numCols.includes(i) ? { textAlign: 'right' } : null) }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.flatMap((r, ri) => [
            <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ ...TD, ...(numCols.includes(ci) ? NUM : null) }}>{c}</td>)}</tr>,
            ...(subRows[ri] ? [<tr key={`${ri}-sub`}><td colSpan={head.length} style={{ ...TD, paddingTop: 0 }}>{subRows[ri]}</td></tr>] : []),
          ])}
        </tbody>
      </table>
    </div>
  )
}

function coverageText(c: JobContractCoverage): string {
  if (c.kind === 'signed') return `Signed${c.signedAt ? ` ${calendarYmdInAppTzFromIso(c.signedAt)}` : ''}${c.signerName ? ` by ${c.signerName}` : ''} · ${c.source}`
  if (c.kind === 'sent') return `Sent ${calendarYmdInAppTzFromIso(c.sentAt)} · viewed ${c.viewCount}× · never signed`
  if (c.kind === 'draft') return 'Draft, never sent'
  return 'None on file'
}

const FIX_LABEL: Record<LegalGap['fix'], string> = {
  contract: 'Contract…',
  lien_instruments: 'Liens on the job…',
  edit_customer: 'Edit customer…',
  edit_job: 'Edit job…',
  call_mode: 'Call mode…',
  collections_note: 'Edit job…',
  write_down: 'Write down…',
  none: '',
}

type Sheet = { kind: 'ready'; handling: string; note: string; /** #85 item 20: an optional settlement floor set with the release. */ floor?: string; floorUnit?: 'pct' | 'usd' } | { kind: 'ask'; note: string } | { kind: 'pull'; note: string } | { kind: 'close'; note: string } | null

function daysAgo(iso: string | null | undefined, todayYmd: string): number | null {
  // An instant's day in APP_CALENDAR_TZ, not its first ten characters (the UTC date).
  const y = calendarYmdInAppTzFromIso(iso ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(y)) return null
  const a = Date.UTC(Number(y.slice(0, 4)), Number(y.slice(5, 7)) - 1, Number(y.slice(8, 10)))
  const b = Date.UTC(Number(todayYmd.slice(0, 4)), Number(todayYmd.slice(5, 7)) - 1, Number(todayYmd.slice(8, 10)))
  return Math.round((b - a) / 86_400_000)
}

export default function LegalDeskModal(props: LegalDeskModalProps) {
  const { open, onClose, collectionsJobs, uncollectibleJobs = [], jobsLoading = false, contractCoverage, users, companyName, initialPayerKey = null, initialTab = null, legal = null, canMarkReady = false, canEditReview = false, canEditFirm = canMarkReady, overlayZIndex = 760 } = props
  const { showToast } = useToastContext()
  const editCustomer = useEditCustomerModal()
  const todayYmd = todayYmdInAppTz()
  const firm = legal?.firm ?? null
  const fee = useMemo(() => feeModelOf(firm), [firm])
  const accounts = useMemo(
    () => sortAccountsByNet(groupCollectionsByPayer(collectionsJobs, contractCoverage, todayYmd), (a) => quickNet(a.balance, fee)),
    [collectionsJobs, contractCoverage, todayYmd, fee],
  )
  // v2.4794: the accounts the office gave up on — read like any other, never marked attorney-ready.
  const givenUpAccounts = useMemo(
    () => sortAccountsByNet(groupCollectionsByPayer(uncollectibleJobs, contractCoverage, todayYmd), (a) => quickNet(a.balance, fee)),
    [uncollectibleJobs, contractCoverage, todayYmd, fee],
  )
  const [selectedKey, setSelectedKey] = useState<LegalPayerKey | null>(null)
  const [tab, setTab] = useState<Tab>('account')
  const [gapsOpen, setGapsOpen] = useState(true)
  const [writeDown, setWriteDown] = useState<{ invoice: JobsLedgerInvoice; job: JobWithDetails } | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [busy, setBusy] = useState(false)
  const [answerFor, setAnswerFor] = useState<{ entryId: string; text: string } | null>(null)
  /** Ask the firm (#41 PR 3): a question, or a sign-off on one job. */
  const [askForm, setAskForm] = useState<{ flavor: LegalAskFlavor; jobId: string; text: string } | null>(null)
  const [emailsOpen, setEmailsOpen] = useState(false)
  /** The firm's window (v2.4711), opened from the firm's name in the header or the release sheet. */
  const [firmOpen, setFirmOpen] = useState(false)
  /** Hold back… on the Their word tab (#85 item 29): which entry, and the office's reason. */
  const [holdFor, setHoldFor] = useState<{ key: string; reason: string } | null>(null)
  /** The Mark attorney ready sheet's preview: the firm's own view of this account, held entries left out (v2.3363). */
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTab, setPreviewTab] = useState<FirmTab>('account')

  useEffect(() => {
    if (!open) return
    const wanted = initialPayerKey && accounts.some((a) => a.key === initialPayerKey) ? initialPayerKey : null
    setSelectedKey((prev) => wanted ?? (prev && accounts.some((a) => a.key === prev) ? prev : (accounts[0]?.key ?? null)))
    if (initialTab) setTab(initialTab)
  }, [open, initialPayerKey, initialTab, accounts])

  const selected: LegalAccountSummary | null = accounts.find((a) => a.key === selectedKey) ?? givenUpAccounts.find((a) => a.key === selectedKey) ?? null
  const selectedGivenUp = selected != null && givenUpAccounts.some((a) => a.key === selected.key)
  const matter: LegalMatterRow | null = selected ? (legal?.byPayerKey.get(selected.key) ?? null) : null
  const holdOverrides = useMemo(() => heldOverridesOf(matter), [matter])
  const { packet, loading, failed, reload } = useLegalPacketData(selected, users, open && selected != null, holdOverrides, fee)

  if (!open) return null

  const stage = matter?.stage ?? 'review'
  // #85 item 16: a firm end (settled · uncollectible · dismissed) stays with the firm until the office closes it.
  const withFirm = matterIsWithFirm(matter)
  const closed = matterIsClosed(matter)
  const awaitsClose = matterAwaitsClose(matter)
  const stored = Boolean(legal?.available)
  const groups: Array<{ cap: string; list: LegalAccountSummary[] }> = [
    { cap: 'Needs a dev’s eyes', list: accounts.filter((a) => { const m = legal?.byPayerKey.get(a.key); return !m || (!matterIsWithFirm(m) && !matterIsClosed(m)) }).sort((x, y) => Number(Boolean(legal?.byPayerKey.get(y.key)?.review_requested_at)) - Number(Boolean(legal?.byPayerKey.get(x.key)?.review_requested_at))) },
    { cap: 'With the firm', list: accounts.filter((a) => matterIsWithFirm(legal?.byPayerKey.get(a.key))) },
    { cap: 'Closed', list: accounts.filter((a) => matterIsClosed(legal?.byPayerKey.get(a.key))) },
    { cap: 'Given up on', list: givenUpAccounts },
  ]

  const firstJob = selected?.jobs[0] ?? null
  const jobById = (id: string | null) => (id ? (selected?.jobs.find((j) => j.id === id) ?? firstJob) : firstJob)
  const jobIds = selected?.jobs.map((j) => j.id) ?? []
  const openEditCustomer = () => {
    if (selected?.customerId && editCustomer) editCustomer.openEditCustomerModal(selected.customerId, { onSaved: reload })
    else if (firstJob) props.onOpenEditJob(firstJob.id)
  }
  const openWriteDown = (jobId: string | null) => {
    // No job named (the header's button): the account's largest open bill line, whichever job holds it.
    const largest = jobId ? null : legalLargestOpenLine(packet?.account.jobs ?? [])
    const job = jobById(jobId ?? largest?.jobId ?? null)
    const line = packet?.account.jobs.find((l) => l.jobId === job?.id)
    const inv = job?.invoices.find((i) => i.id === line?.primaryInvoiceId) ?? null
    if (!job || !inv) {
      showToast('No billed line to write down on this job — create its bill line first.', 'info')
      return
    }
    setWriteDown({ invoice: inv, job })
  }
  const fixGap = (g: LegalGap) => {
    const job = jobById(g.jobId)
    switch (g.fix) {
      case 'contract': if (job) props.onOpenContract(job); return
      case 'lien_instruments': if (job) props.onOpenLienInstruments(job); return
      case 'edit_job': if (job) props.onOpenEditJob(job.id); return
      case 'collections_note': if (job) props.onOpenEditJob(job.id); return
      case 'edit_customer': openEditCustomer(); return
      case 'call_mode': props.onOpenCallMode(); return
      case 'write_down': openWriteDown(g.jobId); return
      default: return
    }
  }
  const printPacket = () => {
    if (!packet) return
    // A print counts as a send (docs/SENT_COPIES.md): the packet for counsel is filed on its jobs and its payer.
    const filing = { kind: 'legal_packet', title: `Legal packet for ${packet.account.payer.name}`, recipientName: 'Counsel', jobIds: packet.account.jobs.map((j) => j.jobId), customerId: packet.account.payer.customerId }
    if (!printAndFile(buildLegalPacketPrintHtml(packet, { preparedOn: todayYmd, companyName }), filing)) showToast('Your browser blocked the print window. Allow pop-ups for this site and try again.', 'error')
  }

  // --- the stored acts (PR 2) ------------------------------------------------
  const run = async (label: string, fn: () => Promise<string | null>) => {
    if (!selected) return
    setBusy(true)
    try {
      const err = await fn()
      if (err) {
        showToast(`${label}: ${err}`, 'error')
        return false
      }
      await legal?.reload()
      return true
    } finally {
      setBusy(false)
    }
  }
  const saveReview = (args: { heldOverrides?: Record<string, unknown>; requestReview?: boolean; note?: string }) =>
    legalRpc('legal_matter_save_review', {
      p_payer_key: selected?.key,
      p_customer_id: selected?.customerId,
      p_payer_name: selected?.name,
      p_job_ids: jobIds,
      p_held_overrides: args.heldOverrides ?? null,
      p_request_review: args.requestReview ?? null,
      p_review_note: args.note ?? null,
    })
  /** #85 item 29: everything goes to counsel; the office holds one entry back, with a reason, or shares it again. */
  const holdBack = async (key: string, reason: string) => {
    if (!reason.trim()) return
    const ok = await run('Hold back', () => saveReview({ heldOverrides: withHold(matter, key, reason) }))
    if (ok) setHoldFor(null)
  }
  const shareAgain = async (key: string) => {
    await run('Share', () => saveReview({ heldOverrides: withHold(matter, key, null) }))
  }
  const shareAll = async () => {
    await run('Share all', () => saveReview({ heldOverrides: {} }))
  }
  const confirmReady = async () => {
    if (sheet?.kind !== 'ready' || !firm) return
    const floorN = Number(sheet.floor ?? '')
    const wantsFloor = Number.isFinite(floorN) && floorN > 0
    const setFloor = (matterId: string) => legalRpc('legal_set_settlement_floor', { p_matter_id: matterId, p_amount: sheet.floorUnit === 'usd' ? floorN : null, p_pct: sheet.floorUnit === 'usd' ? null : floorN })
    const ok = await run('Attorney-ready', async () => {
      // #85 item 20 review: the floor goes on first, so the firm never sees the matter without it. A matter the
      // desk has not saved yet has no row to put it on, so its floor follows the release at once.
      if (wantsFloor && matter?.id) {
        const fe = await setFloor(matter.id)
        if (fe) return fe
      }
      const r = await legalRpcData('legal_mark_attorney_ready', { p_payer_key: selected?.key, p_customer_id: selected?.customerId, p_payer_name: selected?.name, p_job_ids: jobIds, p_firm_id: firm.id, p_handling_name: sheet.handling, p_note: sheet.note })
      if (r.error) return r.error
      const matterId = typeof r.data?.matter_id === 'string' ? r.data.matter_id : null
      if (wantsFloor && matterId && matterId !== matter?.id) return setFloor(matterId)
      return null
    })
    if (ok) {
      setSheet(null)
      showToast(`${selected?.name} is attorney-ready — it is with ${firm.name} now.`, 'success')
    }
  }
  const confirmAsk = async () => {
    if (sheet?.kind !== 'ask') return
    const ok = await run('Ask a dev', () => saveReview({ requestReview: true, note: sheet.note }))
    if (ok) {
      setSheet(null)
      showToast('Asked — it moves to the top of the dev’s Needs You card.', 'success')
    }
  }
  const withdrawAsk = async () => {
    const ok = await run('Withdraw', () => saveReview({ requestReview: false }))
    if (ok) showToast('Request withdrawn.', 'info')
  }
  const confirmPull = async () => {
    if (sheet?.kind !== 'pull' || !matter) return
    const ok = await run('Pull back', () => legalRpc('legal_pull_back', { p_matter_id: matter.id, p_note: sheet.note }))
    if (ok) {
      setSheet(null)
      showToast(`${selected?.name} pulled back — the firm keeps a read-only page with your reason.`, 'info')
    }
  }
  /** #85 item 16: the firm's end moved the stage; the office's close is the end of the matter. */
  const confirmClose = async () => {
    if (sheet?.kind !== 'close' || !matter) return
    const ok = await run('Close', () => legalRpc('legal_close_matter', { p_matter_id: matter.id, p_stage: matter.stage, p_note: sheet.note }))
    if (ok) {
      setSheet(null)
      showToast(`${selected?.name} closed as ${legalStageLabel(matter.stage).toLowerCase()} — it leaves the firm's portal.`, 'success')
    }
  }
  const acknowledge = async (entryId: string) => {
    await run('Acknowledge', () => legalRpc('legal_acknowledge_entry', { p_entry_id: entryId }))
  }
  const sendAnswer = async () => {
    if (!answerFor || !matter) return
    const text = answerFor.text.trim()
    if (!text) return
    const ok = await run('Answer', async () => (await legalRpc('legal_add_entry', { p_matter_id: matter.id, p_kind: 'answer', p_body: text, p_meta: officeAnswerMeta(answerFor.entryId) })) ?? (await legalRpc('legal_acknowledge_entry', { p_entry_id: answerFor.entryId })))
    if (ok) {
      setAnswerFor(null)
      showToast('Answer sent — the firm sees it on their portal.', 'success')
    }
  }
  const sendAsk = async () => {
    if (!askForm || !matter) return
    const text = askForm.text.trim()
    if (!text) return
    const job = askForm.flavor === 'signoff' ? packet?.account.jobs.find((j) => j.jobId === askForm.jobId) ?? null : null
    const ok = await run('Ask the firm', () => legalRpc('legal_add_entry', { p_matter_id: matter.id, p_kind: 'question', p_body: text, p_meta: newAskMeta({ flavor: askForm.flavor, jobId: job?.jobId ?? null, jobLabel: job?.label ?? '' }) }))
    if (ok) {
      setAskForm(null)
      showToast(askForm.flavor === 'signoff' ? 'Asked — the firm sees it on their portal; their sign-off lands on your Needs You list.' : 'Asked — the firm sees it on their portal; their answer lands on your Needs You list.', 'success')
    }
  }
  /** #85 item 20: sign off a settlement under the floor (moves the stage to settled), or say not yet. */
  const answerSettlement = async (entryId: string, signedOff: boolean, note: string) => {
    const ok = await run(signedOff ? 'Sign off' : 'Not yet', () => legalRpc('legal_answer_settlement', { p_entry_id: entryId, p_signed_off: signedOff, p_note: note }))
    if (ok) showToast(signedOff ? 'Signed off — the matter is settled, and the firm is told.' : 'Sent — the firm sees your answer; the stage stays.', signedOff ? 'success' : 'info')
  }
  /** #85 item 18: undo an entry the office wrote, with a reason the firm reads. */
  const voidEntry = async (entryId: string, reason: string): Promise<boolean> => {
    const ok = await run('Undo', () => legalRpc('legal_void_entry', { p_entry_id: entryId, p_reason: reason }))
    if (ok) showToast('Undone — it stays on the record, struck through, out of every total.', 'info')
    return Boolean(ok)
  }
  /** #85 item 16: accept a firm step that would have moved the stage back. */
  const moveStage = async (stageTo: string, entryId: string) => {
    if (!matter) return
    const ok = await run('Move the stage', () => legalRpc('legal_set_stage', { p_matter_id: matter.id, p_stage: stageTo, p_entry_id: entryId }))
    if (ok) showToast(`Stage moved to ${legalStageLabel(stageTo).replace('With the firm · ', '')}.`, 'success')
  }
  const setSettlementFloor = async (amount: number | null, pct: number | null) => {
    if (!matter) return
    const ok = await run('Settlement floor', () => legalRpc('legal_set_settlement_floor', { p_matter_id: matter.id, p_amount: amount, p_pct: pct }))
    if (ok) showToast(amount == null && pct == null ? 'No floor — the firm may settle at any amount.' : 'Floor saved — the firm sees it on the matter.', 'success')
  }
  const withdrawFirmAsk = async (entryId: string) => {
    const ok = await run('Withdraw', () => legalRpc('legal_acknowledge_entry', { p_entry_id: entryId }))
    if (ok) showToast('Withdrawn — the firm no longer sees it.', 'info')
  }
  /** A payment the firm reported, applied by the office through Mark Paid on the job: record the recovery and the firm's cut on the matter. */
  const markApplied = async (entry: { id: string; amount: number | null; body: string }) => {
    if (!matter) return
    const amt = Number(entry.amount ?? 0)
    const cut = Math.round(amt * fee.contingencyPct * 100) / 100
    const ok = await run('Apply', async () => {
      const e1 = await legalRpc('legal_add_entry', { p_matter_id: matter.id, p_kind: 'recovery_applied', p_amount: amt, p_body: `Applied to the job — ${entry.body || 'payment received by counsel'}` })
      if (e1) return e1
      if (cut > 0) {
        // Tagged so the firm's demand leaves it out: it is the firm's share of money collected, not a cost the debtor owes (#85 item 5).
        const e2 = await legalRpc('legal_add_entry', { p_matter_id: matter.id, p_kind: 'cost', p_amount: cut, p_body: contingencyEntryBody(fee.contingencyPct, formatLegalMoney(amt)), p_meta: CONTINGENCY_ENTRY_META })
        if (e2) return e2
      }
      return legalRpc('legal_acknowledge_entry', { p_entry_id: entry.id })
    })
    if (ok) showToast(`Recorded: ${formatLegalMoney(amt)} applied, the firm's ${formatLegalMoney(cut)} as a legal cost on the matter.`, 'success')
  }

  const afterWriteDown = async () => {
    setWriteDown(null)
    await props.onAfterWriteDown()
    if (stored && selected) {
      // Record the exit on the matter (create it first when the desk never touched this account).
      const err = (await saveReview({})) ?? null
      if (!err) {
        const m = legal?.byPayerKey.get(selected.key)
        const id = m?.id
        if (id) await legalRpc('legal_close_matter', { p_matter_id: id, p_stage: 'written_down', p_note: 'Agreed write-down on the bill line' })
        else {
          await legal?.reload()
          const m2 = legal?.byPayerKey.get(selected.key)
          if (m2) await legalRpc('legal_close_matter', { p_matter_id: m2.id, p_stage: 'written_down', p_note: 'Agreed write-down on the bill line' })
        }
        await legal?.reload()
      }
    }
    reload()
  }

  const w = packet?.worth ?? null
  const paidOnInvoice = writeDown ? writeDown.job.payments.filter((p) => p.invoice_id === writeDown.invoice.id).reduce((s, p) => s + Number(p.amount ?? 0), 0) : 0
  const requestedDays = daysAgo(matter?.review_requested_at, todayYmd)
  const requesterName = matter?.review_requested_by ? (users.find((u) => u.id === matter.review_requested_by)?.name ?? 'the office') : null
  const recipients = releaseRecipients(firm, sheet?.kind === 'ready' ? sheet.handling : '', legal?.recipients ?? [])
  const firmPaused = Boolean(legal?.firmPaused)
  // v2.4662 (punch list #85 item 26): people whose emails have stopped going through.
  const notReaching = (legal?.recipients ?? []).filter((r) => r.send_failed_since && !r.paused_at).length
  const setFirmPaused = async (paused: boolean) => { await run(paused ? 'Pause' : 'Resume', () => legalRpc('legal_firm_set_paused', { p_firm_id: firm?.id, p_paused: paused })) }
  const removeRecipient = async (id: string, name: string) => { await run('Remove', () => legalRpc('legal_firm_recipient_remove', { p_recipient_id: id })); showToast(`${name} removed from the firm's list.`, 'info') }

  // v2.4794: an account the office gave up on is read, never released — whatever the legal tables say.
  const headerActs: ReactNode = selectedGivenUp ? (
    pill('Given up on — not for the firm', 'neutral')
  ) : !stored ? (
    <span style={{ ...MUTED, fontSize: '0.76rem' }}>Read-only until the legal tables are applied.</span>
  ) : withFirm ? (
    <>
      {awaitsClose
        ? pill(`${legalStageLabel(stage)} · reported by ${firm?.name ?? 'the firm'} · open until you close it`, 'legal')
        : pill(`With ${firm?.name ?? 'the firm'} since ${calendarYmdInAppTzFromIso(matter?.released_at ?? '')} · ${legalStageLabel(stage).replace('With the firm · ', '')}`, 'legal')}
      {awaitsClose && canEditReview ? <button type="button" onClick={() => setSheet({ kind: 'close', note: '' })} disabled={busy} style={btnPrimary}>Close the matter…</button> : null}
      {canMarkReady ? <button type="button" onClick={() => setSheet({ kind: 'pull', note: '' })} style={btn}>Pull back</button> : null}
    </>
  ) : closed ? (
    pill(`${legalStageLabel(stage)} ${calendarYmdInAppTzFromIso(matter?.closed_at ?? '')}${matter?.closed_reason ? ` · ${matter.closed_reason}` : ''}`, 'neutral')
  ) : (
    <>
      {matter?.pulled_at ? pill(`Pulled back ${calendarYmdInAppTzFromIso(matter.pulled_at)}${matter.pulled_reason ? ` · ${matter.pulled_reason}` : ''}`, 'neutral') : null}
      {matter?.review_requested_at ? pill(`${requesterName} asked for a dev${requestedDays != null ? ` · ${requestedDays}d ago` : ''}`, 'blue') : null}
      {canMarkReady ? (
        <button type="button" onClick={() => setSheet({ kind: 'ready', handling: firm?.handling_name ?? '', note: '', floor: '', floorUnit: 'pct' })} disabled={busy} style={btnPrimary}>⚖ Mark attorney ready…</button>
      ) : canEditReview ? (
        matter?.review_requested_at ? (
          <button type="button" onClick={() => void withdrawAsk()} disabled={busy} style={btn}>Withdraw the request</button>
        ) : (
          <button type="button" onClick={() => setSheet({ kind: 'ask', note: '' })} disabled={busy} style={btn}>Ask a dev to review…</button>
        )
      ) : null}
      {canEditReview ? <button type="button" onClick={() => openWriteDown(null)} style={btn}>Write down…</button> : null}
    </>
  )

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: overlayZIndex, padding: 'calc(0.75rem + env(safe-area-inset-top, 0px)) 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
      <div role="dialog" aria-modal="true" aria-label="Legal desk — Collections accounts reviewed before release to an attorney" onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, width: '100%', maxWidth: 1160, height: 'min(92vh, 860px, 100%)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span aria-hidden style={{ fontSize: '1.1rem' }}>⚖</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>Legal · Collections accounts</div>
            <div style={{ ...MUTED, fontSize: '0.78rem' }}>
              Two exits: attorney-ready (a dev — that is what puts it with the firm) or write it down.{' '}
              {stored ? (
                <button type="button" onClick={() => setFirmOpen(true)} data-legal-firm-door={firm ? 'firm' : 'none'} aria-label={firm ? `The collections law firm: ${firm.name}` : 'Set up the collections law firm'} title={firm ? 'The firm: its details, its fee model and our particulars for filing' : 'No collections law firm is set up yet'} style={firm ? FIRM_CHIP : FIRM_CHIP_NONE}>
                  {firm ? <>⚖ {firm.name} <span aria-hidden>✎</span></> : canEditFirm ? 'No firm yet · Set up the firm…' : 'No firm yet'}
                </button>
              ) : null}
            </div>
          </div>
          {stored && firm && canEditReview ? <button type="button" onClick={() => setEmailsOpen(true)} style={btn} title="Who at the firm hears from us, by their own rules">✉ Firm’s emails{firmPaused ? ' · paused' : ''}{notReaching ? ` · ${notReaching} not reaching` : ''}</button> : null}
          {stored && firm && canEditReview ? <LegalPortalLinkButton firmId={firm.id} firmName={firm.name} /> : null}
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, height: 30, width: 30, justifyContent: 'center', padding: 0 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) 1fr', minHeight: 0 }}>
          <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 10 }}>
            <div style={{ ...MUTED, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 6px 2px' }}>
              {accounts.length} account{accounts.length === 1 ? '' : 's'} · {formatLegalMoney(accounts.reduce((s, a) => s + a.balance, 0))} · by what Click would keep
            </div>
            {accounts.length === 0 && givenUpAccounts.length === 0 ? <p style={{ ...MUTED, fontSize: '0.84rem', padding: 6 }}>{jobsLoading ? 'Loading Collections…' : 'Nothing is in Collections.'}</p> : null}
            {groups.map((g) =>
              g.list.length === 0 ? null : (
                <div key={g.cap}>
                  <div style={{ ...MUTED, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '10px 6px 6px' }}>{g.cap} · {g.list.length}</div>
                  {g.list.map((a) => {
                    const on = a.key === selectedKey
                    const m = legal?.byPayerKey.get(a.key)
                    const net = quickNet(a.balance, fee)
                    return (
                      <button key={a.key} type="button" onClick={() => { setSelectedKey(a.key); setTab('account') }} aria-pressed={on}
                        style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 10px', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 6, border: `1px solid ${on ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 6, background: on ? 'var(--bg-muted)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                        <span style={{ ...NUM, fontSize: '0.86rem', fontWeight: 600 }}>{formatLegalMoney(a.balance)}</span>
                        <span style={{ ...MUTED, fontSize: '0.74rem' }}>{a.jobs.length} job{a.jobs.length === 1 ? '' : 's'}{a.viaGc ? ' · GC pays' : ''}{a.signedJobs < a.jobs.length ? ` · ${a.jobs.length - a.signedJobs} no contract` : ' · signed'}</span>
                        <span style={{ ...MUTED, ...NUM, fontSize: '0.74rem' }}>{m && matterIsWithFirm(m) ? legalStageLabel(m.stage).replace('With the firm · ', '') : `keeps ~${formatLegalMoney(Math.max(0, net))}`}</span>
                        <span style={{ ...MUTED, fontSize: '0.72rem', gridColumn: '1 / -1' }}>
                          {m?.review_requested_at && !matterIsWithFirm(m) && !matterIsClosed(m) ? <span style={{ color: 'var(--text-blue-700)' }}>asked for a dev · </span> : null}
                          {a.reviewDays == null ? '' : `${a.reviewDays}d in Collections`}{a.oldestDays != null ? ` · oldest bill ${a.oldestDays}d` : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ),
            )}
          </div>

          <div style={{ overflowY: 'auto', padding: '14px 18px 24px', minWidth: 0 }}>
            {!selected ? null : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selected.name}</div>
                    <div style={{ ...MUTED, fontSize: '0.8rem' }}>
                      {selected.jobs.map((j) => j.hcp_number || j.click_number).filter(Boolean).join(' · ')}{packet?.account.customerAddress ? ` · ${packet.account.customerAddress}` : ''}
                      {matter?.review_requested_at && !withFirm && !closed ? <><br /><span style={{ color: 'var(--text-blue-700)' }}>{requesterName} asked for a dev’s eyes{requestedDays != null ? ` ${requestedDays}d ago` : ''}{matter.review_request_note ? `: “${matter.review_request_note}”` : ''}</span></> : null}
                      {withFirm && matter?.note_to_firm ? <><br /><span style={MUTED}>Note to the firm: “{matter.note_to_firm}”</span></> : null}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...NUM, fontSize: '1.3rem', fontWeight: 700 }}>{formatLegalMoney(selected.balance)}</div>
                    <div style={{ ...MUTED, fontSize: '0.76rem' }}>balance{selected.oldestDays == null ? '' : ` · oldest ${selected.oldestDays}d`}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                    {packet ? pill(packet.readiness.label, packet.readiness.stops > 0 ? 'stop' : packet.readiness.warns > 0 ? 'warn' : 'ok') : null}
                    <button type="button" onClick={printPacket} disabled={!packet} style={{ ...btn, opacity: packet ? 1 : 0.5 }}>⎙ Print packet</button>
                    <span style={{ flex: 1 }} />
                    {headerActs}
                  </div>
                </div>

                {loading && !packet ? <p style={{ ...MUTED, fontSize: '0.84rem' }}>Assembling the packet…</p> : null}
                {failed.length > 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#9a6700', margin: '8px 0 0' }}>
                    Couldn’t load {failed.join(', ')} — those sections read empty here, not in the record.{' '}
                    <button type="button" onClick={reload} style={{ ...btn, height: 22, fontSize: '0.7rem' }}>Retry</button>
                  </p>
                ) : null}

                {packet && w ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, margin: '12px 0 0' }}>
                    {([
                      { label: 'Theory', value: packet.theory.label, sub: packet.theory.basis },
                      { label: 'If every dollar lands', value: formatLegalMoney(w.balance), sub: `less ${Math.round(w.contingencyPct * 100)}% (${formatLegalMoney(w.fee)}) and ${formatLegalMoney(w.filingCost)} costs` },
                      { label: 'Click keeps', value: formatLegalMoney(w.net), sub: w.verdict, tone: w.verdict === 'worth it' ? 'ok' : w.verdict === 'marginal' ? 'warn' : 'stop' },
                      { label: 'Against pursuing', value: w.flags.length ? w.flags.join(' · ') : 'nothing on record', sub: w.flags.length ? '' : 'no dispute, no broken promise, no “no money” note' },
                    ] as Array<{ label: string; value: string; sub: string; tone?: Tone }>).map((c) => (
                      <div key={c.label} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', background: 'var(--surface)' }}>
                        <div style={{ ...MUTED, fontSize: '0.66rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>{c.label}</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{c.value}{c.tone ? pill(c.sub, c.tone) : null}</div>
                        {!c.tone && c.sub ? <div style={{ ...MUTED, fontSize: '0.72rem' }}>{c.sub}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {packet && packet.gaps.length > 0 ? (
                  <div style={{ margin: '12px 0 0', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-muted)' }}>
                    <button type="button" onClick={() => setGapsOpen((o) => !o)} aria-expanded={gapsOpen} style={{ ...btn, border: 'none', background: 'none', width: '100%', justifyContent: 'flex-start', height: 34, padding: '0 12px', fontSize: '0.82rem', fontWeight: 600 }}>
                      <span aria-hidden>{gapsOpen ? '▼' : '▶'}</span> Before this goes to an attorney · {packet.readiness.stops} to fix{packet.readiness.warns ? ` · ${packet.readiness.warns} to know about` : ''}
                    </button>
                    {gapsOpen ? (
                      <ul style={{ listStyle: 'none', margin: 0, padding: '0 12px 10px', display: 'grid', gap: 6 }}>
                        {packet.gaps.map((g) => (
                          <li key={g.key} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'start', fontSize: '0.82rem' }}>
                            {pill(g.severity === 'stop' ? 'fix' : 'note', g.severity)}
                            <span><b>{g.label}</b> <span style={MUTED}>— {g.detail}</span></span>
                            {g.fix !== 'none' ? <button type="button" onClick={() => fixGap(g)} style={btn}>{FIX_LABEL[g.fix]}</button> : <span />}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : packet ? <div style={{ margin: '12px 0 0', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.82rem', color: '#1f7a3a' }}>✓ No gaps — an attorney would have everything they ask for first.</div> : null}

                <div role="tablist" aria-label="Packet sections" style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', margin: '16px 0 4px' }}>
                  {TABS.map((t) => (
                    <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                      style={{ border: 'none', background: 'none', padding: '8px 12px', fontSize: '0.84rem', fontWeight: tab === t ? 600 : 500, color: tab === t ? 'var(--text)' : 'var(--text-muted)', borderBottom: tab === t ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }}>
                      {TAB_LABELS[t]}
                    </button>
                  ))}
                </div>

                {packet ? (
                  <PacketTab tab={tab} packet={packet} selected={selected} props={props} openEditCustomer={openEditCustomer} openWriteDown={openWriteDown}
                    curation={stored && canEditReview ? { holdBack, shareAgain, shareAll, holdFor, setHoldFor, reasons: heldReasonsOf(matter), busy } : null} entries={matter ? (legal?.entriesByMatter.get(matter.id) ?? []) : []}
                    officeActs={stored && canEditReview ? { acknowledge, answerFor, setAnswerFor, sendAnswer, markApplied, busy, onOpenPipelineRow: () => { if (firstJob) props.onFocusJob(firstJob.id) }, askForm: matter ? askForm : null, setAskForm, sendAsk, withdrawFirmAsk, canAsk: matterIsWithFirm(matter), answerSettlement, setSettlementFloor, floor: settlementFloorOf(matter), moveStage, voidEntry } : null} />
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {/* The sheets below sit inside the desk's backdrop, outside its panel: each backdrop stops its
          click, so a click outside a sheet closes that sheet only, not the desk (v2.4352). */}
      {sheet?.kind === 'ready' && selected && packet ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setSheet(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: overlayZIndex + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="Mark attorney-ready" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 620, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Mark {selected.name} attorney-ready?</h3>
            {!firm ? (
              <p style={{ fontSize: '0.86rem', color: '#b42318', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                No firm is set up yet.
                {stored ? <button type="button" onClick={() => { setSheet(null); setFirmOpen(true) }} style={btn}>{canEditFirm ? 'Set up the firm…' : 'See the firm…'}</button> : null}
              </p>
            ) : (
              <>
                <p style={{ ...MUTED, fontSize: '0.84rem', margin: '0 0 8px' }}>
                  This is the release. The matter goes to <b>{firm.name}</b> the moment you confirm — {selected.jobs.length} job{selected.jobs.length === 1 ? '' : 's'}, {formatLegalMoney(selected.balance)}, theory <b>{packet.theory.label}</b>, exhibits A–{packet.exhibits[packet.exhibits.length - 1]?.letter ?? 'A'}.
                  {packet.theirWord.heldCount ? <> <b>{packet.theirWord.heldCount} entr{packet.theirWord.heldCount === 1 ? 'y is' : 'ies are'} held back</b> from the firm.</> : null}
                </p>
                {packet.worth.verdict === 'not worth it' ? <p style={{ fontSize: '0.84rem', color: '#b42318', margin: '0 0 8px' }}><b>Click keeps {formatLegalMoney(packet.worth.net)}.</b> The firm’s cut and costs eat what is left. Write down / stop pursuing is the other exit.</p> : null}
                {packet.readiness.stops ? <p style={{ fontSize: '0.84rem', color: '#b42318', margin: '0 0 8px' }}><b>{packet.readiness.stops} red gap{packet.readiness.stops === 1 ? '' : 's'} still open</b> — {packet.gaps.filter((g) => g.severity === 'stop').map((g) => g.label).join('; ')}. You can mark anyway; the packet says so on its cover sheet.</p> : null}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px' }}>
                  <button type="button" onClick={() => { setPreviewTab('account'); setPreviewOpen(true) }} style={btn}>Preview what the firm sees ↗</button>
                  <span style={{ ...MUTED, fontSize: '0.78rem' }}>Their page for this account, all five tabs, held entries left out.</span>
                </div>
                <label style={{ fontSize: '0.84rem', display: 'block' }}>Handling person at the firm<input value={sheet.handling} onChange={(e) => setSheet({ ...sheet, handling: e.target.value })} placeholder={firm.handling_name || 'Who at the firm takes it'} style={sheetInput} /></label>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}><span>Who hears about it, by their own rules</span><button type="button" onClick={() => setEmailsOpen(true)} style={{ ...btn, height: 22, fontSize: '0.7rem', textTransform: 'none', letterSpacing: 0 }}>Firm’s emails ↗</button></div>
                {recipients.length ? recipients.map((r) => <div key={r.email} style={{ fontSize: '0.84rem', padding: '5px 0', borderTop: '1px solid var(--border-subtle)' }}>{pill(r.bucket === 'now' ? 'Email now' : r.bucket === 'digest' ? 'In their digest' : r.bucket === 'unconfirmed' ? 'Not confirmed' : 'Not emailed', r.bucket === 'now' ? 'legal' : r.bucket === 'unconfirmed' ? 'warn' : 'neutral')} <b>{r.name}</b> <span style={MUTED}>{r.email} · {r.why}</span></div>) : <p style={{ ...MUTED, fontSize: '0.82rem' }}>Nobody at the firm is on the list — nobody is emailed; the matter still appears on their portal.</p>}
                {firmPaused ? <p style={{ fontSize: '0.82rem', color: '#b42318', margin: '6px 0 0' }}>All emails to the firm are paused — the matter still appears on their portal; nobody is emailed.</p> : null}
                <div data-legal-ready-floor style={{ fontSize: '0.84rem', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                  <span>Settlement floor (optional): the firm may settle at</span>
                  <input type="number" min={0} step="0.01" value={sheet.floor ?? ''} onChange={(e) => setSheet({ ...sheet, floor: e.target.value })} placeholder="none" aria-label="Settlement floor" style={{ ...sheetInput, width: 100, margin: 0 }} />
                  <select value={sheet.floorUnit ?? 'pct'} onChange={(e) => setSheet({ ...sheet, floorUnit: e.target.value === 'usd' ? 'usd' : 'pct' })} aria-label="Floor in" style={{ ...sheetInput, width: 'auto', margin: 0 }}><option value="pct">% of the balance</option><option value="usd">dollars</option></select>
                  <span style={MUTED}>or above. Below it, they ask you.</span>
                </div>
                <label style={{ fontSize: '0.84rem', display: 'block', marginTop: 8 }}>Note for the firm (optional)<textarea value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} rows={2} placeholder="e.g. Pursue the GC first; the owner disputes nothing." style={sheetInput} /></label>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => setSheet(null)} style={btn}>Cancel</button>
              <button type="button" onClick={() => void confirmReady()} disabled={!firm || busy} style={{ ...btnPrimary, opacity: !firm || busy ? 0.5 : 1 }}>{packet.readiness.stops ? 'Mark ready anyway' : 'Mark attorney ready'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {previewOpen && sheet?.kind === 'ready' && selected && packet && firm ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setPreviewOpen(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: overlayZIndex + 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="What the firm will see" data-theme="light" onClick={(e) => e.stopPropagation()} style={{ background: PORTAL_PAPER, color: PORTAL_INK, fontFamily: PORTAL_FONT, borderRadius: 8, padding: 16, maxWidth: 980, width: '100%', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>What {firm.name} will see the moment you confirm</div>
                <div style={{ fontSize: 12.5, color: PORTAL_MUTED }}>
                  Preview only — nothing is released yet. Same five tabs, same records, built the way their page builds them.
                  {packet.theirWord.heldCount ? <> <b style={{ color: PORTAL_INK }}>{packet.theirWord.heldCount} held entr{packet.theirWord.heldCount === 1 ? 'y is' : 'ies are'} left out.</b></> : ' Nothing is held back.'}
                  {sheet.note.trim() ? ' Your note for the firm shows under the matter.' : ''}
                </div>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)} style={{ ...btn, color: PORTAL_INK, borderColor: PORTAL_MUTED, background: 'transparent' }}>Close preview</button>
            </div>
            <FirmMatterView
              packet={packet}
              companyName={companyName}
              matter={{ payerName: selected.name, noteToFirm: sheet.note, contracts: [], entries: matter ? (legal?.entriesByMatter.get(matter.id) ?? []) : [], settlementFloor: Number(sheet.floor) > 0 ? (sheet.floorUnit === 'usd' ? { amount: Number(sheet.floor), pct: null } : { amount: null, pct: Number(sheet.floor) }) : settlementFloorOf(matter) }}
              tab={previewTab}
              onTab={setPreviewTab}
              onPrint={printPacket}
            />
          </div>
        </div>
      ) : null}

      {sheet?.kind === 'ask' && selected ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setSheet(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: overlayZIndex + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="Ask a dev to review" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 520, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Ask a dev to review {selected.name}</h3>
            <p style={{ ...MUTED, fontSize: '0.84rem' }}>Puts this account at the top of the dev’s Needs You card with your note. Keep working the gaps meanwhile.</p>
            <textarea value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} rows={3} placeholder="e.g. Demand deadline passed, contract on file — ready for your eyes." style={sheetInput} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSheet(null)} style={btn}>Cancel</button>
              <button type="button" onClick={() => void confirmAsk()} disabled={busy} style={btnPrimary}>Ask</button>
            </div>
          </div>
        </div>
      ) : null}

      {sheet?.kind === 'pull' && selected ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setSheet(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: overlayZIndex + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="Pull back from the firm" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 520, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Pull {selected.name} back from {firm?.name ?? 'the firm'}?</h3>
            <p style={{ ...MUTED, fontSize: '0.84rem' }}>The account returns to review. The firm keeps a read-only page with your reason, their own fees and steps, and the conversation; the account's records leave their portal. They are emailed the reason.</p>
            <textarea value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} rows={2} placeholder="Why (the firm reads this)" aria-label="Why you are pulling it back" style={sheetInput} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSheet(null)} style={btn}>Cancel</button>
              <button type="button" onClick={() => void confirmPull()} disabled={busy || !sheet.note.trim()} style={{ ...btnPrimary, opacity: busy || !sheet.note.trim() ? 0.5 : 1 }}>Pull back</button>
            </div>
          </div>
        </div>
      ) : null}
      {sheet?.kind === 'close' && selected && matter ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setSheet(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: overlayZIndex + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="Close the matter" data-legal-close-sheet onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 520, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Close {selected.name} as {legalStageLabel(matter.stage).toLowerCase()}?</h3>
            <p style={{ ...MUTED, fontSize: '0.84rem' }}>The firm recorded it. Close it once any payment they hold is applied on the job and their last costs are in. The matter leaves their portal and moves to Closed here.</p>
            <textarea value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} rows={2} placeholder="A note for the record (optional)" style={sheetInput} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSheet(null)} style={btn}>Cancel</button>
              <button type="button" onClick={() => void confirmClose()} disabled={busy} style={btnPrimary}>Close the matter</button>
            </div>
          </div>
        </div>
      ) : null}

      {firmOpen && stored ? (
        <LegalFirmWindow firm={firm} matters={legal?.matters ?? []} recipients={legal?.recipients ?? []} canEdit={canEditFirm} onClose={() => setFirmOpen(false)} onSaved={() => { void legal?.reload() }} onShowAccount={(key) => { setFirmOpen(false); setSelectedKey(key); setTab('account') }} zIndex={overlayZIndex + 14} />
      ) : null}
      {emailsOpen && firm ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setEmailsOpen(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: overlayZIndex + 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="Who at the firm hears from us" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 640, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>✉ Who at {firm.name} hears from us</h3>
            <p style={{ ...MUTED, fontSize: '0.8rem', margin: '0 0 10px' }}>Managed by the firm on their portal’s Notifications page. The office keeps two overrides: pause everything, and remove a person. A new address is inert until they click their confirmation; every email carries a one-click stop.</p>
            {(legal?.recipients ?? []).length === 0 ? <p style={{ fontSize: '0.84rem' }}>Nobody on the list yet — nothing is emailed until the firm adds its people on the portal’s Notifications page. Send them their link from 🌐 Firm’s link: its email asks them to add their people.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={TH}>Person</th><th style={TH}>Hears</th><th style={TH}>Scope</th><th style={TH}>Status</th><th style={TH}></th></tr></thead>
                <tbody>
                  {(legal?.recipients ?? []).map((r) => (
                    <tr key={r.id}>
                      <td style={TD}><b>{r.name}</b><div style={{ ...MUTED, fontSize: '0.76rem' }}>{r.email}{r.role ? ` · ${r.role}` : ''}</div>{r.send_failed_since && !r.paused_at ? <div data-legal-not-reaching style={{ color: '#b42318', fontSize: '0.76rem', marginTop: 2 }}>{legalNotReachingLine({ email: r.email, sinceYmd: calendarYmdInAppTzFromIso(r.send_failed_since), error: r.send_error, confirmed: Boolean(r.confirmed_at), mode: r.mode }, 'office')}</div> : null}</td>
                      <td style={TD}>{r.mode === 'digest' ? `${WEEKDAY_LABELS[r.digest_weekday] ?? 'Mon'} ${r.digest_time} digest` : 'right away'}</td>
                      <td style={TD}>{r.scope === 'mine' ? 'only their matters' : 'every matter'}</td>
                      <td style={TD}>{r.paused_at ? pill('stopped', 'neutral') : r.send_failed_since ? pill('not reaching', 'warn') : r.confirmed_at ? pill('confirmed', 'ok') : pill('not confirmed', 'warn')}</td>
                      <td style={TD}><button type="button" onClick={() => void removeRecipient(r.id, r.name)} disabled={busy} style={btn}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              {firmPaused ? <button type="button" onClick={() => void setFirmPaused(false)} disabled={busy} style={btnPrimary}>Resume emails to the firm</button> : <button type="button" onClick={() => void setFirmPaused(true)} disabled={busy} style={{ ...btn, color: '#b42318', borderColor: '#b42318' }}>Pause all emails to the firm</button>}
              <span style={{ ...MUTED, fontSize: '0.76rem' }}>{firmPaused ? 'Paused — events queue and send when you resume.' : 'A new account referred, an office answer, a pull-back: each person hears right away or in their digest.'}</span>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => setEmailsOpen(false)} style={btn}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
      {writeDown ? (
        <AgreedWriteDownModal
          open
          onClose={() => setWriteDown(null)}
          invoice={writeDown.invoice}
          paidOnInvoice={paidOnInvoice}
          isStripeHosted={Boolean((writeDown.invoice.stripe_invoice_id ?? '').trim() && (writeDown.invoice.hosted_invoice_url ?? '').trim())}
          onSuccess={afterWriteDown}
          overlayZIndex={overlayZIndex + 20}
        />
      ) : null}
    </div>
  )
}

type Curation = { holdBack: (key: string, reason: string) => Promise<void>; shareAgain: (key: string) => Promise<void>; shareAll: () => Promise<void>; holdFor: { key: string; reason: string } | null; setHoldFor: (v: { key: string; reason: string } | null) => void; reasons: Record<string, string>; busy: boolean } | null
type EntryLike = LegalEntryRow
type OfficeActs = { acknowledge: (entryId: string) => Promise<void>; answerFor: { entryId: string; text: string } | null; setAnswerFor: (v: { entryId: string; text: string } | null) => void; sendAnswer: () => Promise<void>; markApplied: (entry: { id: string; amount: number | null; body: string }) => Promise<void>; busy: boolean; onOpenPipelineRow: () => void; askForm: { flavor: LegalAskFlavor; jobId: string; text: string } | null; setAskForm: (v: { flavor: LegalAskFlavor; jobId: string; text: string } | null) => void; sendAsk: () => Promise<void>; withdrawFirmAsk: (entryId: string) => Promise<void>; /** A matter exists for the account (asks hang on a matter). */ canAsk: boolean; /** #85 item 20. */ answerSettlement: (entryId: string, signedOff: boolean, note: string) => Promise<void>; setSettlementFloor: (amount: number | null, pct: number | null) => Promise<void>; floor: LegalSettlementFloor | null; /** #85 item 16. */ moveStage: (stage: string, entryId: string) => Promise<void>; /** #85 item 18. */ voidEntry: (entryId: string, reason: string) => Promise<boolean> } | null

function PacketTab({ tab, packet, selected, props, openEditCustomer, openWriteDown, curation, entries, officeActs }: { tab: Tab; packet: LegalPacket; selected: LegalAccountSummary; props: LegalDeskModalProps; openEditCustomer: () => void; openWriteDown: (jobId: string | null) => void; curation: Curation; entries: EntryLike[]; officeActs: OfficeActs }) {
  const a = packet.account
  const jobOf = (id: string) => selected.jobs.find((j) => j.id === id) ?? null
  const first = selected.jobs[0] ?? null
  const customerDoor = (label = 'Edit customer') => <Door label={selected.customerId ? label : 'Link a customer'} onClick={openEditCustomer} title={selected.customerId ? 'Opens Edit customer; the desk refreshes when it saves' : 'The payer is a name only — link the job to a customer record'} />

  if (tab === 'account') {
    return (
      <div>
        <SectionTitle doors={customerDoor()}>Who owes</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', fontSize: '0.84rem' }}>
          <span style={MUTED}>Payer</span><span>{a.payer.name}{a.payer.viaGc ? ' · general contractor on the job' : ''}{a.customerType ? ` · ${a.customerType}` : ''}{!a.payer.customerId ? <> {pill('name only — no customer record', 'stop')}</> : null}</span>
          <span style={MUTED}>Address</span><span>{a.customerAddress || <span style={MUTED}>none on the customer</span>}</span>
          <span style={MUTED}>Emails</span><span>{a.emails.length ? a.emails.join(', ') : <span style={MUTED}>none on file</span>}</span>
          <span style={MUTED}>Phones</span><span>{a.phones.length ? a.phones.join(', ') : <span style={MUTED}>none on file</span>}</span>
          <span style={MUTED}>Terms</span><span>{a.paymentTerms}{a.paymentTermsNote ? <span style={MUTED}> — {a.paymentTermsNote}</span> : null}</span>
        </div>
        {a.contacts.length ? (<><SectionTitle doors={customerDoor()}>Contacts</SectionTitle><Table head={['Name', 'Email', 'Phone', 'Note']} rows={a.contacts.map((c) => [c.name, c.email ?? '—', c.phone ?? '—', c.note ?? ''])} empty="" /></>) : null}
        <SectionTitle doors={first ? <Door label="Pipeline row" onClick={() => props.onFocusJob(first.id)} /> : null}>Jobs in this account</SectionTitle>
        <Table head={['Job', 'Name', 'Address', 'Age', 'Basis', 'Balance', '']} numCols={[3, 5]}
          rows={a.jobs.map((j) => [
            <b key="l">{j.label}</b>, j.name, j.address, j.agingDays == null ? '—' : `${j.agingDays}d`,
            j.contract.kind === 'signed' ? pill('signed contract', 'ok') : j.swornMissing.length === 0 ? pill('sworn account holds', 'warn') : pill(`needs ${j.swornMissing.join(', ')}`, 'stop'),
            formatLegalMoney(j.balance),
            <button key="e" type="button" onClick={() => props.onOpenEditJob(j.jobId)} style={btn}>Edit job</button>,
          ])} empty="No jobs." />
        <SectionTitle doors={<Door label="Accounts Receivable" onClick={props.onOpenAccountsReceivable} />}>Invoices and payments</SectionTitle>
        <Table head={['Date', 'Job', 'Entry', 'Amount', 'Balance']} numCols={[3, 4]} rows={legalRunningLedger(a.ledger).map((e) => [e.ymd ?? '—', e.jobLabel, e.text, <span key="a" style={{ color: e.amount < 0 ? '#1f7a3a' : undefined }}>{formatLegalMoney(e.amount)}</span>, formatLegalMoney(e.running)])} empty="No billed lines or payments recorded on these jobs." />
        <div style={{ display: 'flex', gap: 18, fontSize: '0.84rem', marginTop: 6, flexWrap: 'wrap' }}>
          <span><span style={MUTED}>Billed</span> <b>{formatLegalMoney(a.totals.billed)}</b></span>
          <span><span style={MUTED}>Paid</span> <b>{formatLegalMoney(a.totals.paid)}</b></span>
          {a.totals.writtenDown ? <span><span style={MUTED}>Written down</span> <b>{formatLegalMoney(a.totals.writtenDown)}</b></span> : null}
          <span><span style={MUTED}>Balance</span> <b>{formatLegalMoney(a.totals.balance)}</b></span>
        </div>
        <SectionTitle doors={customerDoor('Property record')}>Property record</SectionTitle>
        <Table head={['Job', 'Address', 'County', 'Owner of record', 'Legal description', 'Parcel', 'Lien-ready']}
          rows={a.properties.map((p) => [<b key="j">{p.jobLabels.join(', ')}</b>, propertySourceNote(p.source) ? <span key="a">{p.address || '—'} <span style={{ ...MUTED }}>· {propertySourceNote(p.source)}</span></span> : (p.address || '—'), p.county || '—', p.owner ? `${p.owner}${p.ownerSource === 'job_override' ? ' (job override)' : ''}` : '—', p.legalDescription || '—', p.parcelId || '—', p.gaps.length ? pill(`missing ${p.gaps.join(', ')}`, 'warn') : pill('complete', 'ok')])}
          empty="No jobs on this account." />
      </div>
    )
  }

  if (tab === 'paper') {
    // Each job's own property kind (#85 item 6), the same as the firm's view.
    const kindWordsOf = (jobId: string) => propertyKindCell(a.jobs.find((j) => j.jobId === jobId)?.property?.propertyKind)
    const roleWords = a.payer.viaGc ? `subcontractor under ${a.payer.name}` : 'original contractor'
    return (
      <div>
        <SectionTitle doors={first ? <Door label="Contract desk" onClick={() => props.onOpenContract(first)} /> : null}>Agreements</SectionTitle>
        <Table head={['Job', 'Agreement', 'Sworn account', '']}
          rows={a.jobs.map((j) => [
            <b key="l">{j.label}</b>,
            <span key="s" style={j.contract.kind === 'signed' ? undefined : { color: '#b42318' }}>{coverageText(j.contract)}</span>,
            j.swornMissing.length ? pill(`needs ${j.swornMissing.join(', ')}`, 'warn') : pill('holds', 'ok'),
            <button key="b" type="button" onClick={() => { const job = jobOf(j.jobId); if (job) props.onOpenContract(job) }} style={btn}>{j.contract.kind === 'signed' ? 'View' : 'Contract…'}</button>,
          ])} empty="No jobs." />
        <SectionTitle doors={first ? <Door label="Liens on the job" onClick={() => props.onOpenLienInstruments(first)} /> : null}>Where each job stands</SectionTitle>
        {packet.paper.timelines.length === 0 ? <p style={{ ...MUTED, fontSize: '0.8rem', margin: '4px 0' }}>No jobs.</p> : packet.paper.timelines.map((t) => (
          <div key={t.jobId} data-legal-job-timeline={t.jobId} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 190px) minmax(0, 1fr)', gap: 12, padding: '8px 0', borderBottom: '1px dotted var(--border)', alignItems: 'start', fontSize: '0.82rem' }}>
            <div>
              <button type="button" onClick={() => { const job = jobOf(t.jobId); if (job) props.onOpenLienInstruments(job) }} style={{ ...btn, fontWeight: 700 }}>{t.jobLabel}</button>
              <div style={{ ...MUTED, fontSize: '0.76rem' }}>{kindWordsOf(t.jobId)} · {roleWords}{legalLastWorkWords(t.lastWorkYmd, t.lastWorkSource) ? ` · ${legalLastWorkWords(t.lastWorkYmd, t.lastWorkSource)}` : ''}</div>
              <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatLegalMoney(t.openBalance)} open</div>
              {t.retainageWords ? <div style={{ ...MUTED, fontSize: '0.76rem' }}>{t.retainageWords}</div> : null}
            </div>
            <LienTimelineStrip timeline={t.timeline} />
          </div>
        ))}
        <p style={{ ...MUTED, fontSize: '0.76rem', margin: '4px 0 0' }}>The desk's own timeline, from each job's last approved clock day (else its last work date, else its creation month, as each job's line says), its filings and the property kind; the monthly notice applies when a GC pays (Click is the subcontractor), the affidavit to both.</p>
        <SectionTitle doors={first ? <Door label="Liens on the job" onClick={() => props.onOpenLienInstruments(first)} /> : null}>Final demand letters</SectionTitle>
        <Table head={['Job', 'Sent', 'Method', 'Tracking', 'Deadline', 'Amount', '']} numCols={[5]}
          rows={packet.paper.demandLetters.map((d) => [
            <b key="l">{d.jobLabel}</b>, d.sentYmd ?? pill('drafted, not sent', 'warn'), d.method, d.tracking || '—',
            <span key="d">{d.deadlineYmd ?? '—'} {d.deadlinePassed ? pill('passed', 'ok') : d.sentYmd ? pill('open', 'warn') : null}</span>,
            formatLegalMoney(d.amount),
            <button key="b" type="button" onClick={() => { const job = jobOf(d.jobId); if (job) props.onOpenLienInstruments(job) }} style={btn}>Open</button>,
          ])} empty="No demand letter recorded on this account." />
        <SectionTitle>The paper that went out</SectionTitle>
        <Table head={['', 'Paper', 'Went out', 'Claim', 'Months as printed', 'Jobs and shares', 'County · recording', 'Copy']} numCols={[3]}
          rows={packet.paper.envelopes.map((e) => [<b key="a">{e.letter}</b>, envelopeKindWords(e), envelopeWentOutWords(e, packet.todayYmd), <b key="c">{formatLegalMoney(e.claim)}</b>, envelopeMonthsWords(e) || '—', envelopeSharesWords(e, formatLegalMoney), [e.county, e.recordingNumber].filter(Boolean).join(' · ') || '—', e.documentUrl ? <a key="d" href={e.documentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600 }}>open ›</a> : '—'])}
          subRows={packet.paper.envelopes.map((e) => (e.answers ? <DeskEnvelopeAnswersBand key={e.key} e={e} packet={packet} /> : null))}
          empty="No § 53.056 notice, affidavit or release recorded." />
        <p style={{ ...MUTED, fontSize: '0.76rem', margin: '2px 0 0' }}>One row per envelope — a paper that covered several jobs (v2.3770, v2.3777) shows every share. A month marked <i>as information</i> was named after its own window closed and is not in the claim. Under a notice: the owner's call and the pile, letter two's clock and the GC's written okay, as the Lien desk records them — the firm reads the same band.</p>
      </div>
    )
  }

  if (tab === 'their_word') {
    const tw = packet.theirWord
    const kindTone: Record<string, Tone> = { contact: 'neutral', promise: 'warn', call: 'neutral', note: 'stop' }
    const kindLabel: Record<string, string> = { contact: 'contact', promise: 'promise', call: 'call', note: 'collections' }
    const holdInput: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', flex: '1 1 220px', minWidth: 0 }
    return (
      <div>
        <SectionTitle doors={<>
          {curation && tw.heldCount ? <Door label="Share all" onClick={() => void curation.shareAll()} title="Clear every hold — every entry goes to counsel" /> : null}
          {customerDoor('Customer notes')}{first ? <Door label="They said…" onClick={() => props.onOpenPromisedPay({ jobId: first.id, jobLabel: first.hcp_number || first.click_number || '', initialYmd: null })} /> : null}<Door label="Call mode" onClick={props.onOpenCallMode} /></>}>
          What was said{tw.decided ? ` · keeps ${tw.kept} of ${tw.decided}${tw.broken ? ` · ${tw.broken} broken` : ''}` : ''}{tw.heldCount ? ` · ${tw.heldCount} held back` : ''}
        </SectionTitle>
        <p style={{ ...MUTED, fontSize: '0.78rem', margin: '0 0 6px' }}>
          Contacts, promises, collection calls and the collections note, oldest first. Everything here goes to counsel. Hold one back only with a reason; the firm sees how many were held, never what or why.
        </p>
        <Table head={['Date', 'Kind', 'Job', 'What was said', 'By', 'To counsel']}
          rows={tw.timeline.map((e) => [
            e.ymd, pill(kindLabel[e.kind] ?? e.kind, kindTone[e.kind] ?? 'neutral'), e.jobLabel ?? <span style={MUTED}>account</span>,
            <span key="t">
              <span style={e.shared ? undefined : { ...MUTED, textDecoration: 'line-through' }}>{e.text}</span>
              {!e.shared && curation?.reasons[e.key] ? <span style={{ ...MUTED, display: 'block', fontSize: '0.74rem' }} data-legal-held-reason>Held: {curation.reasons[e.key]}</span> : null}
            </span>,
            e.by ?? <span style={MUTED}>the customer</span>,
            curation ? (
              e.shared ? (
                <span key="c" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{pill('goes', 'ok')}<button type="button" disabled={curation.busy} onClick={() => curation.setHoldFor({ key: e.key, reason: '' })} style={btn}>Hold back…</button></span>
              ) : (
                <span key="c" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{pill('held', 'neutral')}<button type="button" disabled={curation.busy} onClick={() => void curation.shareAgain(e.key)} style={btn}>Share</button></span>
              )
            ) : e.shared ? pill('goes', 'ok') : pill('held', 'neutral'),
          ])}
          subRows={tw.timeline.map((e) => curation?.holdFor?.key === e.key ? (
            <div data-legal-hold-form style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem' }}>
              <span>Hold this back from counsel because</span>
              <input autoFocus value={curation.holdFor.reason} onChange={(ev) => curation.setHoldFor({ key: e.key, reason: ev.target.value })} placeholder="Why counsel should not see it" aria-label="Why counsel should not see it" style={holdInput} />
              <button type="button" disabled={curation.busy || !curation.holdFor.reason.trim()} onClick={() => void curation.holdBack(e.key, curation.holdFor?.reason ?? '')} style={btnPrimary}>Hold back</button>
              <button type="button" onClick={() => curation.setHoldFor(null)} style={btn}>Cancel</button>
            </div>
          ) : null)}
          empty="Nothing on record — no contact, promise or collection call. One call in call mode gives the attorney a “they said…” line." />
      </div>
    )
  }
  if (tab === 'evidence') {
    return (
      <div>
        <SectionTitle doors={first ? <><Door label="Reports" onClick={() => props.onOpenReports(first)} /><Door label="Sessions" onClick={() => props.onOpenSessionNotes(first)} /><Door label="Job thread" onClick={() => props.onOpenJobThread(first.id)} /></> : null}>Proof the work happened</SectionTitle>
        <Table head={['Job', 'Field reports', 'Clock sessions', 'Hours', 'Worked', 'Job notes', 'Links']} numCols={[3]}
          rows={packet.evidence.map((e) => [
            <b key="l">{e.jobLabel}</b>,
            <span key="r">{e.reports}{e.reports ? <span style={MUTED}> · {e.reportsWithGps} with GPS</span> : null}{e.latestReport ? <div style={{ ...MUTED, fontSize: '0.76rem' }}>latest {calendarYmdInAppTzFromIso(e.latestReport.createdAt)} · {e.latestReport.templateName || 'report'} · {e.latestReport.authorName}</div> : null}</span>,
            <span key="s">{legalSessionWords(e)}</span>,
            `${e.hours}h`, e.firstWorkYmd ? `${e.firstWorkYmd} → ${e.lastWorkYmd}` : '—',
            <span key="n">{e.threadNotes}{e.latestNote ? <div style={{ ...MUTED, fontSize: '0.76rem', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.latestNote.body}</div> : null}</span>,
            <span key="k" style={{ display: 'flex', gap: 6 }}>
              {e.picturesLink ? <a href={e.picturesLink} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem' }}>Photos ↗</a> : null}
              {e.driveLink ? <a href={e.driveLink} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem' }}>Drive ↗</a> : null}
              {!e.picturesLink && !e.driveLink ? <span style={MUTED}>—</span> : null}
            </span>,
          ])} empty="No jobs." />
        <p style={{ ...MUTED, fontSize: '0.78rem', marginTop: 10 }}>Only approved clock sessions count: hours, days worked, the sworn-account check and the lien dates read them. Rejected and revoked sessions are left out; the rest show as awaiting approval. A sworn account needs at least one report or session carrying GPS on the property.</p>
      </div>
    )
  }

  // The firm's fees and costs the debtor owes (item 5): the contingency is the firm's share of a recovery, said on its own line.
  const fees = firmFeeRows(entries)
  const contingency = contingencyEntries(entries)
  const userNameOf = (id: string | null) => (id ? (props.users.find((u) => u.id === id)?.name ?? null) : null)
  const feeTotal = firmFeeEntries(entries).reduce((s, e) => s + Number(e.amount ?? 0), 0)
  // #85 item 17: questions and answers leave the steps table for the conversation, each answer under its question.
  const firmSteps = entries.filter((e) => e.kind !== 'fee' && e.kind !== 'cost' && !isConversationEntry(e))
  const talk = conversationRows(entries)
  const waitingOn = (list: ReadonlyArray<LegalEntryRow>) => list.filter((e) => e.via_portal && !e.acknowledged_at).length
  const askInput: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)' }
  const answerBox = (e: LegalEntryRow): ReactNode =>
    !officeActs ? null : officeActs.answerFor?.entryId === e.id ? (
      <span key="a" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <input value={officeActs.answerFor.text} onChange={(ev) => officeActs.setAnswerFor({ entryId: e.id, text: ev.target.value })} placeholder="Your answer" style={{ ...askInput, width: 220 }} />
        <button type="button" onClick={() => void officeActs.sendAnswer()} disabled={officeActs.busy} style={btn}>Send</button>
        <button type="button" onClick={() => officeActs.setAnswerFor(null)} style={btn}>Cancel</button>
      </span>
    ) : (
      <button key="a" type="button" onClick={() => officeActs.setAnswerFor({ entryId: e.id, text: '' })} style={btn}>Answer…</button>
    )
  return (
    <div>
      {officeActs && officeActs.canAsk ? <SettlementFloorEditor floor={officeActs.floor} balance={packet.account.totals.balance} busy={officeActs.busy} onSave={officeActs.setSettlementFloor} /> : null}
      <SectionTitle doors={first ? <Door label="Write down" onClick={() => openWriteDown(first.id)} /> : null}>Attorney fees and costs{fees.length ? ` · ${formatLegalMoney(feeTotal)}` : ''}</SectionTitle>
      {fees.length ? (
        <Table head={['Date', 'Kind', 'Note', 'By', 'Amount', '']} numCols={[4]} rows={fees.map((e) => [e.occurred_on, e.kind, <DeskVoidableText key="t" e={e} />, entryRecordedByWords(e, 'office', userNameOf), <span key="a" style={isVoidedEntry(e) ? { textDecoration: 'line-through', color: 'var(--text-muted)' } : undefined}>{formatLegalMoney(Number(e.amount ?? 0))}</span>, officeActs && officeCanVoid(e) ? <DeskUndo key="u" onUndo={(reason) => officeActs.voidEntry(e.id, reason)} /> : officeActs && e.via_portal && !e.acknowledged_at && !isVoidedEntry(e) ? (
          // #85 item 18 PR 2: a fee or cost the firm adds is acknowledged here like a step, which clears it from Needs You.
          <button key="k" type="button" onClick={() => void officeActs.acknowledge(e.id)} disabled={officeActs.busy} style={btn}>Acknowledge</button>
        ) : e.via_portal && e.acknowledged_at ? <span key="k" style={{ ...MUTED, fontSize: '0.76rem' }}>seen</span> : ''])} empty="" />
      ) : contingency.length ? null : (
        <p style={{ ...MUTED, fontSize: '0.84rem' }}>None yet{entries.length ? ' — the firm has not added a fee or cost.' : ' — no firm is on this account. When one is, the fees and costs they add list here and roll into the total demand.'}</p>
      )}
      {contingency.length ? <p data-legal-contingency style={{ ...MUTED, fontSize: '0.8rem', margin: '4px 0 0' }}>The firm’s contingency on recoveries you applied, not in the demand: {contingency.map((e) => `${formatLegalMoney(Number(e.amount ?? 0))} on ${e.occurred_on}`).join(', ')}.</p> : null}
      {talk.length ? (
        <div data-legal-conversation>
          <SectionTitle>The conversation{officeActs && waitingOn(talk.map((r) => r.entry)) ? ` · ${waitingOn(talk.map((r) => r.entry))} from the firm waiting on you` : ''}</SectionTitle>
          <Table head={['Date', 'Who', 'What was said', '']}
            rows={talk.map((r) => {
              const e = r.entry
              const s = conversationStateWords(r, 'office')
              // #85 item 20 review: sign off only while the matter is with the firm (the RPC refuses otherwise).
              const acts = !r.isAnswer && r.thread.flavor === 'settlement' && r.thread.state === 'open' && officeActs ? (
                officeActs.canAsk ? <SettlementAnswer key="s" busy={officeActs.busy} onAnswer={(yes, note) => officeActs.answerSettlement(e.id, yes, note)} /> : <span key="s" style={{ ...MUTED, fontSize: '0.76rem' }}>No longer with the firm</span>
              ) : !r.isAnswer && r.thread.askedBy === 'firm' && r.thread.state === 'open' && officeActs ? (
                answerBox(e)
              ) : !r.isAnswer && r.thread.askedBy === 'office' && r.thread.state === 'open' && officeActs ? (
                <span key="q" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  {s ? pill(s.text, s.tone) : null}
                  <button type="button" onClick={() => void officeActs.withdrawFirmAsk(e.id)} disabled={officeActs.busy} style={btn}>Withdraw</button>
                </span>
              ) : r.isAnswer && e.via_portal && !e.acknowledged_at && officeActs ? (
                <button key="k" type="button" onClick={() => void officeActs.acknowledge(e.id)} disabled={officeActs.busy} style={btn}>Acknowledge</button>
              ) : s ? pill(s.text, s.tone) : null
              return [e.occurred_on, <span key="w" style={r.isAnswer ? { paddingLeft: 16, color: 'var(--text-muted)' } : undefined}>{r.isAnswer ? '↳ ' : ''}{conversationWho(r, 'office')}</span>, e.body, acts]
            })}
            empty="" />
        </div>
      ) : null}
      {firmSteps.length ? (
        <>
          <SectionTitle>On the matter{officeActs && waitingOn(firmSteps) ? ` · ${waitingOn(firmSteps)} from the firm waiting on you` : ''}</SectionTitle>
          <Table head={['Date', 'Kind', 'What happened', 'By', 'Amount', '']} numCols={[4]}
            rows={firmSteps.map((e) => {
              const waiting = e.via_portal && !e.acknowledged_at && !isVoidedEntry(e)
              const acts = isVoidedEntry(e) ? pill('undone', 'neutral') : officeActs && officeCanVoid(e) ? <DeskUndo key="u" onUndo={(reason) => officeActs.voidEntry(e.id, reason)} /> : officeActs && waiting ? (
                e.kind === 'payment_received' ? (
                  <span key="p" style={{ display: 'inline-flex', gap: 6 }}>
                    <button type="button" onClick={officeActs.onOpenPipelineRow} style={btn} title="Apply it on the job with Mark Paid, then come back">Mark Paid on the row ↗</button>
                    <button type="button" onClick={() => void officeActs.markApplied(e)} disabled={officeActs.busy} style={btn}>Mark applied</button>
                  </span>
                ) : stepProposalOf(e) ? (
                  // #85 item 16: a step that would move the stage back waits on the office; the stage has not moved.
                  <span key="k" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => void officeActs.moveStage(stepProposalOf(e)?.stage ?? '', e.id)} disabled={officeActs.busy} style={btn}>Move it back to {legalStageLabel(stepProposalOf(e)?.stage).replace('With the firm · ', '')}</button>
                    <button type="button" onClick={() => void officeActs.acknowledge(e.id)} disabled={officeActs.busy} style={btn} title="Record it, leave the stage where it is">Keep {legalStageLabel(stepProposalOf(e)?.from).replace('With the firm · ', '')}</button>
                  </span>
                ) : (
                  <button key="k" type="button" onClick={() => void officeActs.acknowledge(e.id)} disabled={officeActs.busy} style={btn}>Acknowledge</button>
                )
              ) : waiting ? pill('waiting on the office', 'warn') : e.via_portal ? pill('seen', 'ok') : null
              const proposal = stepProposalOf(e)
              return [e.occurred_on, pill(legalEntryKindWords(e), e.via_portal ? 'legal' : 'neutral'), proposal && waiting ? <span key="b">{e.body}<span style={{ ...MUTED, display: 'block', fontSize: '0.74rem' }}>The stage stays at {legalStageLabel(proposal.from).replace('With the firm · ', '')} until you choose.</span></span> : <DeskVoidableText key="b" e={e} />, entryRecordedByWords(e, 'office', userNameOf), e.amount != null ? formatLegalMoney(Number(e.amount)) : '', acts]
            })}
            empty="" />
        </>
      ) : null}
      {officeActs && officeActs.canAsk ? (
        <div style={{ margin: '8px 0 6px' }} data-legal-ask>
          {officeActs.askForm ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem' }} data-legal-ask-form>
              <select value={officeActs.askForm.flavor} onChange={(ev) => officeActs.setAskForm({ ...officeActs.askForm!, flavor: ev.target.value === 'signoff' ? 'signoff' : 'question' })} style={askInput} aria-label="What to ask">
                <option value="question">A question</option>
                <option value="signoff">Sign off on a job</option>
              </select>
              {officeActs.askForm.flavor === 'signoff' ? (
                <select value={officeActs.askForm.jobId} onChange={(ev) => officeActs.setAskForm({ ...officeActs.askForm!, jobId: ev.target.value })} style={askInput} aria-label="Job">
                  {packet.account.jobs.map((j) => <option key={j.jobId} value={j.jobId}>{j.label}</option>)}
                </select>
              ) : null}
              <input value={officeActs.askForm.text} onChange={(ev) => officeActs.setAskForm({ ...officeActs.askForm!, text: ev.target.value })} placeholder={officeActs.askForm.flavor === 'signoff' ? 'What the owner wants to do, and why counsel should say yes or not yet' : 'Your question for the firm'} style={{ ...askInput, flex: '1 1 260px', minWidth: 0 }} aria-label="The ask" />
              <button type="button" onClick={() => void officeActs.sendAsk()} disabled={officeActs.busy || !officeActs.askForm.text.trim()} style={btn}>Send to the firm</button>
              <button type="button" onClick={() => officeActs.setAskForm(null)} style={btn}>Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => officeActs.setAskForm({ flavor: 'question', jobId: packet.account.jobs[0]?.jobId ?? '', text: '' })} style={btn} title="A question for the firm, or a sign-off on one job — they answer on their portal and it lands on your Needs You list">Ask the firm…</button>
          )}
        </div>
      ) : null}
      <SectionTitle doors={first ? <Door label="Activity" onClick={() => props.onOpenReports(first)} /> : null}>What we did, in order</SectionTitle>
      <Table head={['Date', 'Job', 'Step', 'What happened']}
        rows={packet.feesAndSteps.steps.map((s, i) => [s.ymd ?? '—', s.jobLabel ?? '', pill(s.kind, s.kind === 'demand' || s.kind === 'filing' ? 'warn' : s.kind === 'payment' || s.kind === 'contract' ? 'ok' : 'neutral'), <span key={i}>{s.text}</span>])}
        empty="No steps recorded." />
      <SectionTitle>Exhibits the packet would carry</SectionTitle>
      {packet.exhibits.length === 0 ? <p style={{ ...MUTED, fontSize: '0.84rem' }}>Nothing to letter yet.</p> : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.84rem' }}>{packet.exhibits.map((x) => <li key={x.letter}><b>{x.letter}</b> · {x.title} <span style={MUTED}>({x.count})</span></li>)}</ul>
      )}
    </div>
  )
}

/** #85 item 20: the office's floor for this matter — dollars or a percent of the balance, or none. */
function SettlementFloorEditor({ floor, balance, busy, onSave }: { floor: LegalSettlementFloor | null; balance: number; busy: boolean; onSave: (amount: number | null, pct: number | null) => Promise<void> }) {
  const [value, setValue] = useState(floor ? String(floor.amount ?? floor.pct ?? '') : '')
  const [unit, setUnit] = useState<'pct' | 'usd'>(floor?.amount != null ? 'usd' : 'pct')
  const n = Number(value)
  const valid = Number.isFinite(n) && n > 0 && (unit === 'usd' || n <= 100)
  const preview = valid ? settlementFloorDollars(unit === 'usd' ? { amount: n, pct: null } : { amount: null, pct: n }, balance) : null
  const input: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)' }
  return (
    <div data-legal-settlement-floor-editor>
      <SectionTitle>Settlement authority</SectionTitle>
      <p style={{ ...MUTED, fontSize: '0.8rem', margin: '0 0 6px' }}>{settlementFloorWords(floor, balance).replace('You may', 'The firm may').replace('you may', 'the firm may')}</p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' }}>
        <span>The firm may settle at</span>
        <input type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Settlement floor" style={{ ...input, width: 100 }} />
        <select value={unit} onChange={(e) => setUnit(e.target.value === 'usd' ? 'usd' : 'pct')} aria-label="Floor in" style={input}><option value="pct">% of the balance</option><option value="usd">dollars</option></select>
        <span>or above.</span>
        <button type="button" disabled={busy || !valid} onClick={() => void onSave(unit === 'usd' ? n : null, unit === 'usd' ? null : n)} style={btnPrimary}>Save floor</button>
        {floor ? <button type="button" disabled={busy} onClick={() => { setValue(''); void onSave(null, null) }} style={btn}>No floor</button> : null}
        {preview != null && unit === 'pct' ? <span style={MUTED}>Today that is {formatLegalMoney(preview)}.</span> : null}
      </div>
    </div>
  )
}

/** #85 item 20: the office's answer to a settlement under its floor — sign off moves the stage to settled. */
function SettlementAnswer({ busy, onAnswer }: { busy: boolean; onAnswer: (signedOff: boolean, note: string) => Promise<void> }) {
  const [note, setNote] = useState('')
  return (
    <span data-legal-settlement-answer style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" disabled={busy} onClick={() => void onAnswer(true, note)} style={btnPrimary}>Sign off</button>
      <button type="button" disabled={busy} onClick={() => void onAnswer(false, note)} style={btn}>Not yet</button>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="a note for the firm (optional)" aria-label="A note for the firm" style={{ font: 'inherit', fontSize: '0.8rem', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: 180 }} />
    </span>
  )
}

/** #85 item 18: an entry's text, struck through with who undid it and why once it is voided. */
function DeskVoidableText({ e }: { e: Pick<LegalEntryRow, 'body' | 'voided_at' | 'voided_via_portal' | 'void_reason'> }) {
  if (!e.voided_at) return <>{e.body}</>
  return (
    <span data-legal-voided>
      <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{e.body}</span>
      <span style={{ ...MUTED, display: 'block', fontSize: '0.74rem' }}>undone by {e.voided_via_portal ? 'the firm' : 'the office'} {calendarYmdInAppTzFromIso(e.voided_at)}{e.void_reason ? `: ${e.void_reason}` : ''}</span>
    </span>
  )
}

/** #85 item 18: Undo… with a reason; the entry stays on the record, out of every total. */
function DeskUndo({ onUndo }: { onUndo: (reason: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={btn}>Undo…</button>
  return (
    <span data-legal-undo style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (the firm sees it)" aria-label="Why you are undoing it" style={{ font: 'inherit', fontSize: '0.8rem', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: 170 }} />
      <button type="button" disabled={!reason.trim()} onClick={() => void onUndo(reason.trim()).then((ok) => { if (ok) setOpen(false) })} style={btnPrimary}>Undo it</button>
      <button type="button" onClick={() => setOpen(false)} style={btn}>Cancel</button>
    </span>
  )
}
