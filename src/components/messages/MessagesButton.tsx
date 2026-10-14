/**
 * Residential R2, PR 3b: the speech bubble beside a customer's name (Customers, the customer's page, Jobs' rows and the
 * job window, Estimates). A press opens their thread over the Messages page: `contact_for_customer` finds the
 * customer's own contact, or makes it with the number and address on file, then the page opens at `?thread=`. The
 * office team only (`canOpenMessages`); anyone else, or a screen with no sign-in, draws nothing. The name's own press
 * stays as it was. `onOpen` runs before the page changes, so a window the button sits in can close first.
 */
import { useState, type CSSProperties, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useOptionalAuth } from '../../hooks/useAuth'
import { canOpenMessages } from '../../lib/gc/access'
import { messagesButtonLabel, messagesThreadHref } from '../../lib/messages/customerThread'
import { contactForCustomer } from '../../lib/messages/messagesIo'
import { formatErrorMessage } from '../../utils/errorHandling'

/** The smallest box a press may have, each way (WCAG 2.5.8): the bubble's own 15 px plus its padding is 19. */
export const MESSAGES_BUTTON_MIN_HIT = 24

export interface MessagesButtonProps {
  customerId: string
  customerName: string | null | undefined
  /** The bubble's size in pixels. */
  size?: number
  /** Before the page changes: a window the button sits in closes. */
  onOpen?: () => void
  /** Laid over the bubble's own look: a phone row's tile, as its ☎ and ✉ beside it. */
  style?: CSSProperties
}

export function MessagesButton(props: MessagesButtonProps) {
  const auth = useOptionalAuth()
  if (!canOpenMessages(auth?.role)) return null
  return <MessagesButtonShown {...props} />
}

function MessagesButtonShown({ customerId, customerName, size = 15, onOpen, style }: MessagesButtonProps) {
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  const label = messagesButtonLabel(customerName)
  // On a list the box grows to the minimum and a negative margin gives the room back, so the row keeps its height and
  // the bubble keeps its place. A caller's own look (the phone row's tile) sizes itself.
  const slack = style ? 0 : Math.max(0, MESSAGES_BUTTON_MIN_HIT - (size + 4)) / 2

  const open = async (e: MouseEvent) => {
    // The button sits inside rows and names that have presses of their own.
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const contactId = await contactForCustomer(customerId)
      onOpen?.()
      navigate(messagesThreadHref(contactId))
    } catch (err) {
      showToast(formatErrorMessage(err, 'Their messages did not open.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => void open(e)}
      disabled={busy}
      title={label}
      aria-label={label}
      data-messages-button={customerId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        boxSizing: 'border-box',
        minWidth: MESSAGES_BUTTON_MIN_HIT,
        minHeight: MESSAGES_BUTTON_MIN_HIT,
        ...(slack ? { margin: -slack } : {}),
        border: 'none',
        background: 'none',
        color: 'var(--text-link)',
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.5 : 1,
        flexShrink: 0,
        lineHeight: 0,
        ...style,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}
