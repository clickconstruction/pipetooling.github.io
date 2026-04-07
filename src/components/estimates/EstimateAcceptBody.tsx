import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import SignaturePad from 'signature_pad'
import EstimateCustomerDocument from './EstimateCustomerDocument'
import EstimateCustomerAttachmentCard from './EstimateCustomerAttachmentCard'
import type { CustomerAttachmentPayload } from '@/lib/estimateCustomerAttachment'
import EstimateTermsHeaderNotice from './EstimateTermsHeaderNotice'
import type { EstimateCustomerExperienceClient } from '@/lib/estimateCustomerExperience'
import type { EstimateAcceptHeaderBrand } from '@/lib/estimateAcceptHeaderBrand'
import { EstimateAcceptTypedSignatureLine } from './EstimateAcceptTypedSignatureLine'

const ESTIMATE_ACCEPT_MODAL_TITLE = 'Approve Estimate'
const ESTIMATE_ACCEPT_NAME_PLACEHOLDER = 'Your name'

const ESTIMATE_ACCEPT_MODAL_SIGNATURE_DISCLOSURE =
  'By signing, you accept this estimate, its associated costs, and the Terms and Conditions. ' +
  'Typing or drawing your signature here will have the same force and effect as your written signature. ' +
  'Additional requests to approve modifications to this estimate will not void this agreement unless otherwise stated.'

export type EstimateAcceptSubmitPayload =
  | { mode: 'type'; printedName: string }
  | { mode: 'draw'; printedName: string; signaturePngBase64: string }

export function AcceptPageFooterBlock({ text }: { text: string }) {
  if (!text.trim()) return null
  return (
    <footer
      aria-label="Company contact and license"
      style={{
        marginTop: '2rem',
        paddingTop: '1rem',
        borderTop: '1px solid #e5e7eb',
        fontSize: '0.8rem',
        color: '#6b7280',
        lineHeight: 1.5,
        whiteSpace: 'pre-line',
        textAlign: 'center',
      }}
    >
      {text}
    </footer>
  )
}

export type EstimateAcceptBodyEstimate = {
  title: string
  for_line: string | null
  valid_until: string | null
  line_items_snapshot: unknown
  terms_snapshot: string
  total_cents: number
}

/** Shown inline on staff Page mock-up when estimate is already customer_accepted. */
export type EstimateAcceptStaffAcceptedRecord = {
  printedName: string
  consentedAtIso: string | null
  drawSignatureUrl: string | null
  /** True when DB has signature path but signed URL is not ready yet. */
  drawSignatureLoading: boolean
}

export type EstimateAcceptBodyProps = {
  variant: 'interactive' | 'staffPreview'
  estimate: EstimateAcceptBodyEstimate
  experience: EstimateCustomerExperienceClient
  printedName: string
  agreed: boolean
  onPrintedNameChange: (value: string) => void
  onAgreedChange: (value: boolean) => void
  formError: string | null
  submitting: boolean
  onSubmit: (payload: EstimateAcceptSubmitPayload) => void
  headerBrand?: EstimateAcceptHeaderBrand | null
  /** Passed to the document (e.g. staff “Preview as customer” strip). */
  previewBanner?: ReactNode
  /** When set with staffPreview, shows archival acceptance under the document and hides Approve. */
  staffAcceptedRecord?: EstimateAcceptStaffAcceptedRecord | null
  /** Frozen supporting document (e.g. Drive PDF); shown after quote body, before accept UI. */
  customerAttachment?: CustomerAttachmentPayload | null
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const segmentBtnStyle = (active: boolean): CSSProperties => ({
  padding: '0.4rem 0.85rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  cursor: 'pointer',
  background: active ? '#ea580c' : '#f9fafb',
  color: active ? 'white' : '#374151',
})

export default function EstimateAcceptBody(props: EstimateAcceptBodyProps) {
  const {
    variant,
    estimate,
    experience: cx,
    printedName,
    agreed,
    onPrintedNameChange,
    onAgreedChange,
    formError,
    submitting,
    onSubmit,
    headerBrand = null,
    previewBanner,
    staffAcceptedRecord = null,
    customerAttachment = null,
  } = props

  const readOnly = variant === 'staffPreview'
  const showStaffAcceptedInline = readOnly && staffAcceptedRecord != null
  const signatureNameIsPlaceholder = readOnly || !printedName.trim()
  const [acceptModalOpen, setAcceptModalOpen] = useState(false)
  const [acceptMode, setAcceptMode] = useState<'type' | 'draw'>('type')
  const [fieldHint, setFieldHint] = useState<string | null>(null)
  const approveButtonRef = useRef<HTMLButtonElement>(null)
  const dialogPanelRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const headingId = useId()
  const prevOpenRef = useRef(false)

  function tryCloseModal() {
    if (submitting) return
    setAcceptModalOpen(false)
  }

  useLayoutEffect(() => {
    if (!acceptModalOpen || readOnly || acceptMode !== 'draw') {
      padRef.current?.off()
      padRef.current = null
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const w = 400
    const h = 160
    canvas.width = w
    canvas.height = h
    const pad = new SignaturePad(canvas, {
      backgroundColor: '#ffffff',
      penColor: '#111827',
    })
    padRef.current = pad
    return () => {
      pad.off()
      padRef.current = null
    }
  }, [acceptModalOpen, readOnly, acceptMode])

  useEffect(() => {
    if (!acceptModalOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [acceptModalOpen])

  useEffect(() => {
    if (prevOpenRef.current && !acceptModalOpen) {
      approveButtonRef.current?.focus()
      setAcceptMode('type')
      setFieldHint(null)
    }
    prevOpenRef.current = acceptModalOpen
  }, [acceptModalOpen])

  useEffect(() => {
    if (!acceptModalOpen) return
    if (!dialogPanelRef.current) return

    function collectFocusable(): HTMLElement[] {
      const r = dialogPanelRef.current
      if (!r) return []
      return Array.from(r.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.closest('[data-modal-focus-root]') === r,
      )
    }

    const focusables = collectFocusable()
    focusables[0]?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!submitting) setAcceptModalOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      const list = collectFocusable()
      if (list.length === 0) return
      const idx = list.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey) {
        if (idx <= 0) {
          e.preventDefault()
          list[list.length - 1]?.focus()
        }
      } else {
        if (idx === list.length - 1 || idx === -1) {
          e.preventDefault()
          list[0]?.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [acceptModalOpen, submitting])

  const primaryBtnStyle = {
    marginTop: 0,
    padding: '0.5rem 1.25rem',
    fontWeight: 600,
    background: '#ea580c',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer' as const,
  }

  const approveBtnStyle = {
    ...primaryBtnStyle,
    cursor: readOnly ? ('default' as const) : ('pointer' as const),
  }

  const acceptedNamePreview =
    staffAcceptedRecord != null && staffAcceptedRecord.printedName.trim()
      ? staffAcceptedRecord.printedName.trim()
      : ESTIMATE_ACCEPT_NAME_PLACEHOLDER
  const acceptedNameIsPlaceholder = !(
    staffAcceptedRecord != null && staffAcceptedRecord.printedName.trim()
  )

  function handleInteractiveSubmit() {
    if (readOnly) return
    setFieldHint(null)
    const trimmed = printedName.trim()
    if (!trimmed) {
      setFieldHint('Please enter your full name.')
      return
    }
    if (acceptMode === 'type') {
      onSubmit({ mode: 'type', printedName: trimmed })
      return
    }
    const pad = padRef.current
    if (!pad || pad.isEmpty()) {
      setFieldHint('Please sign in the box.')
      return
    }
    onSubmit({
      mode: 'draw',
      printedName: trimmed,
      signaturePngBase64: pad.toDataURL('image/png'),
    })
  }

  return (
    <>
      <EstimateCustomerDocument
        title={estimate.title}
        forLine={estimate.for_line}
        validUntil={estimate.valid_until}
        lineItemsSnapshot={estimate.line_items_snapshot}
        termsSnapshot={estimate.terms_snapshot}
        totalCents={estimate.total_cents}
        previewBanner={previewBanner}
        titleFallback={cx.docTitleFallback}
        validThroughPrefix={cx.docValidThroughPrefix}
        lineItemsHeading={cx.docLineItemsHeading}
        termsHeading={cx.docTermsHeading}
        totalLabel={cx.docTotalLabel}
        headerBrand={headerBrand}
      />

      {customerAttachment ? <EstimateCustomerAttachmentCard attachment={customerAttachment} /> : null}

      {showStaffAcceptedInline && staffAcceptedRecord ? (
        <section
          aria-label="Customer acceptance record"
          style={{ marginTop: '1.5rem' }}
        >
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              margin: '0 0 0.75rem',
              color: '#111827',
            }}
          >
            Customer acceptance
          </h2>
          <p
            style={{
              fontSize: '0.8rem',
              color: '#6b7280',
              lineHeight: 1.45,
              marginTop: 0,
              marginBottom: '0.5rem',
            }}
          >
            {ESTIMATE_ACCEPT_MODAL_SIGNATURE_DISCLOSURE}
          </p>
          <label
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
              marginTop: 0,
              marginBottom: '0.75rem',
            }}
          >
            <input
              type="checkbox"
              checked
              disabled
              aria-label="Customer agreed to the estimate and terms as recorded at acceptance"
            />
            <span>{cx.acceptCheckboxLabel}</span>
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
              {cx.acceptNameFieldLabel}
            </span>
            <div
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '0.5rem',
                boxSizing: 'border-box',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                background: '#f9fafb',
                fontSize: '0.95rem',
                color: acceptedNameIsPlaceholder ? '#6b7280' : '#111827',
              }}
            >
              {acceptedNamePreview}
            </div>
          </label>
          {staffAcceptedRecord.drawSignatureLoading ? (
            <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.75rem', marginBottom: 0 }}>
              Loading signature…
            </p>
          ) : staffAcceptedRecord.drawSignatureUrl ? (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>Signature</div>
              <img
                src={staffAcceptedRecord.drawSignatureUrl}
                alt="Customer signature"
                style={{
                  display: 'block',
                  maxWidth: 400,
                  width: '100%',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                }}
              />
            </div>
          ) : (
            <div style={{ marginTop: '0.75rem' }}>
              <EstimateAcceptTypedSignatureLine
                printedName={staffAcceptedRecord.printedName}
                consentAtIso={staffAcceptedRecord.consentedAtIso}
                placeholderName={ESTIMATE_ACCEPT_NAME_PLACEHOLDER}
                nameMutedOverride={acceptedNameIsPlaceholder}
                ariaHidden
              />
            </div>
          )}
        </section>
      ) : null}

      {!showStaffAcceptedInline ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            marginTop: '1.5rem',
          }}
        >
          <button
            ref={approveButtonRef}
            type="button"
            onClick={() => setAcceptModalOpen(true)}
            style={{ ...approveBtnStyle, marginTop: 0 }}
          >
            Approve
          </button>
        </div>
      ) : null}

      <AcceptPageFooterBlock text={cx.acceptPageFooter} />
      <div style={{ marginTop: '1.5rem' }}>
        <EstimateTermsHeaderNotice />
      </div>

      {acceptModalOpen ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            boxSizing: 'border-box',
          }}
          onClick={() => tryCloseModal()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div
            ref={dialogPanelRef}
            data-modal-focus-root
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            style={{
              background: 'white',
              borderRadius: 8,
              maxWidth: 520,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '1.25rem',
              boxSizing: 'border-box',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                flexWrap: 'wrap',
                marginBottom: '0.75rem',
              }}
            >
              <h2
                id={headingId}
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  margin: 0,
                  flex: '1 1 auto',
                  minWidth: 0,
                }}
              >
                {ESTIMATE_ACCEPT_MODAL_TITLE}
              </h2>
              <button
                type="button"
                onClick={() => tryCloseModal()}
                disabled={submitting}
                style={{
                  flexShrink: 0,
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.85rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#f9fafb',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                Close
              </button>
            </div>

            <section>
              <label style={{ display: 'block', marginTop: '0.75rem' }}>
                <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem' }}>
                  {cx.acceptNameFieldLabel}
                  <span aria-hidden="true"> *</span>
                </span>
                <input
                  type="text"
                  value={readOnly ? '' : printedName}
                  onChange={(e) => onPrintedNameChange(e.target.value)}
                  readOnly={readOnly}
                  disabled={readOnly}
                  required={!readOnly}
                  aria-required={!readOnly}
                  placeholder={readOnly ? '—' : undefined}
                  autoComplete={readOnly ? 'off' : 'name'}
                  style={{
                    width: '100%',
                    maxWidth: 400,
                    padding: '0.5rem',
                    boxSizing: 'border-box',
                    ...(readOnly ? { opacity: 0.85 } : {}),
                  }}
                />
              </label>

              <div
                role="group"
                aria-label="Sign by typing or drawing"
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  marginTop: '0.75rem',
                }}
              >
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setAcceptMode('type')
                    setFieldHint(null)
                  }}
                  style={segmentBtnStyle(!readOnly && acceptMode === 'type')}
                >
                  Type
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setAcceptMode('draw')
                    setFieldHint(null)
                  }}
                  style={segmentBtnStyle(!readOnly && acceptMode === 'draw')}
                >
                  Draw
                </button>
              </div>
              {readOnly ? (
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.35rem', marginBottom: 0 }}>
                  Preview mode: Type / Draw is disabled.
                </p>
              ) : null}

              {acceptMode === 'type' || readOnly ? (
                <div style={{ marginTop: '0.75rem' }}>
                  <EstimateAcceptTypedSignatureLine
                    printedName={printedName}
                    placeholderName={ESTIMATE_ACCEPT_NAME_PLACEHOLDER}
                    previewDate={new Date()}
                    nameMutedOverride={signatureNameIsPlaceholder}
                    ariaHidden
                  />
                </div>
              ) : (
                <div style={{ marginTop: '0.75rem' }}>
                  <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem' }}>
                    Sign below (use your finger or mouse)
                  </span>
                  <div style={{ width: '100%', maxWidth: 400 }}>
                    <canvas
                      ref={canvasRef}
                      style={{
                        display: 'block',
                        width: '100%',
                        maxWidth: 400,
                        height: 160,
                        touchAction: 'none',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      padRef.current?.clear()
                      setFieldHint(null)
                    }}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.85rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      background: '#f9fafb',
                      cursor: 'pointer',
                    }}
                  >
                    Clear signature
                  </button>
                </div>
              )}

              <p
                style={{
                  fontSize: '0.8rem',
                  color: '#6b7280',
                  lineHeight: 1.45,
                  marginTop: '1rem',
                  marginBottom: '0.5rem',
                }}
              >
                {ESTIMATE_ACCEPT_MODAL_SIGNATURE_DISCLOSURE}
              </p>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginTop: 0 }}>
                <input
                  type="checkbox"
                  checked={readOnly ? false : agreed}
                  onChange={(e) => onAgreedChange(e.target.checked)}
                  disabled={readOnly}
                />
                <span>{cx.acceptCheckboxLabel}</span>
              </label>
              {!readOnly && (formError || fieldHint) ? (
                <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{formError || fieldHint}</p>
              ) : null}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100%',
                  marginTop: '1rem',
                }}
              >
                {readOnly ? (
                  <>
                    <button
                      type="button"
                      disabled
                      style={{
                        ...primaryBtnStyle,
                        cursor: 'default',
                        opacity: 0.92,
                      }}
                    >
                      {cx.acceptSubmitLabel}
                    </button>
                    <p
                      style={{
                        fontSize: '0.8rem',
                        color: '#6b7280',
                        marginTop: '0.5rem',
                        marginBottom: 0,
                        textAlign: 'center',
                        maxWidth: '28rem',
                      }}
                    >
                      While submitting: {cx.acceptSubmittingLabel}
                    </p>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleInteractiveSubmit()}
                    disabled={submitting}
                    style={{
                      ...primaryBtnStyle,
                      cursor: submitting ? 'wait' : 'pointer',
                    }}
                  >
                    {submitting ? cx.acceptSubmittingLabel : cx.acceptSubmitLabel}
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  )
}
