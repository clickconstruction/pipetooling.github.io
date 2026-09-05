import type { CSSProperties } from 'react'
import { customerLinkUnavailableTitle } from '../../../supabase/functions/_shared/estimateLinkResend'

export type EstimateCustomerAcceptLinkButtonsProps = {
  customerAcceptUrl: string | null
  isDraft: boolean
  /** True when the row can take **Resend link** (v2.2856) — the unavailable-tooltip then points at the real recovery. */
  resendAvailable?: boolean
  onCopy: () => void
  onOpen: () => void
  style?: CSSProperties
}

const rowStyleBase: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
  alignItems: 'center',
}

export default function EstimateCustomerAcceptLinkButtons({
  customerAcceptUrl,
  isDraft,
  resendAvailable = false,
  onCopy,
  onOpen,
  style,
}: EstimateCustomerAcceptLinkButtonsProps) {
  const unavailableTitle = customerLinkUnavailableTitle(resendAvailable)
  return (
    <div style={{ ...rowStyleBase, ...style }}>
      <button
        type="button"
        onClick={onCopy}
        disabled={!customerAcceptUrl}
        aria-label={
          customerAcceptUrl
            ? 'Copy customer acceptance link'
            : isDraft
              ? 'Copy customer link (send estimate first)'
              : 'Copy customer link (unavailable in this browser)'
        }
        title={
          customerAcceptUrl
            ? 'Copy the customer acceptance link (with token) to the clipboard.'
            : isDraft
              ? 'Send the estimate to create a customer link.'
              : unavailableTitle
        }
      >
        Copy customer link
      </button>
      <button
        type="button"
        onClick={onOpen}
        disabled={!customerAcceptUrl}
        aria-label={
          customerAcceptUrl
            ? 'Open customer acceptance page in new tab'
            : isDraft
              ? 'Open customer link (send estimate first)'
              : 'Open customer link (unavailable in this browser)'
        }
        title={
          customerAcceptUrl
            ? 'Open the customer acceptance page in a new tab (same as the link you send).'
            : isDraft
              ? 'Send the estimate to create a customer link.'
              : unavailableTitle
        }
      >
        Open customer link
      </button>
    </div>
  )
}
