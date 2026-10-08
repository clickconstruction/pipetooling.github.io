/**
 * The Contract window's signed rail (v2.4183): who signed, when and how, the record's facts, then
 * the doors in three rows — Share (the customer's page to copy or text, a copy by email), Keep
 * (the PDF, the uploaded copy, print, the filed document) and Later (a new agreement, the job, the
 * estimate the acceptance lives on) — and the last copy that went out. The Signed agreement view
 * (v2.2709) folded into the window; the acts are the same ones (share-job-contract for the copy
 * and the PDF, the job's activity ledger for the last share). Owns its own I/O; the window owns
 * which row it shows.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IpAddressMapButton from '../estimates/IpAddressMapButton'
import type { EstimateRecordRow } from '../estimates/CustomerAcceptanceRecordBody'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import { formatContractSignedStamp, formatContractStamp, jobContractSigningUrl, type JobContractRow } from '../../lib/jobs/jobContractLifecycle'
import { abbreviateUa, signedDoors, signedHowLine, signedShareLine, type SignedSource } from '../../lib/jobs/contractSignedDoors'
import { isGoogleDocsUrl, shortDocumentLabel } from '../../lib/jobs/jobContractDocument'
import { normalizeEstimateOptionsFromJson } from '../../lib/estimates/estimateOptions'
import { acceptedEstimateOptionKeys, describeAcceptedEstimateRecord } from '../../lib/estimates/estimateAcceptedRecord'
import { buildJobContractRecordHtml, type JobContractRecordJob } from './JobContractRecordModal'
import JobContractShareSheet, { type ShareTarget } from './JobContractShareSheet'
import { RailGroup } from './ContractRailGroup'
import { signerNamesLine } from '../../lib/jobs/jobContractSigners'

export type JobContractSignedRailProps = {
  job: JobContractRecordJob & { id: string; customer_phone?: string | null; customer_email?: string | null }
  jobNumber: string
  source: SignedSource
  /** The contract row shown (a contract we sent, or a paper / link record); null for an acceptance. */
  row: JobContractRow | null
  /** The acceptance behind an estimate / bid-room signature (from the job's coverage). */
  estimate: { estimateId: string | null; estimateNumber: number | null; signerName: string | null; signedAt: string | null } | null
  /** The estimates row, once the acceptance record on the left has loaded it. */
  estimateRow: EstimateRecordRow | null
  urls: { signatureUrl: string | null; pdfUrl: string | null; paperUrl: string | null; coSignatureUrl?: string | null }
  /** The deliberate door back to a fresh draft — a new signature supersedes this one. */
  onStartNew: (() => void) | null
  onOpenJob: (() => void) | null
  /** Set while a history row is shown instead of the current agreement. */
  onBack: (() => void) | null
  onClose: () => void
}

const formatUsd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
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
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
}
const btnPrimary: React.CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }
const btnQuiet: React.CSSProperties = { ...btn, borderColor: 'transparent', color: 'var(--text-muted)' }
const sub: React.CSSProperties = { fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.72rem' }
const kv: React.CSSProperties = { display: 'grid', gridTemplateColumns: '78px minmax(0, 1fr)', gap: '0.2rem 0.6rem', fontSize: '0.78rem' }
const k: React.CSSProperties = { color: 'var(--text-muted)' }
const link: React.CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.78rem', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }

export default function JobContractSignedRail({ job, jobNumber, source, row, estimate, estimateRow, urls, onStartNew, onOpenJob, onBack, onClose }: JobContractSignedRailProps) {
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const [shareOpen, setShareOpen] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  /** Latest share, from the job's activity ledger (contract_shared). */
  const [lastShare, setLastShare] = useState<{ to: string[]; at: string; by: string | null } | null>(null)

  const isContract = source === 'contract' || source === 'paper'

  const loadLastShare = async (jobId: string) => {
    try {
      const { data } = await supabase
        .from('job_activity_events')
        .select('occurred_at, detail, actor:users!job_activity_events_actor_user_id_fkey(name)')
        .eq('job_id', jobId)
        .eq('event_type', 'contract_shared')
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const ev = data as { occurred_at: string; detail: { to?: unknown } | null; actor: { name: string | null } | { name: string | null }[] | null } | null
      if (!ev) {
        setLastShare(null)
        return
      }
      const to = Array.isArray(ev.detail?.to) ? (ev.detail!.to as unknown[]).filter((x): x is string => typeof x === 'string') : []
      const actor = Array.isArray(ev.actor) ? ev.actor[0] : ev.actor
      setLastShare({ to, at: ev.occurred_at, by: actor?.name ?? null })
    } catch {
      setLastShare(null)
    }
  }
  useEffect(() => {
    setLastShare(null)
    void loadLastShare(job.id)
  }, [job.id, row?.id, estimate?.estimateId])

  // v2.4186: a two-frame agreement names both signers — in the kernel's words since v2.4590.
  const primaryName = (row?.signer_printed_name ?? '').trim()
  const signerName = (isContract ? (row ? signerNamesLine(row) : '') : (estimateRow?.acceptor_printed_name ?? estimate?.signerName ?? '')).trim()
  const signedAt = isContract ? row?.signed_at ?? null : estimateRow?.acceptor_consented_at ?? estimate?.signedAt ?? null
  const phone = (job.customer_phone ?? row?.recipient_phone ?? '').replace(/[^\d+]/g, '')
  const signLink = isContract && row?.public_token ? jobContractSigningUrl(window.location.origin, row.public_token) : null
  const estimateNumber = estimate?.estimateNumber ?? estimateRow?.estimate_number ?? null
  const doors = signedDoors({
    source,
    row,
    phone,
    storedPdf: Boolean(urls.pdfUrl),
    uploadedCopy: Boolean(urls.paperUrl),
    estimateId: estimate?.estimateId ?? null,
    estimateNumber,
  })
  const howLine = signedHowLine({ source, row, estimateDrawn: Boolean(estimateRow?.acceptor_signature_storage_path) })
  const shareTarget: ShareTarget | null = isContract
    ? row
      ? { kind: 'contract', contractId: row.id }
      : null
    : estimate?.estimateId
      ? { kind: 'estimate', estimateId: estimate.estimateId, jobId: job.id }
      : null
  const pdfFilename = isContract ? `Signed-agreement-J${jobNumber}.pdf` : `Signed-${source === 'bid_room' ? 'proposal' : 'estimate'}-${estimateNumber ?? ''}.pdf`

  const copyLink = async () => {
    if (!signLink) return
    try {
      await navigator.clipboard.writeText(signLink)
      showToast('Link to the signed agreement copied.', 'success')
    } catch {
      window.prompt('Copy the link:', signLink)
    }
  }
  const textLink = () => {
    if (!signLink || !phone) return
    window.location.href = `sms:${phone}?&body=${encodeURIComponent(`Here is your signed agreement for ${job.job_address || 'your project'}: ${signLink}`)}`
  }
  const print = () => {
    // A print counts as a send (docs/SENT_COPIES.md): the signed agreement is filed on the job as it printed.
    if (row && !printAndFile(buildJobContractRecordHtml(row, job, urls.signatureUrl, urls.coSignatureUrl ?? null), { kind: 'job_contract_print', title: `Contract${row.template_name ? ` · ${row.template_name}` : ''}`, recipientName: row.recipient_name ?? '', jobIds: [row.job_id], source: { table: 'job_contracts', id: row.id } })) showToast('Allow pop-ups to print the agreement.', 'error')
  }
  const copyDocLink = () => {
    const url = row?.signed_document_url
    if (!url) return
    void navigator.clipboard
      .writeText(url)
      .then(() => showToast('Document link copied.', 'success'))
      .catch(() => window.prompt('Copy the link:', url))
  }
  const downloadViaFunction = async () => {
    if (!shareTarget || pdfBusy) return
    setPdfBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('share-job-contract', {
        body: { ...(shareTarget.kind === 'contract' ? { contract_id: shareTarget.contractId } : { estimate_id: shareTarget.estimateId, job_id: shareTarget.jobId }), mode: 'pdf_url', public_origin: window.location.origin },
      })
      const res = (data ?? {}) as { ok?: boolean; pdf_url?: string | null; error?: string }
      if (error || !res.ok || !res.pdf_url) {
        showToast(res.error || error?.message || 'Could not build the PDF.', 'error')
        return
      }
      window.open(res.pdf_url, '_blank', 'noopener')
    } finally {
      setPdfBusy(false)
    }
  }
  // v2.3556: what was frozen — one option, or a choice plus add-ons.
  const acceptedOptionNote = (() => {
    if (!estimateRow) return null
    const keys = acceptedEstimateOptionKeys(estimateRow)
    if (keys.length === 0) return null
    const offered = normalizeEstimateOptionsFromJson(estimateRow.options_snapshot)
    return describeAcceptedEstimateRecord(offered, keys, formatUsd, Number(estimateRow.total_cents ?? 0)).bannerNote ?? 'chosen option'
  })()

  const consentAt = isContract ? row?.signer_consented_at ?? null : estimateRow?.acceptor_consented_at ?? null
  const ip = isContract ? row?.signer_ip ?? null : estimateRow?.acceptor_ip ?? null
  const ua = isContract ? row?.signer_user_agent ?? null : estimateRow?.acceptor_user_agent ?? null
  const paper = row?.signer_mode === 'paper'

  return (
    <div data-testid="contract-signed-rail" style={{ display: 'grid', gap: '0.6rem' }}>
      {onBack ? (
        <button type="button" style={{ ...link, justifySelf: 'start' }} onClick={onBack} data-testid="contract-signed-back">
          ← Back to the current agreement
        </button>
      ) : null}
      <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', padding: '0.6rem 0.8rem', borderRadius: 9, background: 'var(--bg-green-tint)', border: '1px solid var(--border)', color: 'var(--text-green-700)' }} data-testid="contract-signed-banner">
        <span aria-hidden style={{ fontSize: '1.35rem' }}>✍</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            {doors.verb}
            {signerName ? ` by ${signerName}` : ''}
            {signedAt ? ` · ${formatContractSignedStamp(signedAt)}` : ''}
          </div>
          <div style={{ fontSize: '0.76rem', opacity: 0.9 }}>
            {howLine}
            {consentAt ? ' · consent recorded' : ''}
            {isContract && row?.last_sent_at ? ` · sent ${formatContractStamp(row.last_sent_at)?.split(',')[0] ?? ''}${row.recipient_email ? ` to ${row.recipient_email}` : ''}` : ''}
            {isContract && row && row.view_count > 0 ? ` · opened ${row.view_count}×` : ''}
            {!isContract && estimateNumber != null ? (
              <>
                {' · via '}
                <strong>
                  {source === 'bid_room' ? 'Bid room proposal' : 'Quote'} #{estimateNumber}
                  {estimateRow?.title ? ` — ${estimateRow.title}` : ''}
                </strong>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div style={kv}>
        <span style={k}>Consent</span>
        <span>{consentAt ? `Recorded ${formatContractStamp(consentAt)}` : paper ? 'On the paper copy' : '—'}</span>
        {!paper ? (
          <>
            <span style={k}>From</span>
            <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {ip || '—'}
              <IpAddressMapButton ip={ip} />
            </span>
            <span style={k}>Device</span>
            <span title={ua ?? undefined}>{abbreviateUa(ua)}</span>
          </>
        ) : null}
        <span style={k}>Document</span>
        <span>
          {isContract && row ? (
            <>
              {row.template_name ?? 'Contract'} · rev {row.revision}
              {row.template_version_date ? ` · v. ${row.template_version_date}` : ''}
              {row.signed_pdf_path ? ' · PDF stored' : ''}
            </>
          ) : estimateNumber != null ? (
            <>
              {source === 'bid_room' ? 'Bid room proposal' : 'Estimate'} #{estimateNumber}
              {acceptedOptionNote ? ` · ${acceptedOptionNote} frozen at acceptance` : ''}
            </>
          ) : (
            '—'
          )}
        </span>
      </div>

      {doors.copyLink || doors.textLink || doors.emailCopy ? (
        <RailGroup label="Share">
          {doors.emailCopy && shareTarget ? (
            <button type="button" style={btnPrimary} onClick={() => setShareOpen(true)} data-testid="contract-signed-email">
              Email a copy… <span style={{ ...sub, color: 'inherit', opacity: 0.85 }}>{doors.emailCopy.sub}</span>
            </button>
          ) : null}
          {doors.copyLink ? (
            <button type="button" style={btn} onClick={() => void copyLink()} data-testid="contract-signed-copy-link" title="The customer's page — it shows the signed record">
              Copy link
            </button>
          ) : null}
          {doors.textLink ? (
            <button type="button" style={btn} onClick={textLink} title={job.customer_phone ?? undefined}>
              Text link
            </button>
          ) : null}
        </RailGroup>
      ) : null}

      {doors.downloadPdf || doors.openUploaded || doors.print || doors.document ? (
        <RailGroup label="Keep">
          {doors.downloadPdf === 'stored' && urls.pdfUrl ? (
            <a style={btn} href={urls.pdfUrl} target="_blank" rel="noopener noreferrer" data-testid="contract-signed-pdf">
              Download PDF
            </a>
          ) : doors.downloadPdf === 'build' ? (
            <button type="button" style={btn} onClick={() => void downloadViaFunction()} disabled={pdfBusy} data-testid="contract-signed-pdf">
              Download PDF <span style={sub}>{pdfBusy ? 'building…' : 'build & open'}</span>
            </button>
          ) : null}
          {doors.openUploaded && urls.paperUrl ? (
            <a style={btn} href={urls.paperUrl} target="_blank" rel="noopener noreferrer">
              Open uploaded copy ↗
            </a>
          ) : null}
          {doors.print ? (
            <button type="button" style={btn} onClick={print}>
              Print / save as PDF
            </button>
          ) : null}
          {doors.document && row?.signed_document_url ? (
            <>
              <a style={btn} href={row.signed_document_url} target="_blank" rel="noopener noreferrer" title={shortDocumentLabel(row.signed_document_url)}>
                {doors.document.label} ↗
              </a>
              <button type="button" style={btn} onClick={copyDocLink}>
                Copy {isGoogleDocsUrl(row.signed_document_url) ? 'Google Doc' : 'document'} link
              </button>
            </>
          ) : null}
        </RailGroup>
      ) : null}

      {onStartNew || onOpenJob || doors.openEstimate ? (
        <RailGroup label="Later">
          {onStartNew ? (
            <button type="button" style={btnQuiet} onClick={onStartNew} title="Send a fresh contract for this job — a new signature supersedes this one" data-testid="contract-signed-start-new">
              Start a new agreement…
            </button>
          ) : null}
          {onOpenJob ? (
            <button type="button" style={btnQuiet} onClick={onOpenJob}>
              Open job
            </button>
          ) : null}
          {doors.openEstimate && estimateNumber != null ? (
            <button
              type="button"
              style={btnQuiet}
              onClick={() => {
                onClose()
                navigate(`/estimates/${estimateNumber}`)
              }}
              data-testid="contract-signed-open-estimate"
            >
              {doors.openEstimate}
            </button>
          ) : null}
        </RailGroup>
      ) : null}

      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }} data-testid="contract-signed-share-line">
        {signedShareLine(lastShare, (iso) => formatContractStamp(iso)?.split(',').slice(0, 2).join(',') ?? '')}
      </div>

      <JobContractShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        target={shareTarget}
        heading={`${isContract ? 'Contract' : source === 'bid_room' ? 'Proposal' : 'Estimate'} · J${jobNumber}${job.job_address ? ` · ${job.job_address}` : ''}`}
        signerName={primaryName || signerName}
        signedBy={signerName}
        signerEmail={isContract ? row?.recipient_email ?? job.customer_email ?? null : estimateRow?.customer_email ?? job.customer_email ?? null}
        contractRow={isContract ? row : null}
        filenameHint={doors.emailCopy?.attachment === 'link' && row?.signed_document_url ? shortDocumentLabel(row.signed_document_url) : pdfFilename}
        attachmentKind={doors.emailCopy?.attachment ?? 'pdf'}
        onShared={() => void loadLastShare(job.id)}
      />
    </div>
  )
}
