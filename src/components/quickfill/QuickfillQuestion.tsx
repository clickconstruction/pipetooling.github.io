/**
 * A station's question with its ? (punch list #187, PR 5): the banner line Quickfill has drawn since
 * v2.2189, now with the ? at its end and the station's card under it. One component for the Page view
 * and the Roller, so both read the same. Words: `lib/quickfill/stationLegend.ts`.
 */
import { useState, type CSSProperties } from 'react'
import { LegendButton } from '../help/LegendButton'
import { DeskLegendCard } from '../help/LegendCard'
import { STATION_LEGEND_PRESSED_KEY, stationLegend } from '../../lib/quickfill/stationLegend'

export function QuickfillQuestion({ sectionId, text, style, phone = false }: { sectionId: string; text: string; style?: CSSProperties; phone?: boolean }) {
  const [open, setOpen] = useState(false)
  const legend = stationLegend(sectionId)
  return (
    <>
      <div role="note" style={{ ...style, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ flex: 1, minWidth: 0 }}>{text}</span>
        <LegendButton legend={legend} pressedKey={STATION_LEGEND_PRESSED_KEY} open={open} onToggle={setOpen} />
      </div>
      {open ? <DeskLegendCard legend={legend} phone={phone} onClose={() => setOpen(false)} style={{ marginBottom: '0.5rem' }} /> : null}
    </>
  )
}
