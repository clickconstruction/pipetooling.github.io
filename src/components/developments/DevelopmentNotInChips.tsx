/**
 * The *not in it* line's chips with their cards (punch list #208, design spike; the owner's pick A of
 * `not-in-hover-mockup.html`: *hover over 21 jobs and 13 bids and see the details*). Rest on a chip
 * and the card its tile would drop, drops under it: the pieces at the address grouped by stage or
 * status, each a door, the page's own door in the foot; a press pins it; on a phone the press opens
 * it as a sheet at the end of the line. The mechanics are the tiles' (`useHoverCards`), the words
 * `buildAtAddressCard`'s, the shape `CountCardBody`.
 */
import type { AtAddressKind, CountCard, CountDoor, CountFootDoor, CountPress } from '../../lib/developments/countCards'
import { CountCardBody } from './DevelopmentCounts'
import { useHoverCards } from './useHoverCards'

export type NotInChip = { key: AtAddressKind; label: string; card: CountCard }

export function DevelopmentNotInChips({ chips, phone, onRow, onFoot, onPress }: { chips: NotInChip[]; phone: boolean; onRow: (door: CountDoor) => void; onFoot: (door: CountFootDoor) => void; onPress: (action: CountPress) => void }) {
  const h = useHoverCards<AtAddressKind>(phone)
  const openChip = chips.find((c) => c.key === h.open) ?? null
  const body = (card: CountCard, sheet: boolean) => <CountCardBody card={card} sheet={sheet} onRow={(d) => h.act(() => onRow(d))} onFoot={(d) => h.act(() => onFoot(d))} onPress={(a) => h.act(() => onPress(a))} onClose={h.close} />
  // `display: contents`: the chips and the phone's sheet are the line's own flex items, the sheet last by its order.
  return (
    <div ref={h.wrapRef} style={{ display: 'contents' }} data-testid="not-in-it-chips">
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {chips.map((c) => {
          const isOpen = h.open === c.key
          return (
            <span key={c.key} style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => h.hover(c.key)} onMouseLeave={h.leave}>
              <button
                type="button"
                className="developmentCountChip"
                data-open={isOpen ? '1' : undefined}
                data-pinned={isOpen && h.pinned ? '1' : undefined}
                data-testid={`not-in-it-chip-${c.key}`}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                title={phone ? 'Tap for the detail' : 'Rest here for the detail; press to keep it open'}
                onClick={() => h.press(c.key)}
                onFocus={() => h.hover(c.key)}
              >
                {c.label}
              </button>
              {isOpen && !phone ? (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 520, maxWidth: 'calc(100vw - 32px)', zIndex: 30 }} onMouseEnter={h.stay} onMouseLeave={h.leave}>
                  {body(c.card, false)}
                </div>
              ) : null}
            </span>
          )
        })}
      </span>
      {openChip && phone ? (
        <div style={{ flexBasis: '100%', order: 99 }} data-testid="not-in-it-sheet">
          {body(openChip.card, true)}
        </div>
      ) : null}
    </div>
  )
}
