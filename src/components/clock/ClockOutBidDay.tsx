import type { CSSProperties, ReactNode } from 'react'
import { bidDayRowLine, type BidDayList, type BidDayRow } from '../../lib/clock/bidDay'
import { formatDenverTimeOnly } from '../../utils/dateUtils'

/**
 * The bids of the day in the Clock out sheet (punch list #445, to-dos/clock-out-bids-of-the-day/mockup.html).
 *
 * The day as a strip, one colour a bid. Then two shelves. **Bids you worked on today** holds the bids the person
 * changed, each with a tick in its own colour: ticked counts for the day, a press takes it off and another puts it
 * back. **Opened, nothing changed** holds the bids that were in front with nothing changed, each an empty box that
 * a press ticks onto the list. Under them, the bids on the person's board, one press each, for a bid the app missed.
 * Every row reads the same way: the size, then the tab. Presentational: `useClockOutBidDay` holds the state.
 */

const tickPress: CSSProperties = { flex: 'none', width: 44, height: 44, margin: '-4px -8px -4px -10px', display: 'grid', placeItems: 'center', border: 0, background: 'none', padding: 0 }
const shelf: CSSProperties = { listStyle: 'none', margin: '6px 0 0', padding: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }
const head: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, fontWeight: 600 }
const sub: CSSProperties = { margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }
/** A bid the app never saw has no block on the strip, so its tick carries no colour of its own. */
const NO_BLOCK = 'var(--border-strong)'

function Tick({ row, on, verb, disabled, onPress }: { row: BidDayRow; on: boolean; verb: string; disabled: boolean; onPress: () => void }) {
  const c = row.color ?? NO_BLOCK
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={`${verb} ${row.name}`}
      title={verb}
      disabled={disabled}
      onClick={onPress}
      style={{ ...tickPress, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <span style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', borderRadius: 5, border: `2px solid ${c}`, background: on ? c : 'transparent', color: '#fff' }}>
        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ visibility: on ? 'visible' : 'hidden' }}>
          <path d="M4 10.5l4 4 8-9" />
        </svg>
      </span>
    </button>
  )
}

function Row({ row, weak, tick }: { row: BidDayRow; weak?: boolean; tick: ReactNode }) {
  const off = !weak && !row.kept
  const line = bidDayRowLine(row)
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: weak ? 'var(--bg-muted)' : 'var(--surface)', borderTop: '1px solid var(--border)', marginTop: -1 }}>
      {tick}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: off ? 500 : 600, overflowWrap: 'anywhere', textDecoration: off ? 'line-through' : 'none', color: off ? 'var(--text-muted)' : undefined }}>{row.name}</span>
        {row.jobLabel ? (
          <span title={`This bid is now job ${row.jobLabel}`} style={{ display: 'inline-block', marginLeft: 6, padding: '0 6px', borderRadius: 4, background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)', color: 'var(--text-green-700)', fontSize: '0.75rem', fontWeight: 600 }}>
            {row.jobLabel}
          </span>
        ) : null}
        <br />
        {off ? (
          <span style={{ fontSize: '0.84375rem', color: 'var(--text-700)' }}>Taken off</span>
        ) : row.size ? (
          <>
            <span style={{ fontWeight: 700 }}>{row.size}</span>
            {row.where ? <span style={{ fontSize: '0.84375rem', color: 'var(--text-700)' }}> · {row.where}</span> : null}
          </>
        ) : (
          <span style={{ fontSize: '0.84375rem', color: 'var(--text-700)' }}>{line}</span>
        )}
      </span>
    </li>
  )
}

export default function ClockOutBidDay({
  list,
  board,
  disabled = false,
  onToggle,
  onAddFromBoard,
}: {
  list: BidDayList
  board: ReadonlyArray<{ id: string; name: string }>
  disabled?: boolean
  onToggle: (bidId: string) => void
  onAddFromBoard: (bidId: string) => void
}) {
  const { strip } = list
  return (
    <div data-testid="clock-out-bid-day" style={{ marginBottom: '0.75rem' }}>
      <div>
        <div style={head}>
          <span>Your day</span>
        </div>
        <div role="img" aria-label="Your day, one block a bid" style={{ position: 'relative', height: 26, marginTop: 8, borderRadius: 6, background: 'var(--bg-200)', overflow: 'hidden' }}>
          {strip.segments.map((s, i) => (
            <i
              key={`${s.bidId}-${i}`}
              title={s.name}
              style={{ position: 'absolute', top: 0, bottom: 0, minWidth: 4, left: `${s.leftPct}%`, width: `${s.widthPct}%`, ...(s.filled ? { background: s.color } : { opacity: 0.55, boxShadow: `inset 0 0 0 2px ${s.color}` }) }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
          <span>{formatDenverTimeOnly(strip.startMs)}</span>
          <span>{formatDenverTimeOnly(strip.endMs)}</span>
        </div>
        <p style={sub}>Grey is time the app did not see.</p>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={head}>
          <span>Bids you worked on today</span>
          <span style={{ fontWeight: 700 }}>{list.keptCount}</span>
        </div>
        {list.worked.length > 0 ? (
          <>
            <ul style={shelf}>
              {list.worked.map((row) => (
                <Row key={row.bidId} row={row} tick={<Tick row={row} on={row.kept} verb={row.kept ? 'Take off' : 'Put back'} disabled={disabled} onPress={() => onToggle(row.bidId)} />} />
              ))}
            </ul>
            <p style={sub}>Read from what you opened and changed today. Sizes are rough.</p>
          </>
        ) : (
          <div style={{ marginTop: 6, padding: 14, border: '1px dashed var(--border-strong)', borderRadius: 8, background: 'var(--bg-muted)' }}>
            <strong style={{ display: 'block' }}>The app saw no bid today.</strong>
            {list.opened.length > 0 ? 'Tick a bid below to add it, or say what you did.' : 'Add the bids you worked on, or say what you did below.'}
          </div>
        )}
      </div>

      {list.opened.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <div style={head}>
            <span>Opened, nothing changed</span>
            <span style={{ fontWeight: 700 }}>{list.opened.length}</span>
          </div>
          <ul style={shelf}>
            {list.opened.map((row) => (
              <Row key={row.bidId} row={row} weak tick={<Tick row={row} on={false} verb="Add" disabled={disabled} onPress={() => onToggle(row.bidId)} />} />
            ))}
          </ul>
        </div>
      ) : null}

      {board.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <div style={head}>
            <span>Add a bid the app missed</span>
          </div>
          <p style={sub}>On your board:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {board.map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={disabled}
                onClick={() => onAddFromBoard(b.id)}
                style={{ fontFamily: 'inherit', fontSize: '0.875rem', minHeight: 44, padding: '6px 10px', borderRadius: 999, border: '1px dashed #2563eb', background: 'var(--bg-blue-tint)', color: 'var(--text-link)', cursor: disabled ? 'not-allowed' : 'pointer' }}
              >
                + {b.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
