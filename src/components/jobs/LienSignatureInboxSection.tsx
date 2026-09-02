import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useLienSignatureLanes } from '../../hooks/useLienSignatureLanes'
import { lienInboxJobLabel, type LienInboxRow } from '../../lib/jobs/lienReleaseInboxLanes'
import { lienReleaseFormLabel, lienReleaseSnapshotToWaiverFields, isLienWaiverFormType } from '../../lib/jobs/lienReleaseTracking'
import { lienReleaseSignatureAuditLine } from '../../lib/jobs/lienReleaseLifecycle'
import { buildLienWaiverPdfBlob, lienWaiverPdfFilename, type LienWaiverSignature } from '../../lib/jobsDocuments/lienWaiverRelease'
import { sendLienReleaseEmailToCustomer } from '../../lib/sendLienReleaseEmail'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import LienReleaseSignModal from './LienReleaseSignModal'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

/**
 * The two lien-signature inbox lanes (v2.2621): "Awaiting your signature"
 * (sign right here — the same modal the release window opens) and
 * "Signed — ready to send" (email the signed PDF to the customer, download
 * it, or mark it sent for hand delivery). Renders nothing when both lanes
 * are empty, so it costs the inbox no space on quiet days.
 */
export default function LienSignatureInboxSection() {
  const { role, user } = useAuth()
  const { showToast } = useToastContext()
  const eligible = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const { lanes, refetch } = useLienSignatureLanes(eligible)
  const [signRow, setSignRow] = useState<LienInboxRow | null>(null)
  const [sendConfirm, setSendConfirm] = useState<LienInboxRow | null>(null)
  const [sendBusy, setSendBusy] = useState(false)
  const [markSentPendingId, setMarkSentPendingId] = useState<string | null>(null)

  if (!eligible || (lanes.toSign.length === 0 && lanes.toSend.length === 0)) return null

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.6rem',
    flexWrap: 'wrap',
    padding: '0.45rem 0',
    fontSize: '0.8125rem',
  }
  const jobNumberOf = (r: LienInboxRow) =>
    [r.job?.hcp_number, r.job?.click_number].map((v) => (v ?? '').trim()).find(Boolean) ?? '—'

  async function downloadSignedPdf(r: LienInboxRow) {
    try {
      const formType = isLienWaiverFormType(r.form_type) ? r.form_type : 'conditional_progress'
      const signature: LienWaiverSignature | null = r.signer_printed_name
        ? {
            mode: 'type',
            printedName: r.signer_printed_name,
            auditLine:
              lienReleaseSignatureAuditLine({ signed_at: r.signed_at, signer_consented_at: r.signer_consented_at }) ?? '',
          }
        : null
      const blob = await buildLienWaiverPdfBlob(formType, lienReleaseSnapshotToWaiverFields(r), signature)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = lienWaiverPdfFilename(formType, jobNumberOf(r))
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Could not build the PDF.', 'error')
    }
  }

  async function markSentManually(r: LienInboxRow) {
    try {
      await withSupabaseRetry(
        () =>
          supabase
            .from('job_lien_releases')
            .update({ sent_to_customer_at: new Date().toISOString(), sent_channel: 'manual', sent_by: user?.id ?? null })
            .eq('id', r.id)
            .eq('status', 'signed'),
        'mark lien release sent',
      )
      showToast('Release marked sent.', 'success')
      setMarkSentPendingId(null)
      refetch()
    } catch {
      showToast('Could not mark the release sent.', 'error')
    }
  }

  async function sendEmail(r: LienInboxRow) {
    if (sendBusy) return
    setSendBusy(true)
    const result = await sendLienReleaseEmailToCustomer(r, {
      id: r.job_id,
      customer_email: r.job?.customer_email ?? null,
      hcp_number: r.job?.hcp_number ?? null,
      click_number: r.job?.click_number ?? null,
    })
    setSendBusy(false)
    if (result.ok) {
      showToast(`Signed release emailed to ${result.sentTo}`, 'success')
      setSendConfirm(null)
      refetch()
    } else {
      showToast(result.message, 'error')
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.9rem', marginBottom: '0.75rem' }}>
      {lanes.toSign.length > 0 && (
        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, paddingBottom: '0.35rem', borderBottom: '1px solid var(--border)' }}>
            Awaiting your signature{' '}
            <span style={{ fontWeight: 600, fontSize: '0.72rem', padding: '0.05rem 0.5rem', borderRadius: 9999, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }}>
              {lanes.toSign.length}
            </span>
          </div>
          {lanes.toSign.map((r) => (
            <div key={r.id} style={rowStyle}>
              <div style={{ minWidth: 0 }}>
                <div>Release of lien — {lienInboxJobLabel(r)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {lienReleaseFormLabel(r.form_type)} ·{' '}
                  {Number(r.amount ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSignRow(r)}
                style={{ padding: '0.35rem 0.85rem', fontSize: '0.8125rem', fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Open &amp; sign
              </button>
            </div>
          ))}
        </div>
      )}
      {lanes.toSend.length > 0 && (
        <div style={{ marginTop: lanes.toSign.length > 0 ? '0.6rem' : 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, paddingBottom: '0.35rem', borderBottom: '1px solid var(--border)' }}>
            Signed — ready to send{' '}
            <span style={{ fontWeight: 600, fontSize: '0.72rem', padding: '0.05rem 0.5rem', borderRadius: 9999, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }}>
              {lanes.toSend.length}
            </span>
          </div>
          {lanes.toSend.map((r) => (
            <div key={r.id} style={rowStyle}>
              <div style={{ minWidth: 0 }}>
                <div>Release of lien — {lienInboxJobLabel(r)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {lienReleaseFormLabel(r.form_type)} ·{' '}
                  {Number(r.amount ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · signed by{' '}
                  {r.signer_printed_name ?? 'the master'}
                </div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.15rem' }}>
                  {markSentPendingId === r.id ? (
                    <button type="button" onClick={() => void markSentManually(r)} style={{ background: 'none', border: 'none', color: 'var(--text-red-700)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.72rem' }}>
                      Confirm — mark sent without emailing
                    </button>
                  ) : (
                    <button type="button" onClick={() => setMarkSentPendingId(r.id)} style={{ background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0, fontSize: '0.72rem', textDecoration: 'underline' }}>
                      Mark sent without emailing
                    </button>
                  )}
                </div>
              </div>
              <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSendConfirm(r)}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Email to customer — PDF attached
                </button>
                <button
                  type="button"
                  onClick={() => void downloadSignedPdf(r)}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Download PDF
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      <LienReleaseSignModal
        open={signRow != null}
        onClose={() => setSignRow(null)}
        release={signRow}
        jobNumber={signRow ? jobNumberOf(signRow) : '—'}
        onSigned={refetch}
      />
      {sendConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Email the signed release"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}
          onClick={() => !sendBusy && setSendConfirm(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', padding: '1rem 1.25rem', borderRadius: 8, width: 'min(400px, calc(100vw - 2rem))' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.375rem' }}>Email the signed release?</div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              The signed PDF goes to <strong>{(sendConfirm.job?.customer_email ?? '').trim() || 'the job customer email'}</strong>. The release is marked sent and the job's activity records it.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" disabled={sendBusy} onClick={() => setSendConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={sendBusy}
                onClick={() => void sendEmail(sendConfirm)}
                style={{ background: 'var(--text-link)', color: '#fff', border: '1px solid var(--text-link)' }}
              >
                {sendBusy ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
