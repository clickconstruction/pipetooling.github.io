import type { CSSProperties, ReactNode } from 'react'
import { BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE } from './billCustomerStyles'

export type BillCustomerDisclosureProps = {
  /** The panel's id, which the press names in `aria-controls`. */
  panelId: string
  /** The title's id, which the panel names in `aria-labelledby`. */
  headingId: string
  title: string
  /** What the section holds, said on the right of the press whether it is open or closed. */
  summary: ReactNode
  open: boolean
  onToggle: () => void
  /** The gap under the press. The cards stack their disclosures tight (0); HouseCall Pro's memo stands alone. */
  toggleMarginBottom?: CSSProperties['marginBottom']
  /** The gap under the open panel. */
  panelMarginBottom?: CSSProperties['marginBottom']
  children: ReactNode
}

/**
 * One disclosure of the Bill Customer window: a press with a caret, a title and a summary, and under it the panel the
 * press opens. The panel stays in the page while closed (`hidden`), so what is typed in it is kept. The open state is
 * the caller's, since the line and memo disclosures stay open from tab to tab.
 */
export function BillCustomerDisclosure({
  panelId,
  headingId,
  title,
  summary,
  open,
  onToggle,
  toggleMarginBottom = 0,
  panelMarginBottom = 0,
  children,
}: BillCustomerDisclosureProps) {
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        style={{
          ...BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE,
          marginBottom: toggleMarginBottom,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
          <span style={{ fontSize: '0.75rem', flexShrink: 0 }} aria-hidden>
            {open ? '▼' : '\u25b6'}
          </span>
          <span
            id={headingId}
            style={{
              fontWeight: 500,
              fontSize: '0.875rem',
              color: 'var(--text-700)',
            }}
          >
            {title}
          </span>
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {summary}
        </span>
      </button>
      <div id={panelId} role="region" aria-labelledby={headingId} hidden={!open} style={{ marginBottom: panelMarginBottom }}>
        {children}
      </div>
    </>
  )
}
