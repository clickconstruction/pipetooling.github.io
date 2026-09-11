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
import { buildLegalPacketPrintHtml } from '../../../lib/legal/legalPacketPrint'
import { openHtmlPrintWindow } from '../../../lib/jobsDocuments/printWindow'
import { todayYmdInAppTz } from '../../../utils/dateUtils'
import { useEditCustomerModal } from '../../../contexts/EditCustomerModalContext'
import { useToastContext } from '../../../contexts/ToastContext'
import AgreedWriteDownModal from '../AgreedWriteDownModal'
import { useLegalPacketData } from './useLegalPacketData'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * The Legal desk (PR 1, v2.3293): the office's review of every Collections
 * account BEFORE anything is released to an attorney. The five tabs the
 * firm's portal will mirror — Account · Paper · Their word · Evidence ·
 * Fees & steps — under the theory an attorney could plead, what Click keeps
 * after the firm's cut, and the gap list a firm asks about first. Read-only:
 * every door opens the surface that owns the record, and the desk refreshes
 * on return. The two exits (attorney-ready, write down) land with PR 2; the
 * write-down door already opens the agreed write-down modal.
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

type Tone = 'stop' | 'warn' | 'ok' | 'neutral'
function pill(text: string, tone: Tone): ReactNode {
  const colors: Record<Tone, CSSProperties> = {
    stop: { background: 'rgba(180,35,24,0.12)', color: '#b42318' },
    warn: { background: 'rgba(154,103,0,0.14)', color: '#9a6700' },
    ok: { background: 'rgba(31,122,58,0.14)', color: '#1f7a3a' },
    neutral: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
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
    <h4 style={{ margin: '18px 0 6px', fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span>{children}</span>
      {doors ? <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>{doors}</span> : null}
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

export default function LegalDeskModal(props: LegalDeskModalProps) {
  const { open, onClose, collectionsJobs, jobsLoading = false, contractCoverage, users, companyName, initialPayerKey = null, overlayZIndex = 60 } = props
  const { showToast } = useToastContext()
  const editCustomer = useEditCustomerModal()
  const todayYmd = todayYmdInAppTz()
  const accounts = useMemo(
    () => sortAccountsByNet(groupCollectionsByPayer(collectionsJobs, contractCoverage, todayYmd), (a) => quickNet(a.balance)),
    [collectionsJobs, contractCoverage, todayYmd],
  )
  const [selectedKey, setSelectedKey] = useState<LegalPayerKey | null>(null)
  const [tab, setTab] = useState<Tab>('account')
  const [gapsOpen, setGapsOpen] = useState(true)
  const [writeDown, setWriteDown] = useState<{ invoice: JobsLedgerInvoice; job: JobWithDetails } | null>(null)

  useEffect(() => {
    if (!open) return
    const wanted = initialPayerKey && accounts.some((a) => a.key === initialPayerKey) ? initialPayerKey : null
    setSelectedKey((prev) => wanted ?? (prev && accounts.some((a) => a.key === prev) ? prev : (accounts[0]?.key ?? null)))
  }, [open, initialPayerKey, accounts])

  const selected: LegalAccountSummary | null = accounts.find((a) => a.key === selectedKey) ?? null
  const { packet, loading, failed, reload } = useLegalPacketData(selected, users, open && selected != null)

  if (!open) return null

  const firstJob = selected?.jobs[0] ?? null
  const jobById = (id: string | null) => (id ? (selected?.jobs.find((j) => j.id === id) ?? firstJob) : firstJob)
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
  const w = packet?.worth ?? null
  const paidOnInvoice = writeDown ? writeDown.job.payments.filter((p) => p.invoice_id === writeDown.invoice.id).reduce((s, p) => s + Number(p.amount ?? 0), 0) : 0

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: overlayZIndex, padding: 'calc(0.75rem + env(safe-area-inset-top, 0px)) 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
      <div role="dialog" aria-modal="true" aria-label="Legal desk — Collections accounts reviewed before release to an attorney" onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, width: '100%', maxWidth: 1160, height: 'min(92vh, 860px)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span aria-hidden style={{ fontSize: '1.1rem' }}>⚖</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>Legal · Collections accounts</div>
            <div style={{ ...MUTED, fontSize: '0.78rem' }}>Review what an attorney would receive. Nothing here leaves the office yet — marking an account attorney-ready lands next.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, height: 30, width: 30, justifyContent: 'center', padding: 0 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) 1fr', minHeight: 0 }}>
          <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 10 }}>
            <div style={{ ...MUTED, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 6px 8px' }}>
              {accounts.length} account{accounts.length === 1 ? '' : 's'} · {formatLegalMoney(accounts.reduce((s, a) => s + a.balance, 0))} · by what Click would keep
            </div>
            {accounts.length === 0 ? <p style={{ ...MUTED, fontSize: '0.84rem', padding: 6 }}>{jobsLoading ? 'Loading Collections…' : 'Nothing is in Collections.'}</p> : null}
            {accounts.map((a) => {
              const on = a.key === selectedKey
              const net = quickNet(a.balance)
              return (
                <button key={a.key} type="button" onClick={() => { setSelectedKey(a.key); setTab('account') }} aria-pressed={on}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 10px', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 6, border: `1px solid ${on ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 6, background: on ? 'var(--bg-muted)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                  <span style={{ ...NUM, fontSize: '0.86rem', fontWeight: 600 }}>{formatLegalMoney(a.balance)}</span>
                  <span style={{ ...MUTED, fontSize: '0.74rem' }}>
                    {a.jobs.length} job{a.jobs.length === 1 ? '' : 's'}{a.viaGc ? ' · GC pays' : ''}{a.signedJobs < a.jobs.length ? ` · ${a.jobs.length - a.signedJobs} no contract` : ' · signed'}
                  </span>
                  <span style={{ ...MUTED, ...NUM, fontSize: '0.74rem' }}>keeps ~{formatLegalMoney(Math.max(0, net))}</span>
                  <span style={{ ...MUTED, fontSize: '0.72rem', gridColumn: '1 / -1' }}>{a.reviewDays == null ? '' : `${a.reviewDays}d in Collections`}{a.oldestDays != null ? ` · oldest bill ${a.oldestDays}d` : ''}</span>
                </button>
              )
            })}
          </div>

          <div style={{ overflowY: 'auto', padding: '14px 18px 24px', minWidth: 0 }}>
            {!selected ? null : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selected.name}</div>
                    <div style={{ ...MUTED, fontSize: '0.8rem' }}>{selected.jobs.map((j) => j.hcp_number || j.click_number).filter(Boolean).join(' · ')}{packet?.account.customerAddress ? ` · ${packet.account.customerAddress}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...NUM, fontSize: '1.3rem', fontWeight: 700 }}>{formatLegalMoney(selected.balance)}</div>
                    <div style={{ ...MUTED, fontSize: '0.76rem' }}>balance{selected.oldestDays == null ? '' : ` · oldest ${selected.oldestDays}d`}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                    {packet ? pill(packet.readiness.label, packet.readiness.stops > 0 ? 'stop' : packet.readiness.warns > 0 ? 'warn' : 'ok') : null}
                    <button type="button" onClick={printPacket} disabled={!packet} style={{ ...btn, opacity: packet ? 1 : 0.5 }}>⎙ Print packet</button>
                    <span style={{ flex: 1 }} />
                    <button type="button" onClick={() => openWriteDown(null)} style={btn}>Write down…</button>
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
                    {[
                      { label: 'Theory', value: packet.theory.label, sub: packet.theory.basis },
                      { label: 'If every dollar lands', value: formatLegalMoney(w.balance), sub: `less ${Math.round(w.contingencyPct * 100)}% (${formatLegalMoney(w.fee)}) and ${formatLegalMoney(w.filingCost)} costs` },
                      { label: 'Click keeps', value: formatLegalMoney(w.net), sub: w.verdict, tone: w.verdict === 'worth it' ? 'ok' : w.verdict === 'marginal' ? 'warn' : 'stop' },
                      { label: 'Against pursuing', value: w.flags.length ? w.flags.join(' · ') : 'nothing on record', sub: w.flags.length ? '' : 'no dispute, no broken promise, no “no money” note' },
                    ].map((c) => (
                      <div key={c.label} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', background: 'var(--surface)' }}>
                        <div style={{ ...MUTED, fontSize: '0.66rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>{c.label}</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{c.value}{'tone' in c && c.tone ? pill(String(c.sub), c.tone as Tone) : null}</div>
                        {!('tone' in c) && c.sub ? <div style={{ ...MUTED, fontSize: '0.72rem' }}>{c.sub}</div> : null}
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

                {packet ? <PacketTab tab={tab} packet={packet} selected={selected} props={props} openEditCustomer={openEditCustomer} openWriteDown={openWriteDown} /> : null}
              </>
            )}
          </div>
        </div>
      </div>
      {writeDown ? (
        <AgreedWriteDownModal
          open
          onClose={() => setWriteDown(null)}
          invoice={writeDown.invoice}
          paidOnInvoice={paidOnInvoice}
          isStripeHosted={Boolean((writeDown.invoice.stripe_invoice_id ?? '').trim() && (writeDown.invoice.hosted_invoice_url ?? '').trim())}
          onSuccess={async () => {
            setWriteDown(null)
            await props.onAfterWriteDown()
            reload()
          }}
          overlayZIndex={overlayZIndex + 20}
        />
      ) : null}
    </div>
  )
}

function PacketTab({ tab, packet, selected, props, openEditCustomer, openWriteDown }: { tab: Tab; packet: LegalPacket; selected: LegalAccountSummary; props: LegalDeskModalProps; openEditCustomer: () => void; openWriteDown: (jobId: string | null) => void }) {
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
        <SectionTitle doors={<>{customerDoor('Customer notes')}{first ? <Door label="They said…" onClick={() => props.onOpenPromisedPay({ jobId: first.id, jobLabel: first.hcp_number || first.click_number || '', initialYmd: null })} /> : null}<Door label="Call mode" onClick={props.onOpenCallMode} /></>}>
          What was said{tw.decided ? ` · keeps ${tw.kept} of ${tw.decided}${tw.broken ? ` · ${tw.broken} broken` : ''}` : ''}
        </SectionTitle>
        <p style={{ ...MUTED, fontSize: '0.78rem', margin: '0 0 6px' }}>
          Contacts, promises, collection calls and the collections note, oldest first. {tw.firstBillYmd ? <>Entries before the first bill ({tw.firstBillYmd}) are held back from counsel by default{tw.heldCount ? ` — ${tw.heldCount} held` : ''}; per-entry overrides land with the gate.</> : 'No bill date yet, so everything would go.'}
        </p>
        <Table head={['Date', 'Kind', 'Job', 'What was said', 'By', 'To counsel']}
          rows={tw.timeline.map((e) => [
            e.ymd, pill(kindLabel[e.kind] ?? e.kind, kindTone[e.kind] ?? 'neutral'), e.jobLabel ?? <span style={MUTED}>account</span>,
            <span key="t" style={e.shared ? undefined : { ...MUTED, textDecoration: 'line-through' }}>{e.text}</span>, e.by ?? <span style={MUTED}>the customer</span>,
            e.shared ? pill('goes', 'ok') : pill('held', 'neutral'),
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

  return (
    <div>
      <SectionTitle doors={first ? <Door label="Write down" onClick={() => openWriteDown(first.id)} /> : null}>Attorney fees and costs</SectionTitle>
      <p style={{ ...MUTED, fontSize: '0.84rem' }}>None yet — no firm is assigned to this account. When one is, the fees and costs they add will list here and roll into the total demand.</p>
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
