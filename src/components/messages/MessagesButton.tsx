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
import type { BoardDotHover } from '../../lib/flows/stageSends'
import { canOpenMessages } from '../../lib/gc/access'
import { boardDotTitle } from '../../lib/messages/boardDots'
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
  /**
   * The Pipeline's rows (v2.5626, punch list #123): the press opens the customer's door over the board, not the Messages
   * page, so the board stays where it was. Given, the button reads nothing and goes nowhere itself.
   */
  onPressInstead?: () => void
  /**
   * The waiting dot (v2.5632): the customer waits in Follow up's Needs a reply with their newest line on this job. The
   * bubble draws a dot at its corner and its hover says who, how, when, their first line and that nobody has answered
   * (`boardDotTitle`). Null or absent draws none.
   */
  dot?: BoardDotHover | null
}

export function MessagesButton(props: MessagesButtonProps) {
  const auth = useOptionalAuth()
  if (!canOpenMessages(auth?.role)) return null
  return <MessagesButtonShown {...props} />
}

function MessagesButtonShown({ customerId, customerName, size = 15, onOpen, style, onPressInstead, dot }: MessagesButtonProps) {
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  const label = dot ? `${messagesButtonLabel(customerName)} · ${boardDotTitle(dot)}` : messagesButtonLabel(customerName)
  // On a list the box grows to the minimum and a negative margin gives the room back, so the row keeps its height and
  // the bubble keeps its place. A caller's own look (the phone row's tile) sizes itself.
  const slack = style ? 0 : Math.max(0, MESSAGES_BUTTON_MIN_HIT - (size + 4)) / 2

  const open = async (e: MouseEvent) => {
    // The button sits inside rows and names that have presses of their own.
    e.preventDefault()
    e.stopPropagation()
    if (onPressInstead) {
      onPressInstead()
      return
    }
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
        position: 'relative',
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
      {dot ? (
        <span
          aria-hidden
          data-messages-dot
          style={{ position: 'absolute', top: 1, right: 1, width: 8, height: 8, borderRadius: 999, background: 'var(--text-orange-700)', boxShadow: '0 0 0 1.5px var(--surface)' }}
        />
      ) : null}
    </button>
  )
}
