import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { JobWithDetails } from '../../../types/jobWithDetails'
import type { Database } from '../../../types/database'
import type { JobContractCoverage } from '../../../lib/jobs/jobContractCoverage'
import {
  formatLegalMoney,
  groupCollectionsByPayer,
  quickNet,
  sortAccountsByNet,
  type LegalAccountSummary,
  type LegalGap,
  type LegalPacket,
  type LegalPayerKey,
} from '../../../lib/legal/legalPacket'
import {
  feeModelOf,
  heldOverridesOf,
  legalStageLabel,
  releaseRecipients,
  stageIsClosed,
  stageIsWithFirm,
  withHoldOverride,
  type LegalMatterRow,
} from '../../../lib/legal/legalMatters'
import { buildLegalPacketPrintHtml } from '../../../lib/legal/legalPacketPrint'
import { openHtmlPrintWindow } from '../../../lib/jobsDocuments/printWindow'
import { todayYmdInAppTz } from '../../../utils/dateUtils'
import { useEditCustomerModal } from '../../../contexts/EditCustomerModalContext'
import { useToastContext } from '../../../contexts/ToastContext'
import { legalRpc, type LegalMattersData } from '../../../hooks/useLegalMatters'
import AgreedWriteDownModal from '../AgreedWriteDownModal'
import LegalPortalLinkButton from './LegalPortalLinkButton'
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
 * and closes the matter. The office asks a dev with one click; held-back
 * entries are per-entry toggles stored on the matter.
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
  /** The board still fetching the billed/Collections scope — show a wait, not an empty rail. */
  jobsLoading?: boolean
  contractCoverage: ReadonlyMap<string, JobContractCoverage>
  users: ReadonlyArray<{ id: string; name: string | null }>
  companyName: string
  /** `?legal=<payer key>` — which account to open on. */
  initialPayerKey?: LegalPayerKey | null
  /** The stored side (PR 2): matters, the firm, entries. Absent in tests / before the migration. */
  legal?: LegalMattersData | null
  /** Only a dev marks attorney-ready and pulls back. */
  canMarkReady?: boolean
  /** Office roles curate: held entries, ask a dev, write down. */
  canEditReview?: boolean
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

function SectionTitle({ children, doors }: { children: ReactNode; doors?: ReactNode }) {
  return (
    <h4 style={{ margin: '18px 0 6px', fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span>{children}</span>
      {doors ? <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{doors}</span> : null}
    </h4>
  )
}

function Table({ head, rows, empty, numCols = [] }: { head: string[]; rows: ReactNode[][]; empty: string; numCols?: number[] }) {
  if (rows.length === 0) return <p style={{ ...MUTED, fontSize: '0.84rem', margin: '4px 0' }}>{empty}</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{head.map((h, i) => <th key={`${h}-${i}`} style={{ ...TH, ...(numCols.includes(i) ? { textAlign: 'right' } : null) }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ ...TD, ...(numCols.includes(ci) ? NUM : null) }}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function coverageText(c: JobContractCoverage): string {
  if (c.kind === 'signed') return `Signed${c.signedAt ? ` ${c.signedAt.slice(0, 10)}` : ''}${c.signerName ? ` by ${c.signerName}` : ''} · ${c.source}`
  if (c.kind === 'sent') return `Sent ${c.sentAt.slice(0, 10)} · viewed ${c.viewCount}× · never signed`
  if (c.kind === 'draft') return 'Draft, never sent'
  return 'None on file'
}

const FIX_LABEL: Record<LegalGap['fix'], string> = {
  contract: 'Contract…',
  lien_instruments: 'Lien instruments…',
  edit_customer: 'Edit customer…',
  edit_job: 'Edit job…',
  call_mode: 'Call mode…',
  collections_note: 'Edit job…',
  write_down: 'Write down…',
  none: '',
}

type Sheet = { kind: 'ready'; handling: string; note: string } | { kind: 'ask'; note: string } | { kind: 'pull'; note: string } | null

function daysAgo(iso: string | null | undefined, todayYmd: string): number | null {
  const y = (iso ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(y)) return null
  const a = Date.UTC(Number(y.slice(0, 4)), Number(y.slice(5, 7)) - 1, Number(y.slice(8, 10)))
  const b = Date.UTC(Number(todayYmd.slice(0, 4)), Number(todayYmd.slice(5, 7)) - 1, Number(todayYmd.slice(8, 10)))
  return Math.round((b - a) / 86_400_000)
}

export default function LegalDeskModal(props: LegalDeskModalProps) {
  const { open, onClose, collectionsJobs, jobsLoading = false, contractCoverage, users, companyName, initialPayerKey = null, legal = null, canMarkReady = false, canEditReview = false, overlayZIndex = 60 } = props
  const { showToast } = useToastContext()
  const editCustomer = useEditCustomerModal()
  const todayYmd = todayYmdInAppTz()
  const firm = legal?.firm ?? null
  const fee = useMemo(() => feeModelOf(firm), [firm])
  const accounts = useMemo(
    () => sortAccountsByNet(groupCollectionsByPayer(collectionsJobs, contractCoverage, todayYmd), (a) => quickNet(a.balance, fee)),
    [collectionsJobs, contractCoverage, todayYmd, fee],
  )
  const [selectedKey, setSelectedKey] = useState<LegalPayerKey | null>(null)
  const [tab, setTab] = useState<Tab>('account')
  const [gapsOpen, setGapsOpen] = useState(true)
  const [writeDown, setWriteDown] = useState<{ invoice: JobsLedgerInvoice; job: JobWithDetails } | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const wanted = initialPayerKey && accounts.some((a) => a.key === initialPayerKey) ? initialPayerKey : null
    setSelectedKey((prev) => wanted ?? (prev && accounts.some((a) => a.key === prev) ? prev : (accounts[0]?.key ?? null)))
  }, [open, initialPayerKey, accounts])

  const selected: LegalAccountSummary | null = accounts.find((a) => a.key === selectedKey) ?? null
  const matter: LegalMatterRow | null = selected ? (legal?.byPayerKey.get(selected.key) ?? null) : null
  const holdOverrides = useMemo(() => heldOverridesOf(matter), [matter])
  const { packet, loading, failed, reload } = useLegalPacketData(selected, users, open && selected != null, holdOverrides, fee)

  if (!open) return null

  const stage = matter?.stage ?? 'review'
  const withFirm = stageIsWithFirm(stage)
  const closed = stageIsClosed(stage)
  const stored = Boolean(legal?.available)
  const groups: Array<{ cap: string; list: LegalAccountSummary[] }> = [
    { cap: 'Needs a dev’s eyes', list: accounts.filter((a) => { const m = legal?.byPayerKey.get(a.key); return !m || (!stageIsWithFirm(m.stage) && !stageIsClosed(m.stage)) }).sort((x, y) => Number(Boolean(legal?.byPayerKey.get(y.key)?.review_requested_at)) - Number(Boolean(legal?.byPayerKey.get(x.key)?.review_requested_at))) },
    { cap: 'With the firm', list: accounts.filter((a) => stageIsWithFirm(legal?.byPayerKey.get(a.key)?.stage)) },
    { cap: 'Closed', list: accounts.filter((a) => stageIsClosed(legal?.byPayerKey.get(a.key)?.stage)) },
  ]

  const firstJob = selected?.jobs[0] ?? null
  const jobById = (id: string | null) => (id ? (selected?.jobs.find((j) => j.id === id) ?? firstJob) : firstJob)
  const jobIds = selected?.jobs.map((j) => j.id) ?? []
  const openEditCustomer = () => {
    if (selected?.customerId && editCustomer) editCustomer.openEditCustomerModal(selected.customerId, { onSaved: reload })
    else if (firstJob) props.onOpenEditJob(firstJob.id)
  }
  const openWriteDown = (jobId: string | null) => {
    const job = jobById(jobId)
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
    if (!openHtmlPrintWindow(buildLegalPacketPrintHtml(packet, { preparedOn: todayYmd, companyName }))) showToast('Your browser blocked the print window. Allow pop-ups for this site and try again.', 'error')
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
  const saveReview = (args: { heldOverrides?: Record<string, boolean>; requestReview?: boolean; note?: string }) =>
    legalRpc('legal_matter_save_review', {
      p_payer_key: selected?.key,
      p_customer_id: selected?.customerId,
      p_payer_name: selected?.name,
      p_job_ids: jobIds,
      p_held_overrides: args.heldOverrides ?? null,
      p_request_review: args.requestReview ?? null,
      p_review_note: args.note ?? null,
    })
  const toggleHold = async (key: string, held: boolean, heldByDefault: boolean) => {
    const next = withHoldOverride(holdOverrides, key, held, heldByDefault)
    await run('Sharing', () => saveReview({ heldOverrides: next }))
  }
  const setAllShared = async (share: boolean) => {
    if (!packet) return
    const next: Record<string, boolean> = {}
    if (share) for (const e of packet.theirWord.timeline) if (!e.sharedByDefault) next[e.key] = false
    await run('Sharing', () => saveReview({ heldOverrides: next }))
  }
  const confirmReady = async () => {
    if (sheet?.kind !== 'ready' || !firm) return
    const ok = await run('Attorney-ready', () =>
      legalRpc('legal_mark_attorney_ready', { p_payer_key: selected?.key, p_customer_id: selected?.customerId, p_payer_name: selected?.name, p_job_ids: jobIds, p_firm_id: firm.id, p_handling_name: sheet.handling, p_note: sheet.note }),
    )
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
      showToast(`${selected?.name} pulled back — the firm no longer sees it.`, 'info')
    }
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
  const recipients = releaseRecipients(firm, sheet?.kind === 'ready' ? sheet.handling : '')

  const headerActs: ReactNode = !stored ? (
    <span style={{ ...MUTED, fontSize: '0.76rem' }}>Read-only until the legal tables are applied.</span>
  ) : withFirm ? (
    <>
      {pill(`With ${firm?.name ?? 'the firm'} since ${(matter?.released_at ?? '').slice(0, 10)} · ${legalStageLabel(stage).replace('With the firm · ', '')}`, 'legal')}
      {canMarkReady ? <button type="button" onClick={() => setSheet({ kind: 'pull', note: '' })} style={btn}>Pull back</button> : null}
    </>
  ) : closed ? (
    pill(`${legalStageLabel(stage)} ${(matter?.closed_at ?? '').slice(0, 10)}${matter?.closed_reason ? ` · ${matter.closed_reason}` : ''}`, 'neutral')
  ) : (
    <>
      {matter?.review_requested_at ? pill(`${requesterName} asked for a dev${requestedDays != null ? ` · ${requestedDays}d ago` : ''}`, 'blue') : null}
      {canMarkReady ? (
        <button type="button" onClick={() => setSheet({ kind: 'ready', handling: firm?.handling_name ?? '', note: '' })} disabled={busy} style={btnPrimary}>⚖ Mark attorney ready…</button>
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
        style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, width: '100%', maxWidth: 1160, height: 'min(92vh, 860px)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span aria-hidden style={{ fontSize: '1.1rem' }}>⚖</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>Legal · Collections accounts</div>
            <div style={{ ...MUTED, fontSize: '0.78rem' }}>Two exits: attorney-ready (a dev — that is what puts it with the firm) or write it down. {firm ? `Firm: ${firm.name}.` : stored ? 'No firm yet — add one on Settings → Jobs & dispatch.' : ''}</div>
          </div>
          {stored && firm && canEditReview ? <LegalPortalLinkButton firmId={firm.id} firmName={firm.name} /> : null}
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, height: 30, width: 30, justifyContent: 'center', padding: 0 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) 1fr', minHeight: 0 }}>
          <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 10 }}>
            <div style={{ ...MUTED, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 6px 2px' }}>
              {accounts.length} account{accounts.length === 1 ? '' : 's'} · {formatLegalMoney(accounts.reduce((s, a) => s + a.balance, 0))} · by what Click would keep
            </div>
            {accounts.length === 0 ? <p style={{ ...MUTED, fontSize: '0.84rem', padding: 6 }}>{jobsLoading ? 'Loading Collections…' : 'Nothing is in Collections.'}</p> : null}
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
                        <span style={{ ...MUTED, ...NUM, fontSize: '0.74rem' }}>{m && stageIsWithFirm(m.stage) ? legalStageLabel(m.stage).replace('With the firm · ', '') : `keeps ~${formatLegalMoney(Math.max(0, net))}`}</span>
                        <span style={{ ...MUTED, fontSize: '0.72rem', gridColumn: '1 / -1' }}>
                          {m?.review_requested_at && !stageIsWithFirm(m.stage) && !stageIsClosed(m.stage) ? <span style={{ color: 'var(--text-blue-700)' }}>asked for a dev · </span> : null}
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
                    curation={stored && canEditReview ? { toggleHold, setAllShared, busy } : null} entries={matter ? (legal?.entriesByMatter.get(matter.id) ?? []) : []} />
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {sheet?.kind === 'ready' && selected && packet ? (
        <div role="presentation" onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: overlayZIndex + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <div role="dialog" aria-modal="true" aria-label="Mark attorney-ready" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 620, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Mark {selected.name} attorney-ready?</h3>
            {!firm ? (
              <p style={{ fontSize: '0.86rem', color: '#b42318' }}>No firm is set up. Add the collections law firm on Settings → Jobs &amp; dispatch first.</p>
            ) : (
              <>
                <p style={{ ...MUTED, fontSize: '0.84rem', margin: '0 0 8px' }}>
                  This is the release. The matter goes to <b>{firm.name}</b> the moment you confirm — {selected.jobs.length} job{selected.jobs.length === 1 ? '' : 's'}, {formatLegalMoney(selected.balance)}, theory <b>{packet.theory.label}</b>, exhibits A–{packet.exhibits[packet.exhibits.length - 1]?.letter ?? 'A'}.
                  {packet.theirWord.heldCount ? <> <b>{packet.theirWord.heldCount} entr{packet.theirWord.heldCount === 1 ? 'y is' : 'ies are'} held back</b> from the firm.</> : null}
                </p>
                {packet.worth.verdict === 'not worth it' ? <p style={{ fontSize: '0.84rem', color: '#b42318', margin: '0 0 8px' }}><b>Click keeps {formatLegalMoney(packet.worth.net)}.</b> The firm’s cut and costs eat what is left. Write down / stop pursuing is the other exit.</p> : null}
                {packet.readiness.stops ? <p style={{ fontSize: '0.84rem', color: '#b42318', margin: '0 0 8px' }}><b>{packet.readiness.stops} red gap{packet.readiness.stops === 1 ? '' : 's'} still open</b> — {packet.gaps.filter((g) => g.severity === 'stop').map((g) => g.label).join('; ')}. You can mark anyway; the packet says so on its cover sheet.</p> : null}
                <label style={{ fontSize: '0.84rem', display: 'block' }}>Handling person at the firm<input value={sheet.handling} onChange={(e) => setSheet({ ...sheet, handling: e.target.value })} placeholder={firm.handling_name || 'Who at the firm takes it'} style={sheetInput} /></label>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Who hears about it</div>
                {recipients.length ? recipients.map((r) => <div key={r.email} style={{ fontSize: '0.84rem', padding: '5px 0', borderTop: '1px solid var(--border-subtle)' }}>{pill('Email now', 'legal')} <b>{r.name}</b> <span style={MUTED}>{r.email} · {r.why}</span></div>) : <p style={{ ...MUTED, fontSize: '0.82rem' }}>No email on the firm — nobody is emailed; the matter still appears on their portal.</p>}
                <p style={{ ...MUTED, fontSize: '0.76rem', margin: '6px 0 0' }}>The firm’s own people and their email rules arrive with the portal; the email itself sends once the portal exists.</p>
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

      {sheet?.kind === 'ask' && selected ? (
        <div role="presentation" onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: overlayZIndex + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
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
        <div role="presentation" onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: overlayZIndex + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <div role="dialog" aria-modal="true" aria-label="Pull back from the firm" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 520, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Pull {selected.name} back from {firm?.name ?? 'the firm'}?</h3>
            <p style={{ ...MUTED, fontSize: '0.84rem' }}>The firm stops seeing it and the account returns to review. Their fees and steps stay on the record.</p>
            <textarea value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} rows={2} placeholder="Why (optional)" style={sheetInput} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSheet(null)} style={btn}>Cancel</button>
              <button type="button" onClick={() => void confirmPull()} disabled={busy} style={btnPrimary}>Pull back</button>
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

type Curation = { toggleHold: (key: string, held: boolean, heldByDefault: boolean) => Promise<void>; setAllShared: (share: boolean) => Promise<void>; busy: boolean } | null
type EntryLike = { id: string; kind: string; amount: number | null; body: string; occurred_on: string; via_portal: boolean }

function PacketTab({ tab, packet, selected, props, openEditCustomer, openWriteDown, curation, entries }: { tab: Tab; packet: LegalPacket; selected: LegalAccountSummary; props: LegalDeskModalProps; openEditCustomer: () => void; openWriteDown: (jobId: string | null) => void; curation: Curation; entries: EntryLike[] }) {
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
        <Table head={['Date', 'Entry', 'Amount']} numCols={[2]} rows={a.ledger.map((e) => [e.ymd ?? '—', e.text, <span key="a" style={{ color: e.amount < 0 ? '#1f7a3a' : undefined }}>{formatLegalMoney(e.amount)}</span>])} empty="No billed lines or payments recorded on these jobs." />
        <div style={{ display: 'flex', gap: 18, fontSize: '0.84rem', marginTop: 6, flexWrap: 'wrap' }}>
          <span><span style={MUTED}>Billed</span> <b>{formatLegalMoney(a.totals.billed)}</b></span>
          <span><span style={MUTED}>Paid</span> <b>{formatLegalMoney(a.totals.paid)}</b></span>
          {a.totals.writtenDown ? <span><span style={MUTED}>Written down</span> <b>{formatLegalMoney(a.totals.writtenDown)}</b></span> : null}
          <span><span style={MUTED}>Balance</span> <b>{formatLegalMoney(a.totals.balance)}</b></span>
        </div>
        <SectionTitle doors={customerDoor('Property record')}>Property record</SectionTitle>
        <Table head={['Address', 'County', 'Owner of record', 'Legal description', 'Parcel', 'Lien-ready']}
          rows={a.properties.map((p) => [p.address, p.county || '—', p.owner || '—', p.legalDescription || '—', p.parcelId || '—', p.gaps.length ? pill(`missing ${p.gaps.join(', ')}`, 'warn') : pill('complete', 'ok')])}
          empty="No property record on the customer — county, owner of record and legal description decide whether a lien is on the table." />
      </div>
    )
  }

  if (tab === 'paper') {
    const clockPill = (c: LegalPacket['paper']['lienClock'][number]) =>
      c.status === 'notice_open' ? pill(`notice open · ${c.noticeLeft}d`, 'warn') : c.status === 'affidavit_open' ? pill(`affidavit open · ${c.filingLeft}d`, 'warn') : c.status === 'filed' ? pill('affidavit filed', 'ok') : c.status === 'closed' ? pill('closed', 'neutral') : pill('no work day on record', 'neutral')
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
        <SectionTitle doors={first ? <Door label="Lien instruments" onClick={() => props.onOpenLienInstruments(first)} /> : null}>Lien clock</SectionTitle>
        <Table head={['Job', 'Last work', '§ 53.056 notice due', 'Affidavit due', 'Status']}
          rows={packet.paper.lienClock.map((c) => [<b key="l">{c.jobLabel}</b>, c.lastWorkYmd ?? '—', c.noticeDeadline || <span style={MUTED}>n/a — original contractor</span>, c.filingDeadline || '—', clockPill(c)])} empty="No jobs." />
        <p style={{ ...MUTED, fontSize: '0.76rem', margin: '2px 0 0' }}>From each job’s last clock-session day; the monthly notice applies when a GC pays (Click is the subcontractor), the affidavit to both.</p>
        <SectionTitle doors={first ? <Door label="Lien instruments" onClick={() => props.onOpenLienInstruments(first)} /> : null}>Final demand letters</SectionTitle>
        <Table head={['Job', 'Sent', 'Method', 'Tracking', 'Deadline', 'Amount', '']} numCols={[5]}
          rows={packet.paper.demandLetters.map((d) => [
            <b key="l">{d.jobLabel}</b>, d.sentYmd ?? pill('drafted, not sent', 'warn'), d.method, d.tracking || '—',
            <span key="d">{d.deadlineYmd ?? '—'} {d.deadlinePassed ? pill('passed', 'ok') : d.sentYmd ? pill('open', 'warn') : null}</span>,
            formatLegalMoney(d.amount),
            <button key="b" type="button" onClick={() => { const job = jobOf(d.jobId); if (job) props.onOpenLienInstruments(job) }} style={btn}>Open</button>,
          ])} empty="No demand letter recorded on this account." />
        <SectionTitle>Lien notices and filings</SectionTitle>
        <Table head={['Job', 'Instrument', 'Months', 'Filed', 'Served', 'County', 'Recording no.', 'Sends']} numCols={[7]}
          rows={packet.paper.lienFilings.map((f) => [<b key="l">{f.jobLabel}</b>, f.kind, f.monthsCovered.join(', ') || '—', f.filedYmd ?? '—', f.servedYmd ?? (f.serveDueYmd ? `due ${f.serveDueYmd}` : '—'), f.county || '—', f.recordingNumber || '—', String(f.sends)])}
          empty="No § 53.056 notice or lien affidavit recorded." />
      </div>
    )
  }

  if (tab === 'their_word') {
    const tw = packet.theirWord
    const kindTone: Record<string, Tone> = { contact: 'neutral', promise: 'warn', call: 'neutral', note: 'stop' }
    const kindLabel: Record<string, string> = { contact: 'contact', promise: 'promise', call: 'call', note: 'collections' }
    return (
      <div>
        <SectionTitle doors={<>
          {curation ? <><Door label="Only after the first bill" onClick={() => void curation.setAllShared(false)} title="Clear every override — entries before the first bill are held, the rest go" /><Door label="Share all" onClick={() => void curation.setAllShared(true)} /></> : null}
          {customerDoor('Customer notes')}{first ? <Door label="They said…" onClick={() => props.onOpenPromisedPay({ jobId: first.id, jobLabel: first.hcp_number || first.click_number || '', initialYmd: null })} /> : null}<Door label="Call mode" onClick={props.onOpenCallMode} /></>}>
          What was said{tw.decided ? ` · keeps ${tw.kept} of ${tw.decided}${tw.broken ? ` · ${tw.broken} broken` : ''}` : ''}
        </SectionTitle>
        <p style={{ ...MUTED, fontSize: '0.78rem', margin: '0 0 6px' }}>
          Contacts, promises, collection calls and the collections note, oldest first. {tw.firstBillYmd ? <>Entries before the first bill ({tw.firstBillYmd}) are held back from counsel unless you tick them{tw.heldCount ? ` — ${tw.heldCount} held` : ''}.</> : 'No bill date yet, so everything would go unless you untick it.'}
        </p>
        <Table head={['Date', 'Kind', 'Job', 'What was said', 'By', 'To counsel']}
          rows={tw.timeline.map((e) => [
            e.ymd, pill(kindLabel[e.kind] ?? e.kind, kindTone[e.kind] ?? 'neutral'), e.jobLabel ?? <span style={MUTED}>account</span>,
            <span key="t" style={e.shared ? undefined : { ...MUTED, textDecoration: 'line-through' }}>{e.text}</span>, e.by ?? <span style={MUTED}>the customer</span>,
            curation ? (
              <label key="c" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={e.shared} disabled={curation.busy} onChange={(ev) => void curation.toggleHold(e.key, !ev.target.checked, !e.sharedByDefault)} /> {e.shared ? 'goes' : 'held'}
              </label>
            ) : e.shared ? pill('goes', 'ok') : pill('held', 'neutral'),
          ])} empty="Nothing on record — no contact, promise or collection call. One call in call mode gives the attorney a “they said…” line." />
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
            <span key="r">{e.reports}{e.reports ? <span style={MUTED}> · {e.reportsWithGps} with GPS</span> : null}{e.latestReport ? <div style={{ ...MUTED, fontSize: '0.76rem' }}>latest {e.latestReport.createdAt.slice(0, 10)} · {e.latestReport.templateName || 'report'} · {e.latestReport.authorName}</div> : null}</span>,
            <span key="s">{e.sessions}{e.sessions ? <span style={MUTED}> · {e.approvedSessions} approved · {e.sessionsWithGps} with GPS</span> : null}</span>,
            `${e.hours}h`, e.firstWorkYmd ? `${e.firstWorkYmd} → ${e.lastWorkYmd}` : '—',
            <span key="n">{e.threadNotes}{e.latestNote ? <div style={{ ...MUTED, fontSize: '0.76rem', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.latestNote.body}</div> : null}</span>,
            <span key="k" style={{ display: 'flex', gap: 6 }}>
              {e.picturesLink ? <a href={e.picturesLink} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem' }}>Photos ↗</a> : null}
              {e.driveLink ? <a href={e.driveLink} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem' }}>Drive ↗</a> : null}
              {!e.picturesLink && !e.driveLink ? <span style={MUTED}>—</span> : null}
            </span>,
          ])} empty="No jobs." />
        <p style={{ ...MUTED, fontSize: '0.78rem', marginTop: 10 }}>Rejected and revoked clock sessions are left out. A sworn account needs at least one report or session carrying GPS on the property.</p>
      </div>
    )
  }

  const fees = entries.filter((e) => e.kind === 'fee' || e.kind === 'cost')
  const feeTotal = fees.reduce((s, e) => s + Number(e.amount ?? 0), 0)
  const firmSteps = entries.filter((e) => e.kind !== 'fee' && e.kind !== 'cost')
  return (
    <div>
      <SectionTitle doors={first ? <Door label="Write down" onClick={() => openWriteDown(first.id)} /> : null}>Attorney fees and costs{fees.length ? ` · ${formatLegalMoney(feeTotal)}` : ''}</SectionTitle>
      {fees.length ? (
        <Table head={['Date', 'Kind', 'Note', 'Amount']} numCols={[3]} rows={fees.map((e) => [e.occurred_on, e.kind, e.body, formatLegalMoney(Number(e.amount ?? 0))])} empty="" />
      ) : (
        <p style={{ ...MUTED, fontSize: '0.84rem' }}>None yet{entries.length ? ' — the firm has not added a fee or cost.' : ' — no firm is on this account. When one is, the fees and costs they add list here and roll into the total demand.'}</p>
      )}
      {firmSteps.length ? (<><SectionTitle>On the matter</SectionTitle><Table head={['Date', 'Kind', 'What happened']} rows={firmSteps.map((e) => [e.occurred_on, pill(e.kind.replace('_', ' '), e.via_portal ? 'legal' : 'neutral'), e.body])} empty="" /></>) : null}
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
