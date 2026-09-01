import { useCallback, useEffect, useState } from 'react'
import { FileCheck2 } from 'lucide-react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  isLienWaiverFormType,
  lienReleaseClearance,
  lienReleaseFieldsFromSnapshot,
  lienReleaseFormLabel,
  liveLienReleases,
  type JobLienReleaseRow,
} from '../../lib/jobs/lienReleaseTracking'
import {
  buildLienWaiverPrintHtml,
  lienWaiverDate,
  type LienWaiverFields,
  type LienWaiverFormType,
} from '../../lib/jobsDocuments/lienWaiverRelease'
import { openHtmlPreviewWindow } from '../../lib/jobsDocuments/printWindow'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import LienReleaseModal from './LienReleaseModal'

/**
 * Lien releases strip inside the Bill Customer modal (v2.2582): lists what has
 * been issued for the job, shows whether the payment behind a conditional
 * release has cleared, and opens `LienReleaseModal` for a new release or the
 * unconditional follow-up. Self-contained I/O (own `job_lien_releases` reads)
 * so `SendRecordInvoiceModal` only mounts it — fail-soft: any load error hides
 * the strip entirely.
 */

export default function BillCustomerLienReleaseStrip({
  open,
  jobId,
  jobDetails,
  jobNumber,
}: {
  open: boolean
  jobId: string | null
  /** Full job (invoices + payments) when the parent has it — enables clearance + new releases. */
  jobDetails: JobWithDetails | null
  jobNumber: string
}) {
  const { profileName } = useAuth()
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<JobLienReleaseRow[]>([])
  const [releaseModal, setReleaseModal] = useState<{ formType: LienWaiverFormType; invoiceIds: string[] } | null>(null)
  const [voidPendingId, setVoidPendingId] = useState<string | null>(null)

  const loadRows = useCallback(async () => {
    if (!jobId) {
      setRows([])
      return
    }
    try {
      const { data } = await supabase
        .from('job_lien_releases')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
      setRows((data ?? []) as JobLienReleaseRow[])
    } catch {
      setRows([])
    }
  }, [jobId])

  useEffect(() => {
    if (!open) {
      setRows([])
      setReleaseModal(null)
      setVoidPendingId(null)
      return
    }
    void loadRows()
  }, [open, loadRows])

  const live = liveLienReleases(rows)
  const canIssue = jobDetails != null

  if (!open || (live.length === 0 && !canIssue)) return null

  const viewRelease = (r: JobLienReleaseRow) => {
    const snapshot = lienReleaseFieldsFromSnapshot(r.fields)
    const formType: LienWaiverFormType = isLienWaiverFormType(r.form_type) ? r.form_type : 'conditional_progress'
    const fields: LienWaiverFields = {
      companyName: snapshot.companyName ?? '',
      checkFrom: snapshot.checkFrom ?? '',
      amount: snapshot.amount ?? String(r.amount ?? ''),
      projectDescription: snapshot.projectDescription ?? '',
      throughDate: snapshot.throughDate ?? r.through_date ?? '',
      signedDate: snapshot.signedDate ?? r.signed_date ?? '',
      signerName: snapshot.signerName ?? '',
      signerTitle: snapshot.signerTitle ?? '',
    }
    const ok = openHtmlPreviewWindow(buildLienWaiverPrintHtml(formType, fields, jobNumber))
    if (!ok) showToast('Popup blocked — allow popups to view the release.', 'error')
  }

  const voidRelease = async (r: JobLienReleaseRow) => {
    try {
      await withSupabaseRetry(
        () => supabase.from('job_lien_releases').update({ voided_at: new Date().toISOString() }).eq('id', r.id),
        'void lien release',
      )
      showToast('Release voided.', 'success')
      setVoidPendingId(null)
      void loadRows()
    } catch {
      showToast('Could not void the release.', 'error')
    }
  }

  return (
    <div
      style={{
        marginBottom: '0.75rem',
        padding: '0.6rem 0.75rem',
        borderRadius: 8,
        background: 'var(--bg-blue-tint)',
        border: '1px solid var(--border-strong)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: live.length > 0 ? '0.45rem' : 0 }}>
        <FileCheck2 size={14} aria-hidden style={{ color: 'var(--text-link)' }} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Lien releases</span>
        {canIssue ? (
          <button
            type="button"
            onClick={() => setReleaseModal({ formType: 'conditional_progress', invoiceIds: [] })}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            + New release
          </button>
        ) : null}
      </div>
      {live.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          None issued for this job yet — a conditional release usually travels with the payment request.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {live.map((r) => {
            const clearance = jobDetails ? lienReleaseClearance(r, jobDetails) : 'not_applicable'
            const conditional = r.form_type === 'conditional_progress'
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.45rem',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.75rem',
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    color: conditional ? (clearance === 'cleared' ? 'var(--text-green-700)' : 'var(--text-amber-700)') : 'var(--text-muted)',
                  }}
                >
                  {lienReleaseFormLabel(r.form_type)}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {Number(r.amount ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  issued {lienWaiverDate((r.created_at ?? '').slice(0, 10))}
                  {conditional && jobDetails ? (clearance === 'cleared' ? ' · payment cleared' : ' · check not cleared yet') : ''}
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
                  <button type="button" onClick={() => viewRelease(r)} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}>
                    View
                  </button>
                  {conditional && clearance === 'cleared' && canIssue ? (
                    <button
                      type="button"
                      onClick={() => setReleaseModal({ formType: 'unconditional_progress', invoiceIds: r.invoice_ids ?? [] })}
                      style={{ background: 'none', border: 'none', color: 'var(--text-green-700)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}
                    >
                      Issue unconditional
                    </button>
                  ) : null}
                  {voidPendingId === r.id ? (
                    <button type="button" onClick={() => void voidRelease(r)} style={{ background: 'none', border: 'none', color: 'var(--text-red-700)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}>
                      Confirm void
                    </button>
                  ) : (
                    <button type="button" onClick={() => setVoidPendingId(r.id)} title="Void this release record (the document itself is unaffected)" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}>
                      Void
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {canIssue && jobDetails ? (
        <LienReleaseModal
          open={releaseModal != null}
          onClose={() => setReleaseModal(null)}
          job={jobDetails}
          invoice={
            releaseModal && releaseModal.invoiceIds.length > 0
              ? (jobDetails.invoices ?? []).find((i) => releaseModal.invoiceIds.includes(i.id)) ?? null
              : null
          }
          signerNameFallback={profileName?.trim() ?? ''}
          initialFormType={releaseModal?.formType}
          onIssued={() => void loadRows()}
        />
      ) : null}
    </div>
  )
}
