/**
 * One-line signpost atop each of the three PO-named Materials tabs (v2.2903,
 * journey-map B14 / J29-F1). "PO" means two things on this page — the counter
 * **code** the office mints (PO Generator, Dispatch Mode → PO) and the
 * **line-item** material list (PO Builder → Purchase Orders, which also feeds
 * a bid's material cost estimate). The tabs stay; the line says which is which.
 */

import type { ReactNode } from 'react'

export type MaterialsPoLane = 'po-generator' | 'assemblies-po' | 'purchase-orders'

export type MaterialsPoLaneSignpostProps = {
  lane: MaterialsPoLane
  /** Switches to PO Generator; omit for roles that cannot open it (estimators). */
  onOpenPoGenerator?: () => void
}

const linkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--text-blue-500)',
  textDecoration: 'underline',
  cursor: 'pointer',
} as const

export function MaterialsPoLaneSignpost({ lane, onOpenPoGenerator }: MaterialsPoLaneSignpostProps) {
  const poGenerator = onOpenPoGenerator ? (
    <button type="button" onClick={onOpenPoGenerator} style={linkStyle}>
      PO Generator
    </button>
  ) : (
    <strong>PO Generator</strong>
  )
  let body: ReactNode
  if (lane === 'po-generator') {
    body = (
      <>
        <strong>Counter PO numbers start here</strong> — the code you read to the supply house goes on the job's
        account. <strong>PO Builder</strong> and <strong>Purchase Orders</strong> are the line-item lane (material
        lists priced from the Parts Book); they don't mint codes.
      </>
    )
  } else if (lane === 'assemblies-po') {
    body = (
      <>
        <strong>PO Builder prices a line-item material list</strong> from assemblies and Parts Book prices; it
        doesn't mint counter codes. Need a PO number for the supply house? Use {poGenerator}.
      </>
    )
  } else {
    body = (
      <>
        <strong>Line-item POs</strong> from PO Builder and bid takeoffs (a takeoff's POs feed that bid's material
        cost estimate). Counter PO numbers live in {poGenerator}.
      </>
    )
  }
  return (
    <p
      data-testid={`po-lane-signpost-${lane}`}
      style={{
        margin: '0 0 1rem',
        padding: '0.5rem 0.75rem',
        fontSize: '0.8125rem',
        color: 'var(--text-muted)',
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
        borderRadius: 6,
      }}
    >
      {body}
    </p>
  )
}
