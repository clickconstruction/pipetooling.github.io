/**
 * The signed-agreement view (v2.2709): what a green contract chip opens. One
 * shell for every signature source — a contract the office sent (online or
 * paper) or an estimate / bid-room proposal the customer accepted — with the
 * same banner, Share menu and audit facts; only the document inside differs.
 * "Start a new agreement…" is the deliberate door back to the send form.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ResponsiveModalShell from '../ResponsiveModalShell'
import IpAddressMapButton from '../estimates/IpAddressMapButton'
import { CustomerAcceptanceRecordBody, type EstimateRecordRow } from '../estimates/CustomerAcceptanceRecordBody'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import type { JobContractCoverage } from '../../lib/jobs/jobContractCoverage'
import { formatContractStamp, jobContractSigningUrl, type JobContractRow } from '../../lib/jobs/jobContractLifecycle'
import { buildJobContractRecordHtml, JobContractRecordBody, useJobContractRecordUrls, type JobContractRecordJob } from './JobContractRecordModal'

export type SignedCoverage = Extract<JobContractCoverage, { kind: 'signed' }>

export type JobSignedAgreementModalProps = {
  open: boolean
  onClose: () => void
  job: (JobContractRecordJob & { id: string; customer_phone?: string | null; customer_email?: string | null }) | null
  coverage: SignedCoverage | null
  /** Pass the contract row when the caller already has it (history rows, Documents); otherwise it loads by coverage.contractId. */
  contractRow?: JobContractRow | null
  /** The deliberate door back to the send form. */
  onStartNewAgreement?: () => void
  /** Optional: open the job (Edit) — surfaces that have the opener pass it. */
  onOpenJob?: () => void
}

const btn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.4rem 0.8rem',
  borderRadius: 7,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'none',
}
const btnPrimary: React.CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }
const menuItem: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  width: '100%',
  padding: '0.45rem 0.65rem',
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.82rem',
  textAlign: 'left',
  cursor: 'pointer',
  textDecoration: 'none',
}
const menuHead: React.CSSProperties = { fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.5rem 0.65rem 0.15rem' }
const kv: React.CSSProperties = { display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '0.25rem 0.75rem', fontSize: '0.82rem' }
const k: React.CSSProperties = { color: 'var(--text-muted)' }

function abbreviateUa(ua: string | null | undefined): string {
  const s = ua ?? ''
  if (!s) return '—'
  const os = /iPhone/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad' : /Android/.test(s) ? 'Android' : /Mac OS/.test(s) ? 'Mac' : /Windows/.test(s) ? 'Windows' : 'Device'
  const br = /CriOS|Chrome\//.test(s) ? 'Chrome' : /FxiOS|Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : 'browser'
  return `${os} · ${br}`
}

export default function JobSignedAgreementModal({ open, onClose, job, coverage, contractRow, onStartNewAgreement, onOpenJob }: JobSignedAgreementModalProps) {
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const [loadedRow, setLoadedRow] = useState<JobContractRow | null>(null)
  const [estimateRow, setEstimateRow] = useState<EstimateRecordRow | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const isContract = coverage?.source === 'contract' || coverage?.source === 'paper'
  const row = contractRow ?? loadedRow

  useEffect(() => {
    if (!open) {
      setLoadedRow(null)
      setEstimateRow(null)
      setMenuOpen(false)
      return
    }
    if (!isContract || contractRow || !coverage?.contractId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('job_contracts').select('*').eq('id', coverage.contractId!).maybeSingle()
      if (!cancelled) setLoadedRow((data ?? null) as JobContractRow | null)
    })()
    return () => {
      cancelled = true
    }
  }, [open, isContract, contractRow, coverage?.contractId, coverage])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const urls = useJobContractRecordUrls(isContract ? row : null, open)

  const signerName = useMemo(() => {
    if (isContract) return (row?.signer_printed_name ?? coverage?.signerName ?? '').trim()
    return (estimateRow?.acceptor_printed_name ?? coverage?.signerName ?? '').trim()
  }, [isContract, row, estimateRow, coverage])
  const signedAt = isContract ? row?.signed_at ?? coverage?.signedAt ?? null : estimateRow?.acceptor_consented_at ?? coverage?.signedAt ?? null
  const howLine = (() => {
    if (isContract) {
      const m = row?.signer_mode
      return m === 'paper' ? 'Signed on paper, uploaded by the office' : m === 'draw' ? 'Drawn on their phone' : m === 'in_person' ? 'Signed in person on our device' : 'Typed on their phone'
    }
    return estimateRow?.acceptor_signature_storage_path ? 'Drawn on the estimate page' : 'Typed on the estimate page'
  })()

  if (!open || !job || !coverage) return null

  const jobNo = effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'
  const phone = (job.customer_phone ?? row?.recipient_phone ?? '').replace(/[^\d+]/g, '')
  const signLink = isContract && row?.public_token ? jobContractSigningUrl(window.location.origin, row.public_token) : null
  const estimateNumber = coverage.estimateNumber ?? estimateRow?.estimate_number ?? null
  const verb = isContract ? 'Signed' : 'Accepted'

  const copyLink = async () => {
    if (!signLink) return
    try {
      await navigator.clipboard.writeText(signLink)
      showToast('Link to the signed agreement copied.', 'success')
    } catch {
      window.prompt('Copy the link:', signLink)
    }
    setMenuOpen(false)
  }
  const textLink = () => {
    if (!signLink || !phone) return
    window.location.href = `sms:${phone}?&body=${encodeURIComponent(`Here is your signed agreement for ${job.job_address || 'your project'}: ${signLink}`)}`
    setMenuOpen(false)
  }
  const print = () => {
    if (isContract && row && !openHtmlPrintWindow(buildJobContractRecordHtml(row, job, urls.signatureUrl))) showToast('Allow pop-ups to print the agreement.', 'error')
    setMenuOpen(false)
  }
  const acceptedOptionName = (() => {
    const key = estimateRow?.accepted_option_key
    const snap = estimateRow?.options_snapshot
    if (!key || !Array.isArray(snap)) return null
    const opt = (snap as unknown[]).find((o) => o && typeof o === 'object' && (o as { key?: unknown }).key === key) as { name?: unknown } | undefined
    return typeof opt?.name === 'string' && opt.name.trim() ? opt.name.trim() : null
  })()

  const banner = (
    <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', padding: '0.6rem 0.8rem', borderRadius: 9, background: 'var(--bg-green-tint)', border: '1px solid var(--border)', color: 'var(--text-green-800)' }}>
      <span aria-hidden style={{ fontSize: '1.35rem' }}>✍</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
          {verb}
          {signerName ? ` by ${signerName}` : ''}
          {signedAt ? ` · ${formatContractStamp(signedAt)}` : ''}
        </div>
        <div style={{ fontSize: '0.76rem', opacity: 0.9 }}>
          {howLine}
          {isContract && row?.signer_consented_at ? ' · consent recorded' : !isContract && estimateRow?.acceptor_consented_at ? ' · consent recorded' : ''}
          {isContract && row?.last_sent_at ? ` · sent ${formatContractStamp(row.last_sent_at)?.split(',')[0] ?? ''}${row.recipient_email ? ` to ${row.recipient_email}` : ''}` : ''}
          {isContract && row && row.view_count > 0 ? ` · opened ${row.view_count}×` : ''}
          {!isContract && estimateNumber != null ? (
            <>
              {' · via '}
              <strong>
                {coverage.source === 'bid_room' ? 'Bid room proposal' : 'Quote'} #{estimateNumber}
                {estimateRow?.title ? ` — ${estimateRow.title}` : ''}
              </strong>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )

  const toolbar = (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button type="button" style={btnPrimary} onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
          Share ▾
        </button>
        {menuOpen ? (
          <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 5, minWidth: 250, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 9, boxShadow: '0 12px 28px rgba(0,0,0,0.16)', padding: '0.3rem' }}>
            {signLink ? (
              <button type="button" role="menuitem" style={menuItem} onClick={() => void copyLink()}>
                <span>Copy link</span>
                <span style={k}>customer&apos;s page</span>
              </button>
            ) : null}
            <button type="button" role="menuitem" style={{ ...menuItem, color: 'var(--text-muted)' }} disabled title="Arrives with the next release">
              <span>Email a copy…</span>
              <span style={k}>soon</span>
            </button>
            {signLink && phone ? (
              <button type="button" role="menuitem" style={menuItem} onClick={textLink}>
                <span>Text link</span>
                <span style={k}>{job.customer_phone}</span>
              </button>
            ) : null}
            <div style={menuHead}>Keep</div>
            {urls.pdfUrl ? (
              <a role="menuitem" style={menuItem} href={urls.pdfUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
                <span>Download PDF</span>
              </a>
            ) : isContract && row?.signer_mode !== 'paper' ? (
              <button type="button" role="menuitem" style={{ ...menuItem, color: 'var(--text-muted)' }} disabled title="No stored PDF for this record yet — use Print / save as PDF">
                <span>Download PDF</span>
                <span style={k}>none stored</span>
              </button>
            ) : null}
            {row?.signer_mode === 'paper' && urls.paperUrl ? (
              <a role="menuitem" style={menuItem} href={urls.paperUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
                <span>Open uploaded copy</span>
              </a>
            ) : null}
            {isContract && row?.signer_mode !== 'paper' ? (
              <button type="button" role="menuitem" style={menuItem} onClick={print}>
                <span>Print / save as PDF</span>
              </button>
            ) : null}
            {!isContract && estimateNumber != null ? (
              <>
                <div style={menuHead}>Where it lives</div>
                <button
                  type="button"
                  role="menuitem"
                  style={menuItem}
                  onClick={() => {
                    setMenuOpen(false)
                    onClose()
                    navigate(`/estimates/${estimateNumber}`)
                  }}
                >
                  <span>Open {coverage.source === 'bid_room' ? 'proposal' : 'estimate'} #{estimateNumber}</span>
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {onOpenJob ? (
        <button type="button" style={btn} onClick={onOpenJob}>
          Open job
        </button>
      ) : null}
      <span style={{ flex: 1 }} />
      {onStartNewAgreement ? (
        <button type="button" style={{ ...btn, borderColor: 'transparent', color: 'var(--text-muted)' }} onClick={onStartNewAgreement} title="Send a fresh contract for this job — a new signature supersedes this one">
          Start a new agreement…
        </button>
      ) : null}
    </div>
  )

  return (
    <ResponsiveModalShell title={`Signed agreement · J${jobNo}`} onRequestClose={onClose} maxWidthDesktop={840}>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {banner}
        {toolbar}
        {isContract ? (
          row ? (
            <>
              <JobContractRecordBody row={row} job={job} urls={urls} showFacts={false} />
              <div style={kv}>
                <span style={k}>How</span>
                <span>{howLine}</span>
                <span style={k}>Consent</span>
                <span>{row.signer_consented_at ? `Recorded ${formatContractStamp(row.signer_consented_at)}` : row.signer_mode === 'paper' ? 'On the paper copy' : '—'}</span>
                {row.signer_mode !== 'paper' ? (
                  <>
                    <span style={k}>From</span>
                    <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {row.signer_ip || '—'}
                      <IpAddressMapButton ip={row.signer_ip} />
                    </span>
                    <span style={k}>Device</span>
                    <span title={row.signer_user_agent ?? undefined}>{abbreviateUa(row.signer_user_agent)}</span>
                  </>
                ) : null}
                <span style={k}>Document</span>
                <span>
                  {row.template_name ?? 'Contract'} · rev {row.revision}
                  {row.template_version_date ? ` · v. ${row.template_version_date}` : ''}
                  {row.signed_pdf_path ? ' · PDF stored' : ''}
                </span>
              </div>
            </>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading the signed record…</p>
          )
        ) : (
          <>
            <CustomerAcceptanceRecordBody open={open} estimateId={coverage.estimateId} onLoaded={setEstimateRow} previewBanner="Record of what the customer accepted — this acceptance is the job's agreement." />
            {estimateRow ? (
              <div style={kv}>
                <span style={k}>How</span>
                <span>{howLine}</span>
                <span style={k}>Consent</span>
                <span>{estimateRow.acceptor_consented_at ? `Recorded ${formatContractStamp(estimateRow.acceptor_consented_at)}` : '—'}</span>
                <span style={k}>From</span>
                <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {estimateRow.acceptor_ip || '—'}
                  <IpAddressMapButton ip={estimateRow.acceptor_ip} />
                </span>
                <span style={k}>Device</span>
                <span title={estimateRow.acceptor_user_agent ?? undefined}>{abbreviateUa(estimateRow.acceptor_user_agent)}</span>
                <span style={k}>Document</span>
                <span>
                  {coverage.source === 'bid_room' ? 'Bid room proposal' : 'Estimate'} #{estimateRow.estimate_number}
                  {acceptedOptionName ? ` · option "${acceptedOptionName}" frozen at acceptance` : estimateRow.accepted_option_key ? ' · chosen option frozen at acceptance' : ''}
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </ResponsiveModalShell>
  )
}
