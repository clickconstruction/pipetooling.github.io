import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import { estimateEmailFrom } from '../../lib/customerEmailFrom'
import type { EstimateAcceptHeaderBrand } from '../../lib/estimateAcceptHeaderBrand'
import type { CustomerAttachmentPayload } from '../../lib/estimateCustomerAttachment'
import { acceptanceCxOmitKeys, type EstimateCustomerExperienceResolved, type EstimateExperienceOverrideKey } from '../../lib/estimateCustomerExperience'
import type { buildEstimateLetterheadEmail } from '../../lib/estimateEmailLetterhead'
import type { EstimateLineItemNormalized } from '../../lib/estimateLineItemNormalize'
import { CX_OVERRIDE_SECTIONS, type CxOverrideFields } from '../../lib/estimates/estimateCxOverrideSections'
import type { EstimateDetailRow } from '../../lib/estimates/estimateDetailRow'
import { normalizeEstimateOptionsFromJson, toggleEstimateOptionSelection, type EstimateOption } from '../../lib/estimates/estimateOptions'
import { signedRecordId } from '../../lib/signedRecordId'
import EstimateAcceptBody from './EstimateAcceptBody'
import EstimateCustomerAcceptLinkButtons from './EstimateCustomerAcceptLinkButtons'
import EstimateCustomerThankYou from './EstimateCustomerThankYou'
import EstimateCxOverrideFields from './EstimateCxOverrideFields'
import EstimateDownloadPdfButton from './EstimateDownloadPdfButton'
import { estSecondaryButton } from './estimatesPageStyles'

export type EstimateCustomerPreviewTab = 'email' | 'page' | 'thankyou'

type DownloadPdfProps = ComponentProps<typeof EstimateDownloadPdfButton>

export interface EstimateCustomerExperienceSectionProps {
  row: EstimateDetailRow
  isDraft: boolean
  loading: boolean
  customerAcceptUrl: string | null
  resendAvailable: boolean
  copyCustomerAcceptUrl: () => void
  openCustomerAcceptUrl: () => void
  buildEstimatePdf: DownloadPdfProps['build']
  estimatePdfFiling: DownloadPdfProps['filing']
  /** Which preview is up. The page holds it, since its reload unmounts this section. */
  customerPreviewTab: EstimateCustomerPreviewTab
  setCustomerPreviewTab: (tab: EstimateCustomerPreviewTab) => void
  /** The email as the send builds it, or null while the experience is not resolved. */
  customerEmailPreview: ReturnType<typeof buildEstimateLetterheadEmail> | null
  previewEmailTo: string
  staffResolvedExperience: EstimateCustomerExperienceResolved | null
  openStaffAcceptCustomerPreview: () => void
  /** The draft's form as typed; a sent estimate reads its row instead. */
  title: string
  validUntil: string
  lines: EstimateLineItemNormalized[]
  terms: string
  totalCents: number
  acceptancePreviewForLine: string | null
  syncedEstimateOptions: EstimateOption[]
  /** The Page preview's own selection, rehearsing the customer's picker. */
  previewSelectedOptionKeys: string[]
  setPreviewSelectedOptionKeys: Dispatch<SetStateAction<string[]>>
  acceptanceDocHeaderBrand: EstimateAcceptHeaderBrand | null
  customerAttachmentPreview: CustomerAttachmentPayload | null
  acceptorSignatureSignedUrl: string | null
  /** This draft's overrides of the customer copy; saved with the draft. */
  cxOverrideFields: CxOverrideFields
  setCxOverrideFields: Dispatch<SetStateAction<CxOverrideFields>>
  cxTemplateDefaults: Record<EstimateExperienceOverrideKey, string>
}

/**
 * Customer experience on an estimate: what the customer gets, in three previews — the email as the
 * send builds it, the acceptance page with its option picker to rehearse, and the thank-you — and, on
 * a draft, the boxes that change the copy for this estimate alone.
 *
 * Moved whole from `EstimateDetail` (v2.7622, punch list #46 row 3, cut 5 of the Estimates map); the
 * markup is the page's own. Every value is the page's: the resolved experience and the built email
 * have other readers there (the draft's headings, the sent view, the Tell the customer sheet).
 */
export default function EstimateCustomerExperienceSection({
  row,
  isDraft,
  loading,
  customerAcceptUrl,
  resendAvailable,
  copyCustomerAcceptUrl,
  openCustomerAcceptUrl,
  buildEstimatePdf,
  estimatePdfFiling,
  customerPreviewTab,
  setCustomerPreviewTab,
  customerEmailPreview,
  previewEmailTo,
  staffResolvedExperience,
  openStaffAcceptCustomerPreview,
  title,
  validUntil,
  lines,
  terms,
  totalCents,
  acceptancePreviewForLine,
  syncedEstimateOptions,
  previewSelectedOptionKeys,
  setPreviewSelectedOptionKeys,
  acceptanceDocHeaderBrand,
  customerAttachmentPreview,
  acceptorSignatureSignedUrl,
  cxOverrideFields,
  setCxOverrideFields,
  cxTemplateDefaults,
}: EstimateCustomerExperienceSectionProps) {
  return (
    <details
      style={{
        marginTop: '2rem',
        paddingTop: '1rem',
        borderTop: '1px solid var(--border)',
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600, userSelect: 'none' }}>Customer experience</summary>
    <div style={{ marginTop: '1rem' }}>
      {row.status !== 'sent' ? (
        <EstimateCustomerAcceptLinkButtons
          customerAcceptUrl={customerAcceptUrl}
          isDraft={isDraft}
          resendAvailable={resendAvailable}
          onCopy={copyCustomerAcceptUrl}
          onOpen={openCustomerAcceptUrl}
          style={{ marginBottom: '1rem' }}
        />
      ) : null}
      {row.status === 'customer_accepted' ? (
        <EstimateDownloadPdfButton build={buildEstimatePdf} filing={estimatePdfFiling} disabled={loading} style={{ marginBottom: '1rem' }} />
      ) : null}
      {!isDraft && row.customer_experience_sent ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Shown below is the copy customers see — saved when this estimate was sent.
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setCustomerPreviewTab('email')}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: 4,
            border: '1px solid var(--border-strong)',
            background: customerPreviewTab === 'email' ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
            color: 'var(--text-700)',
            fontWeight: customerPreviewTab === 'email' ? 600 : 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setCustomerPreviewTab('page')}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: 4,
            border: '1px solid var(--border-strong)',
            background: customerPreviewTab === 'page' ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
            color: 'var(--text-700)',
            fontWeight: customerPreviewTab === 'page' ? 600 : 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Acceptance page
        </button>
        <button
          type="button"
          onClick={() => setCustomerPreviewTab('thankyou')}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: 4,
            border: '1px solid var(--border-strong)',
            background: customerPreviewTab === 'thankyou' ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
            color: 'var(--text-700)',
            fontWeight: customerPreviewTab === 'thankyou' ? 600 : 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Thank you
        </button>
      </div>

      {customerPreviewTab === 'email' && customerEmailPreview && (
        <>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '1rem',
              background: 'var(--bg-page)',
              fontSize: '0.9rem',
            }}
          >
            <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)' }}>
              <strong>From:</strong> {estimateEmailFrom(acceptanceDocHeaderBrand)}
              {customerEmailPreview.replyTo ? <> · <strong>Reply-To:</strong> {customerEmailPreview.replyTo}</> : null}
            </p>
            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>To:</strong> {previewEmailTo}
            </p>
            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Subject:</strong> {customerEmailPreview.subject}
            </p>
            <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>What the customer sees</p>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Built by the same code that sends it. The logo appears when an acceptance page logo is selected.
            </p>
            <iframe
              title="Estimate email preview"
              sandbox=""
              srcDoc={customerEmailPreview.html}
              style={{ width: '100%', height: 640, border: '1px solid var(--border)', borderRadius: 6 }}
            />
            <p style={{ margin: '0.75rem 0 0.35rem', fontWeight: 600 }}>Plain text</p>
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0.75rem',
              }}
            >
              {customerEmailPreview.text}
            </pre>
          </div>
          {isDraft ? <EstimateCxOverrideFields section={CX_OVERRIDE_SECTIONS[0]} fields={cxOverrideFields} setFields={setCxOverrideFields} defaults={cxTemplateDefaults} /> : null}
        </>
      )}

      {customerPreviewTab === 'page' && staffResolvedExperience && (
        <>
          <div
            style={{
              fontFamily: 'system-ui, sans-serif',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '1rem',
              background: 'var(--surface)',
              maxWidth: 'min(640px, 100%)',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <EstimateAcceptBody
              variant="staffPreview"
              previewBanner={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>Preview — customers use a secure link to accept.</span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => openStaffAcceptCustomerPreview()}
                      title="Opens authenticated staff preview in a new tab (same layout as the customer page). Does not submit acceptance."
                      style={estSecondaryButton()}
                    >
                      Preview as customer
                    </button>
                  </div>
                </div>
              }
              estimate={{
                title: isDraft ? title.trim() || '' : row.title || '',
                for_line: acceptancePreviewForLine,
                valid_until: isDraft
                  ? validUntil.trim()
                    ? validUntil.trim()
                    : null
                  : row.valid_until ?? null,
                line_items_snapshot: isDraft ? lines : row.line_items_snapshot,
                terms_snapshot: isDraft ? terms : row.terms_snapshot ?? '',
                total_cents: isDraft ? totalCents : row.total_cents,
              }}
              options={isDraft ? syncedEstimateOptions : normalizeEstimateOptionsFromJson(row.options_snapshot)}
              selectedOptionKeys={previewSelectedOptionKeys}
              onToggleOption={(key) =>
                setPreviewSelectedOptionKeys((prev) =>
                  toggleEstimateOptionSelection(isDraft ? syncedEstimateOptions : normalizeEstimateOptionsFromJson(row.options_snapshot), prev, key),
                )
              }
              experience={staffResolvedExperience}
              printedName={
                !isDraft && row.status === 'customer_accepted'
                  ? row.acceptor_printed_name?.trim() ?? ''
                  : ''
              }
              agreed={false}
              onPrintedNameChange={() => {}}
              onAgreedChange={() => {}}
              formError={null}
              submitting={false}
              onSubmit={() => undefined}
              headerBrand={acceptanceDocHeaderBrand}
              customerAttachment={customerAttachmentPreview}
              staffAcceptedRecord={
                !isDraft && row.status === 'customer_accepted'
                  ? {
                      printedName: row.acceptor_printed_name?.trim() ?? '',
                      consentedAtIso: row.acceptor_consented_at,
                      drawSignatureUrl: row.acceptor_signature_storage_path?.trim()
                        ? acceptorSignatureSignedUrl
                        : null,
                      drawSignatureLoading:
                        !!(row.acceptor_signature_storage_path?.trim()) &&
                        !acceptorSignatureSignedUrl,
                      ip: row.acceptor_ip,
                      userAgent: row.acceptor_user_agent,
                      recordId: signedRecordId('E', row.estimate_number, row.id),
                      estimateRowId: row.id,
                    }
                  : null
              }
            />
          </div>
          {isDraft ? (
            <EstimateCxOverrideFields section={CX_OVERRIDE_SECTIONS[1]} omitKeys={acceptanceCxOmitKeys(validUntil, title)} fields={cxOverrideFields} setFields={setCxOverrideFields} defaults={cxTemplateDefaults} />
          ) : null}
        </>
      )}

      {customerPreviewTab === 'thankyou' && staffResolvedExperience && (
        <>
          <div
            style={{
              fontFamily: 'system-ui, sans-serif',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 0,
              background: 'var(--surface)',
              maxWidth: 'min(640px, 100%)',
              width: '100%',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <EstimateCustomerThankYou
              previewBanner="Preview — customers see this after submitting acceptance, or if they open the link after it was already used."
              title={staffResolvedExperience.thankYouTitle}
              body={staffResolvedExperience.thankYouBody}
            />
          </div>
          {isDraft ? <EstimateCxOverrideFields section={CX_OVERRIDE_SECTIONS[2]} fields={cxOverrideFields} setFields={setCxOverrideFields} defaults={cxTemplateDefaults} /> : null}
        </>
      )}
    </div>
    </details>
  )
}
