import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'
import { CustomerSnapshotModal } from '../customers/CustomerSnapshotModal'
import { BidBoardNotesPanel, type BidBoardNotesTab } from './BidBoardNotesPanel'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerNumberLabel, resolveBidLedgerPrefix } from '../../lib/ledgerDisplayPrefixes'

export type BidPreviewTabUrl =
  | 'bid-board'
  | 'builder-review'
  | 'working'
  | 'bid-costs'
  | 'counts'
  | 'takeoffs'
  | 'labor'
  | 'pricing'
  | 'cover-letter'
  | 'submission-followup'
  | 'rfi'
  | 'change-order'
  | 'lien-release'

export type BidPreviewModalProps = {
  bid: BidWithBuilder | null
  loading: boolean
  error: string | null
  onClose: () => void
  onNavigateToBidsTab: (tab: BidPreviewTabUrl, bidId: string) => void
  onRequestEditBid: (bidId: string) => void
  /** After bid notes change (optional refresh of preview header fields). */
  onNotesMutated?: () => void
  /** After customer notes change; defaults to onNotesMutated when omitted. */
  onNotesMutatedCustomer?: () => void
  /** Light red panel when Submission & Followup "no update" highlight applies to this bid. */
  staleNoUpdateHighlight?: boolean
}

function displayUser(u: EstimatorUser | null | undefined): string {
  if (!u) return '—'
  return (u.name?.trim() || u.email || '—').slice(0, 200)
}

function outcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return '—'
  if (outcome === 'won') return 'Won'
  if (outcome === 'lost') return 'Lost'
  if (outcome === 'started_or_complete') return 'Started or Complete'
  return outcome
}

function formatYmd(value: string | null | undefined): string {
  if (!value?.trim()) return '—'
  return value.slice(0, 10)
}

function money(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v))
}

function DetailRow({
  label,
  children,
  style: outerStyle,
}: {
  label: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div style={{ marginBottom: '0.65rem', ...outerStyle }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '0.875rem', color: '#111827', wordBreak: 'break-word' }}>{children}</div>
    </div>
  )
}

function ExternalLink({ href, children }: { href: string | null | undefined; children: ReactNode }) {
  if (!href?.trim()) return <span style={{ color: '#6b7280' }}>—</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault()
        openInExternalBrowser(href)
      }}
      style={{ color: '#2563eb', textDecoration: 'none' }}
    >
      {children}
    </a>
  )
}

function buildTabActions(role: UserRole | null): { tab: BidPreviewTabUrl; label: string }[] {
  const core: { tab: BidPreviewTabUrl; label: string }[] = [
    { tab: 'bid-board', label: 'Bid Board' },
    { tab: 'builder-review', label: 'Builder Review' },
    { tab: 'working', label: 'Working' },
    { tab: 'counts', label: 'Counts' },
  ]
  if (role !== 'superintendent') {
    core.push(
      { tab: 'pricing', label: 'Pricing' },
      { tab: 'cover-letter', label: 'Cover Letter' },
      { tab: 'submission-followup', label: 'Submission' }
    )
  }
  core.push(
    { tab: 'rfi', label: 'RFI' },
    { tab: 'change-order', label: 'Change Order' },
    { tab: 'lien-release', label: 'Lien Release' }
  )
  if (role === 'dev') {
    core.splice(3, 0, { tab: 'bid-costs', label: 'Bid Costs' })
  }
  return core
}

export function BidPreviewModal({
  bid,
  loading,
  error,
  onClose,
  onNavigateToBidsTab,
  onRequestEditBid,
  onNotesMutated,
  onNotesMutatedCustomer,
  staleNoUpdateHighlight = false,
}: BidPreviewModalProps) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const ledgerPrefixMap = useLedgerPrefixMap()
  const [notesTab, setNotesTab] = useState<BidBoardNotesTab>('all')
  const [gcBuilderSnapshotOpen, setGcBuilderSnapshotOpen] = useState(false)
  const tabActions = buildTabActions(role)

  useEffect(() => {
    setNotesTab('all')
  }, [bid?.id])

  useEffect(() => {
    setGcBuilderSnapshotOpen(false)
  }, [bid?.id])

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
    boxSizing: 'border-box',
  }

  const modalStyle: CSSProperties = {
    background: staleNoUpdateHighlight ? '#fef2f2' : 'white',
    padding: '1rem 1.5rem 1.5rem',
    borderRadius: 8,
    maxWidth: 720,
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxSizing: 'border-box',
  }

  return (
    <div
      className="bid-preview-overlay"
      style={overlayStyle}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bid-preview-title"
        style={modalStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
          <h2 id="bid-preview-title" style={{ margin: 0, fontSize: '1.25rem' }}>
            Preview Bid
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {bid ? (
              <button
                type="button"
                onClick={() => onRequestEditBid(bid.id)}
                style={{ padding: '0.5rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Edit bid
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>

        {loading ? <div style={{ color: '#6b7280' }}>Loading…</div> : null}
        {!loading && error ? (
          <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4 }}>{error}</div>
        ) : null}
        {!loading && !error && !bid ? (
          <div style={{ color: '#6b7280' }}>Bid not found or you do not have access.</div>
        ) : null}

        {bid ? (
          <>
            <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#111827' }}>{bid.project_name?.trim() || '—'}</div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem 1.5rem',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: '0 1 auto', fontSize: '0.875rem', color: '#374151' }}>
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                    {bid.bid_number != null && String(bid.bid_number).trim()
                      ? formatBidLedgerNumberLabel(
                          resolveBidLedgerPrefix(bid.service_type_id, ledgerPrefixMap),
                          bid.bid_number,
                        )
                      : '—'}
                  </span>
                  {bid.service_type?.name ? (
                    <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>· {bid.service_type.name}</span>
                  ) : null}
                </div>
                <div style={{ flex: '1 1 14rem', minWidth: 0, fontSize: '0.875rem', color: '#111827', wordBreak: 'break-word' }}>
                  {bid.address?.trim() ? (
                    <span>
                      {bid.address}
                      {' · '}
                      <ExternalLink href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bid.address)}`}>Map</ExternalLink>
                    </span>
                  ) : (
                    <span style={{ color: '#6b7280' }}>—</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.35rem' }}>Open in Bids</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {tabActions.map(({ tab, label }) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => onNavigateToBidsTab(tab, bid.id)}
                    style={{
                      padding: '0.35rem 0.6rem',
                      fontSize: '0.8125rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      background: '#f9fafb',
                      cursor: 'pointer',
                      color: '#374151',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', textAlign: 'center' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: '1rem',
                  marginBottom: '0.65rem',
                }}
              >
                <DetailRow label="Estimator" style={{ marginBottom: 0 }}>
                  {displayUser(bid.estimator as EstimatorUser | null | undefined)}
                </DetailRow>
                <DetailRow label="Account Man" style={{ marginBottom: 0 }}>
                  {displayUser(bid.account_manager as EstimatorUser | null | undefined)}
                </DetailRow>
              </div>
              <DetailRow label="Outcome">{outcomeLabel(bid.outcome)}</DetailRow>
              {(bid as { loss_reason?: string | null }).loss_reason ? (
                <DetailRow label="Loss reason">{(bid as { loss_reason?: string | null }).loss_reason}</DetailRow>
              ) : null}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
                  gap: '1rem',
                  marginBottom: '0.65rem',
                }}
              >
                <DetailRow label="Bid due date" style={{ marginBottom: 0 }}>
                  {formatYmd(bid.bid_due_date)}
                </DetailRow>
                <DetailRow label="Bid date sent" style={{ marginBottom: 0 }}>
                  {formatYmd(bid.bid_date_sent)}
                </DetailRow>
                <DetailRow label="Design drawing plan date" style={{ marginBottom: 0 }}>
                  {formatYmd(bid.design_drawing_plan_date)}
                </DetailRow>
              </div>
              {bid.outcome === 'won' || bid.estimated_job_start_date ? (
                <DetailRow label="Start date">{formatYmd(bid.estimated_job_start_date)}</DetailRow>
              ) : null}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: '1rem',
                  marginBottom: '0.65rem',
                }}
              >
                <DetailRow label="Plan pages" style={{ marginBottom: 0 }}>
                  {bid.plan_pages != null ? String(bid.plan_pages) : '—'}
                </DetailRow>
                <DetailRow label="Distance to office (miles)" style={{ marginBottom: 0 }}>
                  {bid.distance_from_office != null ? String(bid.distance_from_office) : '—'}
                </DetailRow>
              </div>

              <div style={{ marginBottom: '0.65rem', display: 'grid', gap: '0.35rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#111827', lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600, color: '#6b7280' }}>Project folder (Drive):</span>{' '}
                  <ExternalLink href={bid.drive_link ?? ''}>{bid.drive_link?.trim() ? 'Open folder' : '—'}</ExternalLink>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#111827', lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600, color: '#6b7280' }}>Job plans:</span>{' '}
                  <ExternalLink href={bid.plans_link ?? ''}>{bid.plans_link?.trim() ? 'Open plans' : '—'}</ExternalLink>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#111827', lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600, color: '#6b7280' }}>Marked up / cover page:</span>{' '}
                  <ExternalLink href={bid.count_tooling_link ?? ''}>{bid.count_tooling_link?.trim() ? 'Open link' : '—'}</ExternalLink>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#111827', lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600, color: '#6b7280' }}>Bid submission:</span>{' '}
                  <ExternalLink href={bid.bid_submission_link ?? ''}>{bid.bid_submission_link?.trim() ? 'Open submission' : '—'}</ExternalLink>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#111827', lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600, color: '#6b7280' }}>CountTooling Plans:</span>{' '}
                  <ExternalLink href={bid.count_tooling_plans_link ?? ''}>{bid.count_tooling_plans_link?.trim() ? 'Open takeoff' : '—'}</ExternalLink>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: '1rem',
                  marginBottom: '0.65rem',
                }}
              >
                <DetailRow label="GC / Builder" style={{ marginBottom: 0 }}>
                  {bid.customer_id || bid.bids_gc_builders ? (
                    <button
                      type="button"
                      onClick={() => setGcBuilderSnapshotOpen(true)}
                      style={{
                        margin: 0,
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        font: 'inherit',
                        color: '#2563eb',
                        cursor: 'pointer',
                        textAlign: 'center',
                        textDecoration: 'underline',
                        wordBreak: 'break-word',
                      }}
                    >
                      {bid.customers
                        ? bid.customers.name
                        : bid.bids_gc_builders
                          ? bid.bids_gc_builders.name
                          : '—'}
                    </button>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="GC contact" style={{ marginBottom: 0 }}>
                  {[bid.gc_contact_name, bid.gc_contact_phone, bid.gc_contact_email].filter(Boolean).join(' · ') || '—'}
                </DetailRow>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
                  gap: '1rem',
                  marginBottom: '0.65rem',
                }}
              >
                <DetailRow label="Bid value" style={{ marginBottom: 0 }}>
                  {money(bid.bid_value)}
                </DetailRow>
                <DetailRow label="Agreed value" style={{ marginBottom: 0 }}>
                  {money(bid.agreed_value)}
                </DetailRow>
                <DetailRow label="Profit" style={{ marginBottom: 0 }}>
                  {money(bid.profit)}
                </DetailRow>
              </div>
              <DetailRow label="Last contact">{formatYmd(bid.last_contact)}</DetailRow>
              {(bid as { submitted_to?: string | null }).submitted_to ? (
                <DetailRow label="Submitted to">{(bid as { submitted_to?: string | null }).submitted_to}</DetailRow>
              ) : null}

              {bid.notes?.trim() ? (
                <div style={{ textAlign: 'left' }}>
                  <DetailRow label="Notes">
                    <div style={{ whiteSpace: 'pre-wrap' }}>{bid.notes}</div>
                  </DetailRow>
                </div>
              ) : null}
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '1.25rem', paddingTop: '1rem' }}>
              <BidBoardNotesPanel
                bid={bid}
                notesTab={notesTab}
                onNotesTabChange={setNotesTab}
                onLoadError={(msg) => showToast(msg, 'error')}
                onMutated={onNotesMutated ?? (() => {})}
                onMutatedCustomer={onNotesMutatedCustomer ?? onNotesMutated ?? (() => {})}
                idPrefix="bid-preview"
              />
            </div>
          </>
        ) : null}

        {bid ? (
          <CustomerSnapshotModal
            open={gcBuilderSnapshotOpen}
            onClose={() => setGcBuilderSnapshotOpen(false)}
            customerId={bid.customer_id}
            gcBuilder={bid.customer_id ? null : bid.bids_gc_builders ?? null}
          />
        ) : null}
      </div>
    </div>
  )
}
