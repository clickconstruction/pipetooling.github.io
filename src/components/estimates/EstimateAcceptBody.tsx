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
import { estimateTermsPageHref } from '../../lib/estimateTermsPageHref'
import type { EstimateCustomerExperienceClient } from '@/lib/estimateCustomerExperience'
import type { EstimateAcceptHeaderBrand } from '@/lib/estimateAcceptHeaderBrand'
import EstimateOptionsPicker from './EstimateOptionsPicker'
import { estimateOptionTotalCents, type EstimateOption } from '@/lib/estimates/estimateOptions'
import { formatValidUntilCompact } from '../../lib/formatEstimateValidUntilDisplay'

function formatOptionMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}
import { EstimateAcceptTypedSignatureLine } from './EstimateAcceptTypedSignatureLine'
import { SignedSignatureBlock } from '../SignedSignatureBlock'
import { formatSignedCentsUsd, isChangeOrderDocKind, parseEstimateChangeOrderFields } from '@/lib/estimateChangeOrder'

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
        borderTop: '1px solid var(--border)',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
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
  /** CO train (v2.1834): 'change_order' renders the CO document + wording. */
  doc_kind?: string | null
  change_order_fields?: unknown
}

/** Shown inline on staff Page mock-up when estimate is already customer_accepted. */
export type EstimateAcceptStaffAcceptedRecord = {
  printedName: string
  consentedAtIso: string | null
  drawSignatureUrl: string | null
  /** True when DB has signature path but signed URL is not ready yet. */
  drawSignatureLoading: boolean
  /** v2.2724 signature block: attribution facts + the printed record ID (E84-9F3A2C). */
  ip?: string | null
  userAgent?: string | null
  recordId?: string
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
  /**
   * Estimate Options (v2.2457): 2+ options render the picker between header and document,
   * and the document shows the SELECTED option's lines/total instead of the estimate's
   * legacy fields. Controlled — the accept page / staff preview owns the selection.
   */
  options?: EstimateOption[]
  selectedOptionKey?: string | null
  onSelectOption?: (key: string) => void
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const segmentBtnStyle = (active: boolean): CSSProperties => ({
  padding: '0.4rem 0.85rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  cursor: 'pointer',
  background: active ? '#ea580c' : 'var(--bg-subtle)',
  color: active ? 'white' : 'var(--text-700)',
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
    options = [],
    selectedOptionKey = null,
    onSelectOption,
  } = props

  const readOnly = variant === 'staffPreview'
  const showStaffAcceptedInline = readOnly && staffAcceptedRecord != null
  const signatureNameIsPlaceholder = readOnly || !printedName.trim()
  const [acceptModalOpen, setAcceptModalOpen] = useState(false)
  const [acceptMode, setAcceptMode] = useState<'type' | 'draw'>('type')
  const [fieldHint, setFieldHint] = useState<string | null>(null)
  const approveButtonRef = useRef<HTMLButtonElement>(null)
  // v2.2772: the phone-only bottom bar shows while the Approve button is off-screen.
  const [approveInView, setApproveInView] = useState(false)
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
      backgroundColor: 'var(--surface)',
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

  useEffect(() => {
    const el = approveButtonRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => setApproveInView(entries.some((e) => e.isIntersecting)), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [showStaffAcceptedInline])


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

  const optionsActive = options.length >= 2
  const selectedOption = optionsActive
    ? options.find((o) => o.key === selectedOptionKey) ?? options.find((o) => o.recommended) ?? options[0] ?? null
    : null
  const isCo = isChangeOrderDocKind(estimate.doc_kind)
  const shownTotalCents = selectedOption ? estimateOptionTotalCents(selectedOption) : estimate.total_cents
  const shownTotal = isCo ? formatSignedCentsUsd(shownTotalCents) : formatOptionMoney(shownTotalCents)
  const approveLabel = isCo
    ? 'Approve change order'
    : selectedOption
      ? `Approve "${selectedOption.name.trim() || 'Option'}" — ${formatOptionMoney(estimateOptionTotalCents(selectedOption))}`
      : 'Approve'
  // One line on a 390 px phone: no weekday, short verb (v2.2780).
  const validityLine = estimate.valid_until ? `Good through ${formatValidUntilCompact(estimate.valid_until)}.` : null

  // v2.2772 (owner pick B): the number first — a total card under the title with the Approve
  // door, so a phone shows what the customer is looking at before any scrolling.
  const summaryCard = (
    <div
      data-testid="estimate-summary-card"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'baseline',
        gap: '0.35rem 0.75rem',
        background: 'var(--bg-orange-tint)',
        border: '1px solid var(--border-orange)',
        borderRadius: 8,
        padding: '0.7rem 0.85rem',
        margin: '0.9rem 0 0',
      }}
    >
      <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-orange-700)' }}>
        {selectedOption ? `${selectedOption.name.trim() || 'Option'} · ${cx.docTotalLabel}` : cx.docTotalLabel}
      </span>
      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{shownTotal}</span>
      {validityLine ? <span style={{ gridColumn: '1 / -1', fontSize: '0.8rem', color: 'var(--text-700)' }}>{validityLine}</span> : null}
      {!showStaffAcceptedInline ? (
        <button
          type="button"
          onClick={() => setAcceptModalOpen(true)}
          style={{ ...approveBtnStyle, gridColumn: '1 / -1', marginTop: '0.35rem', width: '100%', maxWidth: 'none' }}
        >
          {approveLabel}
        </button>
      ) : null}
    </div>
  )

  return (
    <>
      <EstimateCustomerDocument
        title={estimate.title}
        forLine={estimate.for_line}
        validUntil={estimate.valid_until}
        lineItemsSnapshot={selectedOption ? selectedOption.line_items : estimate.line_items_snapshot}
        termsSnapshot={estimate.terms_snapshot}
        totalCents={selectedOption ? estimateOptionTotalCents(selectedOption) : estimate.total_cents}
        previewBanner={previewBanner}
        titleFallback={cx.docTitleFallback}
        validThroughPrefix={cx.docValidThroughPrefix}
        lineItemsHeading={
          selectedOption
            ? `Your selection — ${selectedOption.name.trim() || 'Option'}`
            : cx.docLineItemsHeading
        }
        termsHeading={cx.docTermsHeading}
        termsPageHref={estimateTermsPageHref()}
        totalLabel={cx.docTotalLabel}
        headerBrand={headerBrand}
        summary={summaryCard}
        beforeLineItems={
          optionsActive ? (
            <EstimateOptionsPicker
              options={options}
              selectedKey={selectedOption?.key ?? null}
              onSelect={(key) => onSelectOption?.(key)}
              readOnly={readOnly && !onSelectOption}
            />
          ) : null
        }
        changeOrder={
          isChangeOrderDocKind(estimate.doc_kind)
            ? parseEstimateChangeOrderFields(estimate.change_order_fields)
            : null
        }
      />

      {customerAttachment ? <EstimateCustomerAttachmentCard attachment={customerAttachment} /> : null}

      {showStaffAcceptedInline && staffAcceptedRecord ? (
        <SignedSignatureBlock
          heading="Customer acceptance"
          printedName={staffAcceptedRecord.printedName}
          signedAtIso={staffAcceptedRecord.consentedAtIso}
          consentedAtIso={staffAcceptedRecord.consentedAtIso}
          consentSummary={cx.acceptCheckboxLabel.replace(/^I agree to /i, 'agreed to ').replace(/^I /i, '')}
          method={staffAcceptedRecord.drawSignatureUrl || staffAcceptedRecord.drawSignatureLoading ? 'draw' : 'type'}
          surface="estimate"
          ip={staffAcceptedRecord.ip ?? null}
          userAgent={staffAcceptedRecord.userAgent ?? null}
          recordId={staffAcceptedRecord.recordId ?? '—'}
          drawSignatureUrl={staffAcceptedRecord.drawSignatureUrl}
          drawSignatureLoading={staffAcceptedRecord.drawSignatureLoading}
        />
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
            {selectedOption
              ? `Approve "${selectedOption.name.trim() || 'Option'}" — ${formatOptionMoney(estimateOptionTotalCents(selectedOption))}`
              : 'Approve'}
          </button>
        </div>
      ) : null}

      <AcceptPageFooterBlock text={cx.acceptPageFooter} />

      {variant === 'interactive' && !showStaffAcceptedInline && !acceptModalOpen && !approveInView ? (
        <div
          className="estimate-accept-sticky"
          data-theme="light"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 900,
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.6rem 1rem calc(0.6rem + env(safe-area-inset-bottom, 0px))',
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            boxShadow: '0 -6px 16px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{shownTotal}</div>
            {validityLine ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{validityLine}</div> : null}
          </div>
          <button type="button" onClick={() => setAcceptModalOpen(true)} style={{ ...approveBtnStyle, marginTop: 0, padding: '0.55rem 1.1rem', flex: '0 0 auto' }}>
            {isCo ? 'Approve' : 'Accept'}
          </button>
        </div>
      ) : null}

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
            padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
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
              background: 'var(--surface)',
              borderRadius: 8,
              maxWidth: 520,
              width: '100%',
              maxHeight: 'min(90vh, 100%)',
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
                {isChangeOrderDocKind(estimate.doc_kind)
                  ? 'Approve Change Order'
                  : selectedOption
                    ? `Approve "${selectedOption.name.trim() || 'Option'}" — ${formatOptionMoney(estimateOptionTotalCents(selectedOption))}`
                    : ESTIMATE_ACCEPT_MODAL_TITLE}
              </h2>
              <button
                type="button"
                onClick={() => tryCloseModal()}
                disabled={submitting}
                style={{
                  flexShrink: 0,
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.85rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  background: 'var(--bg-subtle)',
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
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem', marginBottom: 0 }}>
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
                        border: '1px solid var(--border-strong)',
                        borderRadius: 6,
                        background: 'var(--surface)',
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
                      border: '1px solid var(--border-strong)',
                      borderRadius: 6,
                      background: 'var(--bg-subtle)',
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
                  color: 'var(--text-muted)',
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
                <p style={{ color: 'var(--text-red-700)', marginTop: '0.75rem' }}>{formError || fieldHint}</p>
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
                        color: 'var(--text-muted)',
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
