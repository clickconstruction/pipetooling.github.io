import type { CSSProperties } from 'react'

export type EstimateCustomerAcceptLinkButtonsProps = {
  customerAcceptUrl: string | null
  isDraft: boolean
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
  onCopy,
  onOpen,
  style,
}: EstimateCustomerAcceptLinkButtonsProps) {
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
              : 'Customer link is not available in this browser. It appears when you send the estimate, or is restored if this browser previously saved it for this estimate.'
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
              : 'Customer link is not available in this browser. It appears when you send the estimate, or is restored if this browser previously saved it for this estimate.'
        }
      >
        Open customer link
      </button>
    </div>
  )
}
