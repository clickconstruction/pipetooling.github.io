import type { CSSProperties } from 'react'
import { BID_BOARD_MAP_DUE_RING_COLOR, BID_BOARD_MAP_SECTION_COLOR, type BidBoardMapPin } from '../../lib/bids/bidBoardMap'
import { bucketDueLine, type BidBoardMapRailModel, type DistanceBucketKey, type DistanceBucketVisibility } from '../../lib/bids/bidBoardMapRail'

type Props = {
  rail: BidBoardMapRailModel
  bucketsOn: DistanceBucketVisibility
  onToggleBucket: (key: DistanceBucketKey) => void
  /** A due row was tapped — select its pin and light the board row. */
  onPickPin: (pin: BidBoardMapPin) => void
  /** "Lost 71 off" when the Lost chip is off and there are lost pins. */
  lostOff: number
  /** The "N bids have no map location yet" door, or the placing line while the geocoder runs. */
  unmappedLine: string | null
  unmappedCount: number
  resolving: boolean
  onOpenFix: () => void
  isMobile: boolean
}

const H4: CSSProperties = { margin: 0, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', fontWeight: 700 }
const LINK: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-blue-500)', cursor: 'pointer', textAlign: 'left' }

/**
 * The rail beside the map (v2.3206): distance buckets that toggle pins, the
 * unsent-and-due list nearest first, the pinned total, and the address door.
 */
export function BidBoardMapRail({ rail, bucketsOn, onToggleBucket, onPickPin, lostOff, unmappedLine, unmappedCount, resolving, onOpenFix, isMobile }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: 0 }}>
      <h4 style={H4}>By distance from the office · pinned bids</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
        {rail.buckets.map((b) => {
          const on = bucketsOn[b.key]
          const dueLine = bucketDueLine(b)
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => onToggleBucket(b.key)}
              aria-pressed={on}
              title={on ? `Hide the ${b.label} pins` : `Show the ${b.label} pins`}
              style={{
                textAlign: 'left',
                border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border)'}`,
                boxShadow: on ? 'inset 0 0 0 1px var(--text-blue-500)' : undefined,
                borderRadius: 6,
                padding: '0.35rem 0.5rem',
                background: 'var(--surface)',
                color: on ? 'inherit' : 'var(--text-faint)',
                cursor: 'pointer',
                font: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                minWidth: 0,
                minHeight: isMobile ? 44 : undefined,
              }}
            >
              <span style={{ fontSize: '0.7rem', color: on ? 'var(--text-muted)' : 'var(--text-faint)', fontWeight: 600, whiteSpace: 'nowrap' }}>{b.label}</span>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: on ? 'var(--text-strong)' : 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{b.count}</span>
              <span style={{ fontSize: '0.72rem', color: on ? 'var(--text-muted)' : 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {b.valueLabel}
                {dueLine && !isMobile ? ` · ${dueLine}` : ''}
              </span>
            </button>
          )
        })}
      </div>

      {rail.due.length > 0 ? (
        <>
          <h4 style={H4}>Unsent and due · nearest first</h4>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {rail.due.map((d) => {
              const ring = d.pin.dueTone ? BID_BOARD_MAP_DUE_RING_COLOR[d.pin.dueTone] : null
              const dueColor = d.pin.dueTone === 'overdue' ? 'var(--text-red-700)' : d.pin.dueTone === 'soon' ? 'var(--text-amber-800)' : 'var(--text-muted)'
              return (
                <li key={d.pin.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => onPickPin(d.pin)}
                    title={`${d.pin.label} — show it on the map and light its row`}
                    style={{ ...LINK, color: 'inherit', display: 'grid', gridTemplateColumns: '10px minmax(0, 1fr) auto auto', gap: '0.5rem', alignItems: 'center', width: '100%', padding: '0.3rem 0.55rem', fontSize: '0.78rem', minHeight: isMobile ? 40 : undefined }}
                  >
                    <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: BID_BOARD_MAP_SECTION_COLOR[d.pin.section], boxSizing: 'border-box', border: ring ? `2px solid ${ring}` : undefined }} />
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <b style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', marginRight: '0.3rem' }}>{d.pin.numberLabel}</b>
                      {d.pin.projectName}
                    </span>
                    <span style={{ color: dueColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{d.pin.dueLabel}</span>
                    <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{d.milesLabel}</span>
                  </button>
                </li>
              )
            })}
            {rail.dueMore > 0 ? (
              <li style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>+ {rail.dueMore} more unsent with a due date</li>
            ) : null}
          </ul>
        </>
      ) : null}

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: '0.15rem' }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {rail.pinnedCount} pinned · {rail.pinnedValueLabel}
          {lostOff > 0 ? ` · Lost ${lostOff} off` : ''}
        </span>
        {resolving && unmappedCount > 0 ? (
          <span>{unmappedCount === 1 ? 'Placing 1 more bid…' : `Placing ${unmappedCount} more bids…`}</span>
        ) : unmappedLine ? (
          <button type="button" onClick={onOpenFix} style={{ ...LINK, fontSize: '0.78rem', textDecoration: 'underline', minHeight: isMobile ? 44 : undefined }} title="List these bids and type their addresses">
            {unmappedLine} · {unmappedCount === 1 ? 'add its address' : 'add their addresses'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
