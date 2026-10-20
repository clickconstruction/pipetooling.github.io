/**
 * GC mode, Owner Billing's O8b: the customer pays a certified GC bill by card, with a 3% credit card fee (the owner's
 * word, 2026-10-09; counsel's okay the same day). **PAY BY CARD** sits beside the bill's check chip; it opens a panel
 * under the bill that says the bill, the fee and what the card pays, then **Go to the card page** posts to
 * `gc-card-bill`, which turns the bill to a card-only Stripe bill and answers its page. The page opens in a new tab,
 * as PAY ONLINE does, and the portal reads again when they come back (the v2.2878 refresh, keyed on
 * `data-bill-card-go`). A sample token only says what would happen. The plan: to-dos/gc-mode/mockups/owner-billing-o8.md.
 * Customer-facing ⇒ single-theme light with the statement's own palette.
 */
import { useState } from 'react'
import type { PortalCardBill } from '../../lib/portal/portalPayload'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import {
  CARD_BILL_WORDS,
  openCardPage,
  withOfficeLine,
} from '../../lib/portal/portalCardBill'
import {
  CARD,
  COPPER,
  HAIR,
  INK,
  MUTED,
  PAPER_RED,
} from '../../lib/portal/portalTheme'

/** The press, beside the bill's check chip. */
export function PortalCardBillPress({
  open,
  onOpen,
}: {
  open: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      data-screen-only
      data-bill-card
      aria-expanded={open}
      onClick={onOpen}
      style={{
        background: CARD,
        color: INK,
        border: `1px solid ${INK}`,
        borderRadius: 0,
        padding: '6px 12px',
        fontSize: 12.5,
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {CARD_BILL_WORDS.press}
    </button>
  )
}

type Ui =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sample' }
  | { kind: 'error'; text: string }

/** The panel under the bill: the bill, the fee, what the card pays, and the way back to a check. */
export function PortalCardBillPanel({
  token,
  card,
  formatUsd,
  phone,
  onClose,
}: {
  token: string
  card: PortalCardBill
  formatUsd: (n: number) => string
  phone: string | null
  onClose: () => void
}) {
  const [ui, setUi] = useState<Ui>({ kind: 'idle' })
  const go = async () => {
    if (sampleStateFromToken(token)) {
      setUi({ kind: 'sample' })
      return
    }
    // Opened now, while the press is the browser's own gesture, so no popup blocker stops it; pointed at the card
    // page once it is made.
    const tab =
      typeof window.open === 'function' ? window.open('', '_blank') : null
    setUi({ kind: 'sending' })
    const r = await openCardPage(token, card.invoiceId)
    if (r.ok) {
      if (tab) {
        tab.opener = null
        tab.location.href = r.url
      } else {
        window.location.assign(r.url)
      }
      setUi({ kind: 'idle' })
      onClose()
      return
    }
    tab?.close()
    setUi({ kind: 'error', text: withOfficeLine(r.text, phone) })
  }
  return (
    <div
      data-screen-only
      data-bill-card-panel
      role="region"
      aria-label={CARD_BILL_WORDS.heading}
      style={{
        margin: '0 0 10px 10px',
        background: CARD,
        border: `1px solid ${HAIR}`,
        padding: '12px 14px',
        display: 'grid',
        gap: 6,
        fontSize: 13.5,
        color: INK,
      }}
    >
      <div style={{ fontWeight: 700 }}>{CARD_BILL_WORDS.heading}</div>
      <div>{CARD_BILL_WORDS.bill(formatUsd(card.base))}</div>
      <div>{CARD_BILL_WORDS.fee(formatUsd(card.fee))}</div>
      <div style={{ fontWeight: 600 }}>
        {CARD_BILL_WORDS.total(formatUsd(card.total))}
      </div>
      <div style={{ color: MUTED }}>{CARD_BILL_WORDS.cardsOnly}</div>
      <div style={{ color: MUTED }}>{CARD_BILL_WORDS.check}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <button
          type="button"
          data-bill-card-go
          disabled={ui.kind === 'sending'}
          onClick={() => void go()}
          style={{
            background: COPPER,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '0.5rem 0.95rem',
            fontSize: 13,
            fontWeight: 700,
            cursor: ui.kind === 'sending' ? 'wait' : 'pointer',
            minHeight: 40,
          }}
        >
          {ui.kind === 'sending' ? '…' : CARD_BILL_WORDS.go}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: CARD,
            color: INK,
            border: `1px solid ${HAIR}`,
            borderRadius: 6,
            padding: '0.5rem 0.95rem',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 40,
          }}
        >
          {CARD_BILL_WORDS.close}
        </button>
      </div>
      {ui.kind === 'sample' && (
        <div style={{ color: MUTED }}>{CARD_BILL_WORDS.sample}</div>
      )}
      {ui.kind === 'error' && (
        <div role="alert" style={{ color: PAPER_RED }}>
          {ui.text}
        </div>
      )}
    </div>
  )
}
