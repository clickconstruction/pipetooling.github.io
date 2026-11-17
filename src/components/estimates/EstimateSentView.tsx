import type { ComponentProps, CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Tables } from '../../types/database'
import type { EstimateSentActions } from '../../hooks/useEstimateSentActions'
import type { CustomerRow } from '../../lib/customerContactDisplay'
import type { EstimateAcceptHeaderBrand } from '../../lib/estimateAcceptHeaderBrand'
import { formatSignedCentsUsd, type EstimateChangeOrderFields } from '../../lib/estimateChangeOrder'
import type { CustomerAttachmentPayload } from '../../lib/estimateCustomerAttachment'
import type { EstimateCustomerExperienceResolved } from '../../lib/estimateCustomerExperience'
import { isBidProposalDocKind } from '../../lib/estimatePipelineRefresh'
import { acceptedEstimateOptionKeys, describeAcceptedEstimateRecord } from '../../lib/estimates/estimateAcceptedRecord'
import type { EstimateDetailRow } from '../../lib/estimates/estimateDetailRow'
import { EXTEND_GOOD_THROUGH_HASH } from '../../lib/estimates/estimateGoodThroughChip'
import { estimateLinkedJobHcp, formatEstimateMoney as formatMoney } from '../../lib/estimates/estimateListRows'
import type { EstimateNotifyUserOption } from '../../lib/estimates/estimateNotifyOptions'
import { normalizeEstimateOptionsFromJson, type EstimateOption } from '../../lib/estimates/estimateOptions'
import { formatEstimateUpdatedRelativeCompact } from '../../lib/formatEstimateListUpdated'
import { EmptyState } from '../EmptyState'
import { MessagesButton } from '../messages/MessagesButton'
import { EstimateAcceptTypedSignatureLine } from './EstimateAcceptTypedSignatureLine'
import EstimateCustomerAcceptLinkButtons from './EstimateCustomerAcceptLinkButtons'
import EstimateDetailCustomerActivitySection from './EstimateCustomerActivitySection'
import EstimateCustomerAttachmentCard from './EstimateCustomerAttachmentCard'
import EstimateCustomerDocument from './EstimateCustomerDocument'
import EstimateDownloadPdfButton from './EstimateDownloadPdfButton'
import EstimateExtendGoodThroughPanel from './EstimateExtendGoodThroughPanel'
import EstimateOfferedOptions from './EstimateOfferedOptions'
import EstimateRecordDeclineControl from './EstimateRecordDeclineControl'
import EstimateResendLinkPanel from './EstimateResendLinkPanel'
import { EstimateWhatWent } from './EstimateWhatWent'
import IpAddressMapButton from './IpAddressMapButton'
import { estPrimaryButton, estSecondaryButton, estSmallSecondaryButton } from './estimatesPageStyles'

/** The Job section's anchor: `/estimates/:number#estimate-job` scrolls to it after the load. */
export const ESTIMATE_JOB_SECTION_HASH = 'estimate-job'

const estimateDetailCreateJobButtonStyle: CSSProperties = {
  padding: '0.35rem 0.75rem',
  fontSize: '0.8125rem',
  lineHeight: 1.2,
  fontWeight: 600,
  border: 'none',
  borderRadius: 6,
  background: '#2563eb',
  color: 'white',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

type DownloadPdfProps = ComponentProps<typeof EstimateDownloadPdfButton>

export interface EstimateSentViewProps {
  row: EstimateDetailRow
  isCO: boolean
  customers: CustomerRow[]
  /** The page's row is loading, or a draft save is in flight: the presses here wait. */
  loading: boolean
  saving: boolean
  whatWentRevision: number
  acceptNotifyResolvedUsers: EstimateNotifyUserOption[]
  acceptancePreviewForLine: string | null
  acceptanceDocHeaderBrand: EstimateAcceptHeaderBrand | null
  staffResolvedExperience: EstimateCustomerExperienceResolved | null
  coFields: EstimateChangeOrderFields
  customerAttachmentPreview: CustomerAttachmentPayload | null
  rowOfferedOptions: EstimateOption[]
  acceptorSignatureSignedUrl: string | null
  estimateCustomerEvents: Tables<'estimate_customer_events'>[]
  estimateCustomerEventsLoading: boolean
  todayYmd: string
  customerAcceptUrl: string | null
  copyCustomerAcceptUrl: () => void
  openCustomerAcceptUrl: () => void
  buildEstimatePdf: DownloadPdfProps['build']
  estimatePdfFiling: DownloadPdfProps['filing']
  setDetailCustomerSnapshotId: (customerId: string | null) => void
  openCreateJobModal: () => void
  /** The sent side's presses and their state (`useEstimateSentActions`). */
  actions: EstimateSentActions
}

/**
 * An estimate that has left the office, as the office reads it: what went, who is told, the paper
 * (or its total), the customer, the acceptance record and the job on an accepted one, the link's
 * presses on a sent one, the note on a declined one — and the Unlink job window.
 *
 * Moved whole from `EstimateDetail` (v2.7613, punch list #46 row 3, cut 3 of the Estimates map); the JSX
 * is the page's own, unchanged. It reads the row and never the draft's form.
 */
export default function EstimateSentView({
  row,
  isCO,
  customers,
  loading,
  saving,
  whatWentRevision,
  acceptNotifyResolvedUsers,
  acceptancePreviewForLine,
  acceptanceDocHeaderBrand,
  staffResolvedExperience,
  coFields,
  customerAttachmentPreview,
  rowOfferedOptions,
  acceptorSignatureSignedUrl,
  estimateCustomerEvents,
  estimateCustomerEventsLoading,
  todayYmd,
  customerAcceptUrl,
  copyCustomerAcceptUrl,
  openCustomerAcceptUrl,
  buildEstimatePdf,
  estimatePdfFiling,
  setDetailCustomerSnapshotId,
  openCreateJobModal,
  actions,
}: EstimateSentViewProps) {
  const {
    recordingDecline,
    recordStaffDecline,
    extendVerdict,
    extendingGoodThrough,
    extendGoodThrough,
    resendVerdict,
    resending,
    resentInfo,
    resendCustomerLink,
    copyResentUrl,
    unlinkingJob,
    unlinkJobConfirmOpen,
    openUnlinkJobConfirm,
    closeUnlinkJobConfirm,
    confirmUnlinkLinkedJob,
  } = actions
  return (
    <div style={{ marginTop: '1rem' }}>
      {row.customer_id && row.sent_at && (row.status === 'sent' || row.status === 'customer_accepted') ? (
        // What went (v2.5683, punch list #133 PR 2): the receipt's facts, kept where the estimate is read.
        <EstimateWhatWent
          customerId={row.customer_id}
          customerName={customers.find((c) => c.id === row.customer_id)?.name ?? null}
          email={row.customer_email ?? null}
          sentAt={row.sent_at}
          tokenHash={row.public_token_hash ?? null}
          estimateId={row.id}
          revision={whatWentRevision}
        />
      ) : null}
      <div
        style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          border: '1px solid var(--border)',
          borderRadius: 8,
          fontSize: '0.875rem',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Acceptance notify recipients</div>
        {acceptNotifyResolvedUsers.length === 0 ? (
          <EmptyState compact main="No staff email recipients were set for this quote." />
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {acceptNotifyResolvedUsers.map((u) => (
              <li key={u.id} style={{ marginBottom: '0.25rem' }}>
                {u.name?.trim() || '—'} · {u.email?.trim() || '—'}
              </li>
            ))}
          </ul>
        )}
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          This list was locked when the quote was sent.
        </p>
      </div>
      {row.status === 'customer_accepted' ? (
        <div
          key={`customer-accepted-record-${row.id}`}
          style={{
            marginTop: 0,
            padding: '1rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            maxWidth: 'min(640px, 100%)',
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--surface)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <EstimateCustomerDocument
            title={row.title ?? ''}
            forLine={acceptancePreviewForLine}
            validUntil={row.valid_until ?? null}
            lineItemsSnapshot={row.line_items_snapshot}
            termsSnapshot={row.terms_snapshot ?? ''}
            totalCents={row.total_cents}
            headerBrand={acceptanceDocHeaderBrand}
            lineItemsHeading={staffResolvedExperience?.docLineItemsHeading ?? (isCO ? 'Impact on cost' : 'Line items')}
            termsHeading={staffResolvedExperience?.docTermsHeading ?? 'Terms'}
            totalLabel={staffResolvedExperience?.docTotalLabel ?? (isCO ? 'Net change to contract' : 'Total')}
            changeOrder={isCO ? coFields : null}
          />
          {customerAttachmentPreview ? (
            <div style={{ marginTop: '1.25rem' }}>
              <EstimateCustomerAttachmentCard attachment={customerAttachmentPreview} />
            </div>
          ) : null}
        </div>
      ) : (
        <p>
          {isCO ? (
            <>
              <strong>Net change to contract:</strong> {formatSignedCentsUsd(row.total_cents)}
            </>
          ) : (
            <>
              <strong>Total:</strong> {formatMoney(row.total_cents)}
            </>
          )}
        </p>
      )}
      {row.status === 'customer_accepted' && rowOfferedOptions.length >= 2 ? (
        // v2.5988 (#206 PR 2): what they passed on, in full, under what they took.
        <EstimateOfferedOptions options={rowOfferedOptions} accepted />
      ) : null}
      {(row.customer_id || row.customer_email) && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-700)' }}>
          {row.customer_id ? (
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Customer:</strong>{' '}
              {(() => {
                const displayName =
                  customers.find((c) => c.id === row.customer_id)?.name?.trim() || row.customer_id
                return (
                  <button
                    type="button"
                    onClick={() => setDetailCustomerSnapshotId(row.customer_id)}
                    title="View customer"
                    aria-label={`View customer ${displayName}`}
                    style={{
                      margin: 0,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'var(--text-link)',
                      textDecoration: 'underline',
                      textUnderlineOffset: '2px',
                    }}
                  >
                    {displayName}
                  </button>
                )
              })()}{' '}
              <MessagesButton customerId={row.customer_id} customerName={customers.find((c) => c.id === row.customer_id)?.name} size={14} />
            </p>
          ) : null}
          {row.customer_email && (
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Email used for link:</strong> {row.customer_email}
            </p>
          )}
        </div>
      )}
      {row.status === 'customer_accepted' && (
        <>
          {isBidProposalDocKind(row.doc_kind) && row.bid_id ? (
            <div style={{ marginTop: '1rem', fontSize: '0.85rem', background: 'var(--bg-violet-100)', color: 'var(--text-indigo-800)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
              Signed bid-room proposal — the record of a GC signature.{' '}
              <Link to={`/bids?bidId=${row.bid_id}`} style={{ fontWeight: 600 }}>
                Open the bid
              </Link>
            </div>
          ) : null}
          <h2 style={{ fontSize: '1rem', marginTop: '1.5rem' }}>Customer acceptance</h2>
          {(() => {
            // Estimate Options (v2.2462): what they chose, and what they passed on.
            // v2.3556: several options may have been accepted (a choice plus add-ons, or
            // add-ons alone) — the key list first, the single key for older acceptances.
            const offered = normalizeEstimateOptionsFromJson(row.options_snapshot)
            if (offered.length < 2) return null
            const record = describeAcceptedEstimateRecord(
              offered,
              acceptedEstimateOptionKeys(row),
              formatMoney,
              row.total_cents,
            )
            return (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-700)', margin: '0.25rem 0 0.5rem' }} data-testid="estimate-accepted-record">
                <div>
                  <strong>{record.headline}</strong> <span style={{ color: 'var(--text-muted)' }}>{record.offeredNote}</span>
                </div>
                <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                  {record.addOnLines.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                  {record.notChosenLines.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )
          })()}
          <ul style={{ fontSize: '0.9rem', color: 'var(--text-700)' }}>
            <li>Name: {row.acceptor_printed_name || '—'}</li>
            <li>
              At:{' '}
              {row.acceptor_consented_at?.trim() ? (
                <>
                  {new Date(row.acceptor_consented_at).toLocaleString()}
                  {` ${formatEstimateUpdatedRelativeCompact(row.acceptor_consented_at)}`}
                </>
              ) : (
                '—'
              )}
            </li>
            <li>
              IP: <IpAddressMapButton ip={row.acceptor_ip} />
            </li>
            {acceptorSignatureSignedUrl ? (
              <li style={{ marginTop: '0.75rem', listStyle: 'none', marginLeft: '-1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Signature</div>
                <img
                  src={acceptorSignatureSignedUrl}
                  alt="Customer signature"
                  style={{ maxWidth: 400, width: '100%', border: '1px solid var(--border)', borderRadius: 6 }}
                />
              </li>
            ) : row.acceptor_signature_storage_path ? (
              <li style={{ marginTop: '0.5rem' }}>Signature: (loading preview…)</li>
            ) : row.acceptor_printed_name?.trim() ? (
              <li style={{ marginTop: '0.75rem', listStyle: 'none', marginLeft: '-1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Signature</div>
                <div style={{ maxWidth: 400 }}>
                  <EstimateAcceptTypedSignatureLine
                    printedName={row.acceptor_printed_name ?? ''}
                    consentAtIso={row.acceptor_consented_at}
                  />
                </div>
              </li>
            ) : null}
          </ul>
          <EstimateDetailCustomerActivitySection
            estimateId={row.id}
            status="customer_accepted"
            defaultOpen={false}
            loading={estimateCustomerEventsLoading}
            events={estimateCustomerEvents}
          />
          <div id={ESTIMATE_JOB_SECTION_HASH} style={{ marginTop: '1rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1rem', margin: 0 }}>Job</h2>
            {!row.job_ledger_id ? (
              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                <button type="button" onClick={openCreateJobModal} style={estimateDetailCreateJobButtonStyle}>
                  {isCO ? 'Apply change order to job' : 'Create job from estimate'}
                </button>
              </div>
            ) : (
              <div
                style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.65rem',
                }}
              >
                <span>
                  {(() => {
                    const hcp = estimateLinkedJobHcp(row)
                    return (
                      <>
                        Linked job:{' '}
                        <Link to={`/jobs?edit=${row.job_ledger_id}`}>{hcp ? `Job #${hcp}` : 'Open in Jobs'}</Link>
                      </>
                    )
                  })()}
                </span>
                <button
                  type="button"
                  onClick={openUnlinkJobConfirm}
                  disabled={unlinkingJob || loading || saving}
                  aria-label="Remove job link from this estimate"
                  style={{
                    ...estSmallSecondaryButton(),
                    cursor: unlinkingJob || loading || saving ? 'not-allowed' : 'pointer',
                    opacity: unlinkingJob || loading || saving ? 0.65 : 1,
                  }}
                >
                  {unlinkingJob ? 'Unlinking…' : 'Unlink job'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {row.status === 'sent' && (
        <>
          <EstimateDetailCustomerActivitySection
            estimateId={row.id}
            status="sent"
            defaultOpen
            loading={estimateCustomerEventsLoading}
            events={estimateCustomerEvents}
          />
          {row.bid_room_id ? (
            <p style={{ marginTop: '1rem', color: 'var(--text-amber-800)' }}>
              In the bid room — the GC reviews and signs this change order on their room page, alongside the proposal.
            </p>
          ) : (
            <EstimateResendLinkPanel
              sentTo={row.customer_email?.trim() || null}
              verdict={resendVerdict}
              busy={resending || loading}
              onResend={() => void resendCustomerLink()}
              resent={resentInfo}
              onCopyUrl={copyResentUrl}
            />
          )}
          {extendVerdict.ok ? (
            <EstimateExtendGoodThroughPanel
              id={EXTEND_GOOD_THROUGH_HASH}
              validUntil={row.valid_until ?? null}
              todayYmd={todayYmd}
              busy={extendingGoodThrough || loading}
              emailTo={row.customer_email?.trim() || null}
              onExtend={(ymd, emailAgain) => void extendGoodThrough(ymd, emailAgain)}
            />
          ) : null}
          <EstimateCustomerAcceptLinkButtons
            customerAcceptUrl={customerAcceptUrl}
            isDraft={false}
            resendAvailable={resendVerdict.ok}
            onCopy={copyCustomerAcceptUrl}
            onOpen={openCustomerAcceptUrl}
            style={{ marginTop: '0.75rem' }}
          />
          <EstimateDownloadPdfButton build={buildEstimatePdf} filing={estimatePdfFiling} disabled={loading} style={{ marginTop: '0.5rem' }} />
          <EstimateRecordDeclineControl
            busy={recordingDecline || loading}
            onRecord={(note, channel) => void recordStaffDecline(note, channel)}
            style={{ marginTop: '1rem' }}
          />
        </>
      )}
      {row.status === 'declined' && (
        <>
          <p style={{ marginTop: '1rem', color: 'var(--text-700)' }}>
            <strong>Declined.</strong> Nothing more is waiting on the customer — the row sits in the Pipeline's
            Declined bucket. To quote again, start a New estimate from the Estimates page.
          </p>
          <EstimateDetailCustomerActivitySection
            estimateId={row.id}
            status="declined"
            defaultOpen
            loading={estimateCustomerEventsLoading}
            events={estimateCustomerEvents}
          />
          <EstimateDownloadPdfButton build={buildEstimatePdf} filing={estimatePdfFiling} disabled={loading} style={{ marginTop: '0.75rem' }} />
        </>
      )}
      {unlinkJobConfirmOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1002,
            paddingTop: 'var(--app-top-chrome, 0px)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unlink-job-confirm-title"
            aria-describedby="unlink-job-confirm-desc"
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 320,
              maxWidth: 440,
              margin: '0 1rem',
            }}
          >
            <h2 id="unlink-job-confirm-title" style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>
              Unlink job
            </h2>
            <p id="unlink-job-confirm-desc" style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
              Remove the job link from this estimate? The job will stay in Jobs; only the link here is cleared.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={closeUnlinkJobConfirm}
                disabled={unlinkingJob}
                style={estSecondaryButton(unlinkingJob)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unlinkingJob}
                onClick={() => {
                  void confirmUnlinkLinkedJob()
                }}
                style={estPrimaryButton(!!unlinkingJob)}
              >
                {unlinkingJob ? 'Unlinking…' : 'Unlink'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
