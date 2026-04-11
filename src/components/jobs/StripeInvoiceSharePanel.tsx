import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import {
  buildStripeInvoiceEmailBody,
  buildStripeInvoiceEmailSubject,
  buildStripeInvoiceSmsText,
} from '../../lib/stripeInvoiceShareCopy'
import { EmailBillDraftModal } from './EmailBillDraftModal'
import { SmsBillDraftModal } from './SmsBillDraftModal'

export type StripeInvoiceSharePanelProps = {
  hostedInvoiceUrl: string
  stripeInvoiceId: string
  customerEmail: string | null
  customerName: string | null
  jobName: string | null
  hcpNumber: string | null
  /** e.g. "$1,234.56" */
  amountLabel: string
  /** Tighter layout for nested UIs */
  compact?: boolean
  /** When true, hide “Customer pay page” (e.g. shown inline elsewhere). */
  omitCustomerPayPage?: boolean
  /** When true, hide “Open in Stripe” (e.g. shown in modal header). */
  omitOpenInStripe?: boolean
  /** Label for the mailto button (default “Send email…”). */
  emailButtonLabel?: string
  /**
   * When true, copy link / SMS / email are icon buttons after “Payment Links:”
   * (Edit Job, View bill). Otherwise text buttons.
   */
  paymentLinkActionsAsIcons?: boolean
  /** When true with `paymentLinkActionsAsIcons`, hide the “Payment Links:” label (icons only). */
  omitPaymentLinksLabel?: boolean
  /** No bordered gray panel; row is full-width and centered (e.g. View bill). */
  unboxed?: boolean
  /** When true with `unboxed`, no top margin and inner row does not stretch full width (toolbar next to sibling buttons). */
  inlineRow?: boolean
  /** Z-index for SMS Bill Draft modal (above parent overlays). */
  smsDraftModalZIndex?: number
  /** Z-index for Email Bill Draft modal; defaults to `smsDraftModalZIndex` or 1300. */
  emailDraftModalZIndex?: number
}

function shareCopyFromProps(p: StripeInvoiceSharePanelProps) {
  return {
    customerName: p.customerName,
    payUrl: p.hostedInvoiceUrl,
    amountLabel: p.amountLabel,
    jobName: p.jobName,
    hcpNumber: p.hcpNumber,
  }
}

async function copyText(text: string, showToast: (m: string, t?: 'info' | 'error' | 'success' | 'warning') => void, okMsg: string) {
  try {
    await navigator.clipboard.writeText(text)
    showToast(okMsg, 'success')
  } catch {
    showToast('Could not copy to clipboard', 'error')
  }
}

export function StripeInvoiceSharePanel(p: StripeInvoiceSharePanelProps) {
  const { showToast } = useToastContext()
  const [smsDraftOpen, setSmsDraftOpen] = useState(false)
  const [smsDraftText, setSmsDraftText] = useState('')
  const [emailDraftOpen, setEmailDraftOpen] = useState(false)
  const [emailDraftSubject, setEmailDraftSubject] = useState('')
  const [emailDraftBody, setEmailDraftBody] = useState('')
  const emailLabel = (p.emailButtonLabel ?? 'Send email…').trim() || 'Send email…'

  function openSmsBillDraft() {
    setSmsDraftText(buildStripeInvoiceSmsText(shareCopyFromProps(p)))
    setSmsDraftOpen(true)
  }

  function openEmailBillDraft() {
    setEmailDraftSubject(buildStripeInvoiceEmailSubject(p.jobName))
    setEmailDraftBody(buildStripeInvoiceEmailBody(shareCopyFromProps(p)))
    setEmailDraftOpen(true)
  }

  function openMailtoWithDraft() {
    const to = encodeURIComponent((p.customerEmail ?? '').trim())
    const subject = encodeURIComponent(buildStripeInvoiceEmailSubject(p.jobName))
    const body = encodeURIComponent(buildStripeInvoiceEmailBody(shareCopyFromProps(p)))
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
  }
  const url = p.hostedInvoiceUrl.trim()
  const dashUrl = `https://dashboard.stripe.com/invoices/${encodeURIComponent(p.stripeInvoiceId.trim())}`
  const pad = p.compact ? '0.35rem' : '0.5rem'
  const btnStyle: CSSProperties = {
    padding: `${pad} 0.65rem`,
    fontSize: p.compact ? '0.75rem' : '0.8125rem',
    borderRadius: 4,
    border: '1px solid #d1d5db',
    background: 'white',
    cursor: 'pointer',
    color: '#374151',
    fontWeight: 500,
  }

  const iconBtnStyle: CSSProperties = {
    padding: p.compact ? '2px 1px' : '0.4rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#2563eb',
    lineHeight: 0,
  }

  const hasEmail = Boolean((p.customerEmail ?? '').trim())
  const iconSize = p.compact ? 22 : 24

  const paymentLinkCluster = p.paymentLinkActionsAsIcons ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
      {!p.omitPaymentLinksLabel ? (
        <span style={{ color: '#374151', fontWeight: 500, marginRight: 2 }}>Payment Links:</span>
      ) : null}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: p.compact ? 0 : '0.25rem',
        }}
      >
        <button
          type="button"
          title="Copy payment link"
          aria-label="Copy payment link"
          onClick={() => void copyText(url, showToast, 'Payment link copied')}
          style={iconBtnStyle}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={iconSize} height={iconSize} aria-hidden>
            <path
              fill="currentColor"
              d="M288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448L480 448C515.3 448 544 419.3 544 384L544 183.4C544 166 536.9 149.3 524.3 137.2L466.6 81.8C454.7 70.4 438.8 64 422.3 64L288 64zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L352 496L352 512L160 512L160 256L176 256L176 192L160 192z"
            />
          </svg>
        </button>
        <button
          type="button"
          title="SMS bill draft"
          aria-label="SMS bill draft"
          onClick={openSmsBillDraft}
          style={iconBtnStyle}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={iconSize} height={iconSize} aria-hidden>
            <path
              fill="currentColor"
              d="M320 544C461.4 544 576 436.5 576 304C576 171.5 461.4 64 320 64C178.6 64 64 171.5 64 304C64 358.3 83.2 408.3 115.6 448.5L66.8 540.8C62 549.8 63.5 560.8 70.4 568.3C77.3 575.8 88.2 578.1 97.5 574.1L215.9 523.4C247.7 536.6 282.9 544 320 544zM204.8 236.8L224 236.8C232.8 236.8 240 244 240 252.8C240 261.6 232.8 268.8 224 268.8L204.8 268.8C199.5 268.8 195.2 273.1 195.2 278.4C195.2 283.7 199.5 288 204.8 288C227.8 288 246.4 306.6 246.4 329.6C246.4 352.6 227.8 371.2 204.8 371.2L179.2 371.2C170.4 371.2 163.2 364 163.2 355.2C163.2 346.4 170.4 339.2 179.2 339.2L204.8 339.2C210.1 339.2 214.4 334.9 214.4 329.6C214.4 324.3 210.1 320 204.8 320C181.8 320 163.2 301.4 163.2 278.4C163.2 255.4 181.8 236.8 204.8 236.8zM393.6 278.4C393.6 255.4 412.2 236.8 435.2 236.8L454.4 236.8C463.2 236.8 470.4 244 470.4 252.8C470.4 261.6 463.2 268.8 454.4 268.8L435.2 268.8C429.9 268.8 425.6 273.1 425.6 278.4C425.6 283.7 429.9 288 435.2 288C458.2 288 476.8 306.6 476.8 329.6C476.8 352.6 458.2 371.2 435.2 371.2L409.6 371.2C400.8 371.2 393.6 364 393.6 355.2C393.6 346.4 400.8 339.2 409.6 339.2L435.2 339.2C440.5 339.2 444.8 334.9 444.8 329.6C444.8 324.3 440.5 320 435.2 320C412.2 320 393.6 301.4 393.6 278.4zM295.3 244.6L320 285.7L344.7 244.6C348.4 238.4 355.8 235.5 362.7 237.4C369.6 239.3 374.4 245.6 374.4 252.8L374.4 355.2C374.4 364 367.2 371.2 358.4 371.2C349.6 371.2 342.4 364 342.4 355.2L342.4 310.6L333.7 325.1C330.8 329.9 325.6 332.9 320 332.9C314.4 332.9 309.2 329.9 306.3 325.1L297.6 310.6L297.6 355.2C297.6 364 290.4 371.2 281.6 371.2C272.8 371.2 265.6 364 265.6 355.2L265.6 252.8C265.6 245.6 270.4 239.3 277.3 237.4C284.2 235.5 291.6 238.4 295.3 244.6z"
            />
          </svg>
        </button>
        {hasEmail ? (
          <button
            type="button"
            title={emailLabel}
            aria-label={emailLabel}
            onClick={openEmailBillDraft}
            style={iconBtnStyle}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={iconSize} height={iconSize} aria-hidden>
              <path
                fill="currentColor"
                d="M112 128C85.5 128 64 149.5 64 176C64 191.1 71.1 205.3 83.2 214.4L291.2 370.4C308.3 383.2 331.7 383.2 348.8 370.4L556.8 214.4C568.9 205.3 576 191.1 576 176C576 149.5 554.5 128 528 128L112 128zM64 260L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 260L377.6 408.8C343.5 434.4 296.5 434.4 262.4 408.8L64 260z"
              />
            </svg>
          </button>
        ) : null}
      </span>
    </span>
  ) : (
    <>
      <button type="button" onClick={() => void copyText(url, showToast, 'Payment link copied')} style={btnStyle}>
        Copy payment link
      </button>
      <button type="button" onClick={openSmsBillDraft} style={btnStyle}>
        SMS bill draft
      </button>
      {hasEmail ? (
        <button type="button" onClick={openEmailBillDraft} style={btnStyle}>
          {emailLabel}
        </button>
      ) : null}
    </>
  )

  const unboxed = Boolean(p.unboxed)
  const inlineRow = Boolean(p.inlineRow)
  const outerStyle: CSSProperties = unboxed
    ? {
        marginTop: inlineRow ? 0 : p.omitPaymentLinksLabel ? 6 : p.compact ? 10 : 12,
        fontSize: p.compact ? '0.75rem' : '0.8125rem',
      }
    : {
        marginTop: p.compact ? 6 : 8,
        padding: p.compact ? '0.5rem' : '0.75rem',
        borderRadius: 6,
        border: '1px solid #e5e7eb',
        background: '#fafafa',
        fontSize: p.compact ? '0.75rem' : '0.8125rem',
      }

  const rowStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    alignItems: 'center',
    ...(unboxed
      ? inlineRow
        ? { justifyContent: 'flex-start' }
        : {
            justifyContent: p.omitPaymentLinksLabel ? 'flex-start' : 'center',
            width: '100%',
          }
      : {}),
  }

  const smsZ = p.smsDraftModalZIndex ?? 1300
  const emailZ = p.emailDraftModalZIndex ?? p.smsDraftModalZIndex ?? 1300
  const emailCopyText = `Subject: ${emailDraftSubject}\n\n${emailDraftBody}`

  return (
    <div style={outerStyle}>
      <SmsBillDraftModal
        open={smsDraftOpen}
        onClose={() => setSmsDraftOpen(false)}
        text={smsDraftText}
        overlayZIndex={smsZ}
        onCopy={() =>
          void copyText(smsDraftText, showToast, 'Text message draft copied — paste into SMS')
        }
      />
      <EmailBillDraftModal
        open={emailDraftOpen}
        onClose={() => setEmailDraftOpen(false)}
        subject={emailDraftSubject}
        body={emailDraftBody}
        overlayZIndex={emailZ}
        showOpenInEmailApp={hasEmail}
        onOpenMailto={openMailtoWithDraft}
        onCopy={() => void copyText(emailCopyText, showToast, 'Email draft copied')}
      />
      <div style={rowStyle}>
        {paymentLinkCluster}
        {!p.omitCustomerPayPage ? (
          <button
            type="button"
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            style={{ ...btnStyle, borderColor: '#2563eb', color: '#1d4ed8' }}
          >
            Customer pay page
          </button>
        ) : null}
        {!p.omitOpenInStripe ? (
          <button type="button" onClick={() => window.open(dashUrl, '_blank', 'noopener,noreferrer')} style={btnStyle}>
            Open in Stripe
          </button>
        ) : null}
      </div>
      {hasEmail ? null : (
        <p
          style={{
            margin: unboxed ? '0.5rem 0 0' : '0.35rem 0 0',
            fontSize: '0.75rem',
            color: '#6b7280',
            textAlign: unboxed ? 'center' : undefined,
          }}
        >
          Add a customer email on the job to use “{emailLabel}”.
        </p>
      )}
    </div>
  )
}
