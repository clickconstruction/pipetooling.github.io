import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { FileCheck2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import {
  isLienWaiverFormType,
  lienReleaseSnapshotToWaiverFields,
  type JobLienReleaseRow,
  type LienUnconditionalQueueRow,
} from '../../lib/jobs/lienReleaseTracking'
import { lienReleaseSignatureAuditLine, lienReleaseStatus } from '../../lib/jobs/lienReleaseLifecycle'
import {
  buildLienWaiverPrintHtml,
  type LienWaiverFormType,
  type LienWaiverSignature,
} from '../../lib/jobsDocuments/lienWaiverRelease'
import { openHtmlPreviewWindow } from '../../lib/jobsDocuments/printWindow'
import type { JobWithDetails } from '../../types/jobWithDetails'
import LienReleaseModal from '../jobs/LienReleaseModal'

/**
 * The cleared-releases queue (v2.2751): what the Needs You card's "Issue
 * release" action opens. One row per conditional lien release whose check
 * has cleared and whose unconditional follow-up hasn't been issued — the job,
 * the release, the payment that cleared it — with the follow-up issued right
 * from the row (the Release of Lien window preset to unconditional-progress
 * on the covered bill lines, exactly as the Bill Customer strip does). The
 * job name opens the Job window for context; the queue stays open beneath it.
 *
 * Stacking: this overlay sits at 1000 so the Job window (1010), Bill Customer
 * (1020) and the Release of Lien window (1100) all open above it.
 */

const QUEUE_OVERLAY_Z_INDEX = 1000

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function shortDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '—'
  const d = new Date(ymd + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Signed releases re-render with their typed signature (same rule as the release window's history box). */
function signatureForRow(row: JobLienReleaseRow): LienWaiverSignature | null {
  if (lienReleaseStatus(row) !== 'signed' || !row.signer_printed_name) return null
  return {
    mode: 'type',
    printedName: row.signer_printed_name,
    auditLine: lienReleaseSignatureAuditLine({ signed_at: row.signed_at, signer_consented_at: row.signer_consented_at }) ?? '',
  }
}

const linkButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-link)',
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
  fontSize: '0.8rem',
  fontFamily: 'inherit',
}

export function DashboardLienReleaseQueueModal({
  open,
  onClose,
  rows,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  /** From `useLienReleasesOwedNudge().queue` — the same rows the card counts. */
  rows: LienUnconditionalQueueRow[]
  /** Fired when a release is recorded from the queue so the host refetches (row drops, card count falls). */
  onChanged: () => void
}) {
  const { profileName } = useAuth()
  const { showToast } = useToastContext()
  const jobDetail = useJobDetailModal()
  const isNarrow = useNarrowViewport640()
  const [issue, setIssue] = useState<{ row: LienUnconditionalQueueRow; job: JobWithDetails } | null>(null)
  const [loadingReleaseId, setLoadingReleaseId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setIssue(null)
      setLoadingReleaseId(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // The Release of Lien window and the Job window own Escape while they are up.
      if (issue || jobDetail?.isOpen) return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, issue, jobDetail?.isOpen])

  const viewRelease = useCallback(
    (row: LienUnconditionalQueueRow) => {
      const formType: LienWaiverFormType = isLienWaiverFormType(row.release.form_type)
        ? row.release.form_type
        : 'conditional_progress'
      const html = buildLienWaiverPrintHtml(
        formType,
        lienReleaseSnapshotToWaiverFields(row.release),
        row.jobNumber || '—',
        signatureForRow(row.release),
      )
      if (!openHtmlPreviewWindow(html)) showToast('Popup blocked — allow popups to view the release.', 'error')
    },
    [showToast],
  )

  const startIssue = useCallback(
    async (row: LienUnconditionalQueueRow) => {
      setLoadingReleaseId(row.releaseId)
      try {
        const job = await fetchJobWithDetailsById(row.jobId)
        if (!job) {
          showToast('Could not load the job — try again from its Pipeline row.', 'error')
          return
        }
        setIssue({ row, job })
      } finally {
        setLoadingReleaseId(null)
      }
    },
    [showToast],
  )

  if (!open) return null

  const total = rows.reduce((s, r) => s + r.amount, 0)
  const jobCount = new Set(rows.map((r) => r.jobId)).size

  return (
    <>
      <div
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: QUEUE_OVERLAY_Z_INDEX,
          padding: '1rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lien-release-queue-title"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--surface)',
            borderRadius: 8,
            width: 'min(880px, calc(100vw - 2rem))',
            maxHeight: 'min(90vh, 860px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              padding: isNarrow ? '0.75rem 0.85rem 0.65rem' : '1rem 1.25rem 0.75rem',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                id="lien-release-queue-title"
                style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}
              >
                <FileCheck2 size={18} aria-hidden style={{ color: 'var(--text-link)', flexShrink: 0 }} />
                <span>Conditional releases · payments cleared</span>
                {rows.length > 0 ? (
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                    · {rows.length} waiting
                  </span>
                ) : null}
              </h2>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '66ch' }}>
                Each release below was issued as conditional and its check has since cleared. The customer is owed the
                unconditional version. Issuing it removes the row.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.45rem 0.85rem',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              Close
            </button>
          </div>

          <div style={{ padding: isNarrow ? '0.7rem 0.85rem' : '0.9rem 1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {rows.length === 0 ? (
              <p style={{ margin: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Nothing waiting — every cleared conditional release has its unconditional version.
              </p>
            ) : (
              rows.map((row) => {
                const jobTitle = [row.jobNumber ? `#${row.jobNumber}` : '', row.jobName].filter(Boolean).join(' · ') || 'Job'
                const lines = row.invoiceIds.length
                const busy = loadingReleaseId === row.releaseId
                const jobButton = jobDetail ? (
                  <button
                    type="button"
                    onClick={() => jobDetail.openJobDetail({ jobId: row.jobId })}
                    title="Open the Job window"
                    style={{ ...linkButtonStyle, fontWeight: 700, fontSize: '0.9rem', textAlign: 'left' }}
                  >
                    {jobTitle}
                  </button>
                ) : (
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{jobTitle}</span>
                )
                const issueButton = (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void startIssue(row)}
                    style={{
                      padding: '0.5rem 0.9rem',
                      borderRadius: 8,
                      border: 'none',
                      background: '#15803d',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: busy ? 'wait' : 'pointer',
                      opacity: busy ? 0.7 : 1,
                      whiteSpace: 'nowrap',
                      fontFamily: 'inherit',
                      width: isNarrow ? '100%' : undefined,
                    }}
                  >
                    {busy ? 'Loading job…' : 'Issue unconditional'}
                  </button>
                )
                return (
                  <div
                    key={row.releaseId}
                    style={{
                      display: isNarrow ? 'flex' : 'grid',
                      flexDirection: 'column',
                      gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1.2fr) minmax(0, 1fr) auto',
                      gap: isNarrow ? '0.4rem' : '1rem',
                      alignItems: 'center',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '0.7rem 0.85rem',
                      background: 'var(--surface)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      {jobButton}
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.1rem', overflowWrap: 'anywhere' }}>
                        {[row.customerName, row.jobAddress].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.45rem',
                          borderRadius: 999,
                          border: '1px solid var(--border-strong)',
                          color: 'var(--text-700)',
                          background: 'var(--bg-subtle)',
                          marginRight: '0.35rem',
                          verticalAlign: 'middle',
                        }}
                      >
                        Conditional · progress
                      </span>
                      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(row.amount)}</span>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.1rem' }}>
                        Issued {shortDate(row.issuedOn)} · covers {lines} bill line{lines === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--text-green-700)', fontWeight: 700 }}>
                        Cleared {row.clearedOn ? shortDate(row.clearedOn) : '—'}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.1rem' }}>
                        {row.clearedBy} · {money(row.appliedTotal)} applied
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: isNarrow ? 'row' : 'column',
                        alignItems: isNarrow ? 'center' : 'flex-end',
                        gap: isNarrow ? '0.75rem' : '0.35rem',
                        marginTop: isNarrow ? '0.25rem' : 0,
                        width: isNarrow ? '100%' : undefined,
                      }}
                    >
                      {issueButton}
                      <button type="button" onClick={() => viewRelease(row)} style={linkButtonStyle}>
                        View release
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {rows.length > 0 ? (
            <div
              style={{
                padding: isNarrow ? '0.6rem 0.85rem' : '0.75rem 1.25rem',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
                fontSize: '0.8125rem',
                color: 'var(--text-700)',
              }}
            >
              <span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(total)}</strong> across {jobCount} job
                {jobCount === 1 ? '' : 's'} still owed the unconditional version
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Oldest cleared first</span>
            </div>
          ) : null}
        </div>
      </div>

      {issue ? (
        <LienReleaseModal
          open
          onClose={() => setIssue(null)}
          job={issue.job}
          invoice={(issue.job.invoices ?? []).find((i) => issue.row.invoiceIds.includes(i.id)) ?? null}
          signerNameFallback={profileName?.trim() ?? ''}
          initialFormType="unconditional_progress"
          onIssued={onChanged}
        />
      ) : null}
    </>
  )
}
