import type { MouseEvent } from 'react'
import type { PortalLine } from '../../lib/gcMode/gcModel'
import { Chip } from './gcUi'

/**
 * GC mode design spike: the sheet numbers beside each line of a trade's bid form. A tap opens the
 * plans on that sheet. A dashed edge: matched from the line's words, not said by the office. Amber:
 * a set newer than the company's number changed it.
 */

export function SheetChip({ id, guessed, changed, onOpen }: { id: string; guessed: boolean; changed: boolean; onOpen: (sheetId: string) => void }) {
  return (
    <button
      type="button"
      title={guessed ? `Open ${id}. Matched by the line's words.` : `Open ${id}`}
      onClick={(e: MouseEvent) => {
        // The chip sits inside the line's label: open the sheet, never tick the box.
        e.preventDefault()
        e.stopPropagation()
        onOpen(id)
      }}
      style={{
        padding: '0.05rem 0.4rem',
        borderRadius: 4,
        border: `1px ${guessed ? 'dashed' : 'solid'} ${changed ? 'var(--text-amber-700)' : 'var(--border-strong)'}`,
        background: changed ? 'var(--bg-amber-100)' : 'var(--surface)',
        color: 'inherit',
        fontSize: '0.72rem',
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        cursor: 'pointer',
        lineHeight: 1.5,
      }}
    >
      {id}
    </button>
  )
}

/**
 * A line's sheets, and "changed in …" when a newer set changed one of them. A line that stands
 * for the whole trade shows no sheets until one of its trade's sheets changes, then those.
 */
export function LineSheets({ line, onOpen }: { line: PortalLine | undefined; onOpen: (sheetId: string) => void }) {
  if (!line) return null
  const shown = line.wholeTrade ? line.changed : line.sheets
  if (shown.length === 0 && line.by.length === 0) return null
  return (
    <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {shown.map((id) => (
        <SheetChip key={id} id={id} guessed={line.guessed} changed={line.changed.includes(id)} onOpen={onOpen} />
      ))}
      {line.by.length > 0 && <Chip tone="amber">changed in {line.by.join(' and ')}</Chip>}
    </span>
  )
}

/** For a number on older plans: the lines the newer sets touch, and the trade's changed sheets no line names. */
export function ChangedLines({
  trade,
  lines,
  otherSheets,
  setNames,
  onOpen,
}: {
  trade: string
  lines: PortalLine[]
  otherSheets: string[]
  setNames: string[]
  onOpen: (sheetId: string) => void
}) {
  const touched = lines.filter((l) => l.by.length > 0)
  if (touched.length === 0 && otherSheets.length === 0) return null
  return (
    <div style={{ display: 'grid', gap: '0.3rem' }}>
      {touched.length > 0 && <div>{setNames.join(' and ')} touches these lines of your number.</div>}
      {touched.map((l) => (
        <div key={l.item.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{l.item.label}</strong>
          {l.wholeTrade && <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>reads every {trade} sheet</span>}
          {l.changed.map((id) => (
            <SheetChip key={id} id={id} guessed={l.guessed} changed onOpen={onOpen} />
          ))}
        </div>
      ))}
      {otherSheets.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{touched.length > 0 ? 'Also changed' : `Changed in ${setNames.join(' and ')}`}</span>
          {otherSheets.map((id) => (
            <SheetChip key={id} id={id} guessed={false} changed onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}
