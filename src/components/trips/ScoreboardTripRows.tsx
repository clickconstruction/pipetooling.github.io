/**
 * The Scoreboard's rows when it is cut by trip (punch list #379, PR 8): a row for each trip that has gone
 * out, newest first, and a last row At home for the site. The Scoreboard (`DevelopmentScoreboard.tsx`)
 * keeps its head, its tiles and its foot and mounts these in place of its job rows; the rows themselves are
 * `lib/trips/tripScoreboardCut.ts`. A measure that cannot be cut by trip is an empty cell, as the cut by
 * person leaves the cells a person does not fill. The rows do not fold: a trip has no rows under it.
 * A trip's row leads with its number, **Trip 5**, and the name is a door: it opens that trip in the Trips look.
 */
import type { CSSProperties } from 'react'
import { scoreboardCellStands, scoreboardCellWords, type ScoreboardColumn, type ScoreboardColumnKey, type ScoreboardReads } from '../../lib/developments/scoreboard'
import { SCOREBOARD_TRIP_LEAD_NOTE, SCOREBOARD_TRIP_NOTE, type ScoreboardTripCut, type ScoreboardTripRow } from '../../lib/trips/tripScoreboardCut'

type Fmt = (key: ScoreboardColumnKey, value: number) => string

const cellStyle: CSSProperties = { padding: '0 6px', height: 30, borderBottom: '1px solid var(--border)', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' }
const capWords: CSSProperties = { display: 'block', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)' }

/** What a cell says: the figure, or where its read stands; null for a measure the row does not fill. */
function cellWords(row: ScoreboardTripRow, key: ScoreboardColumnKey, reads: ScoreboardReads, fmt: Fmt): { words: string; title: string | undefined; faint: boolean } | null {
  const value = row.m[key]
  if (value == null) return null
  // A trip's cost is its wages and its charges: it stands on the clock and the cost rows, never on the overhead read.
  const stands = key === 'cost' ? 'stands' : scoreboardCellStands(key, reads)
  if (stands === 'off') return null
  if (stands === 'reading') return { words: '…', title: 'Still reading', faint: true }
  if (stands === 'failed') return { words: 'not read', title: 'A source would not read', faint: true }
  const words = fmt(key, value)
  const exact = scoreboardCellWords(key, value)
  const about = key === 'days' ? row.daysTitle : key === 'parts' ? row.partsTitle : null
  return { words, title: [words !== exact ? exact : null, about].filter(Boolean).join(' · ') || undefined, faint: false }
}

/** A trip's name as a door to the trip; the last row's name, and a name with no door to open, is plain words. */
function TripDoor({ row, onOpenTrip }: { row: ScoreboardTripRow; onOpenTrip?: (tripId: string) => void }) {
  const tripId = row.tripId
  if (!tripId || !onOpenTrip) return <span style={{ fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap', fontStyle: row.home ? 'italic' : undefined }}>{row.name}</span>
  return (
    <button type="button" onClick={() => onOpenTrip(tripId)} title={`${row.door ?? 'Open this trip'} in the Trips look`} data-testid={`scoreboard-trip-door-${row.key}`} style={{ border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'left' }}>
      {row.name}
    </button>
  )
}

function TripName({ row, onOpenTrip }: { row: ScoreboardTripRow; onOpenTrip?: (tripId: string) => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, maxWidth: '100%', minWidth: 0 }}>
      <TripDoor row={row} onOpenTrip={onOpenTrip} />
      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={row.kit}>
        {row.kit}
      </span>
    </span>
  )
}

/** The desk's rows, inside the Scoreboard's own table body. */
export function ScoreboardTripRows({ cut, columns, reads, fmt, narrow, onOpenTrip }: { cut: ScoreboardTripCut; columns: ReadonlyArray<ScoreboardColumn>; reads: ScoreboardReads; fmt: Fmt; narrow: boolean; /** Opens a trip in the Trips look, from its name. */ onOpenTrip?: (tripId: string) => void }) {
  if (cut.pending)
    return (
      <tr data-testid="scoreboard-trip-pending">
        <td colSpan={columns.length + 1} style={{ ...cellStyle, textAlign: 'left', paddingLeft: 10, whiteSpace: 'normal', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {cut.pending}
        </td>
      </tr>
    )
  return (
    <>
      {cut.rows.map((row) => (
        <tr key={row.key} data-testid={`scoreboard-trip-${row.key}`} style={{ background: row.home ? 'var(--bg-subtle)' : undefined }}>
          <td style={{ ...cellStyle, textAlign: 'left', paddingLeft: 10, overflow: 'hidden', fontVariantNumeric: undefined }}>
            <TripName row={row} onOpenTrip={onOpenTrip} />
          </td>
          {columns.map((c) => {
            const cell = cellWords(row, c.key, reads, fmt)
            const style: CSSProperties = { ...cellStyle, borderLeft: c.key === 'earned' ? '1px solid var(--border)' : undefined, ...(narrow ? { padding: '0 4px' } : null) }
            if (!cell) return <td key={c.key} style={style} data-testid={`scoreboard-trip-${row.key}-${c.key}`} />
            return (
              <td key={c.key} style={{ ...style, color: cell.faint ? 'var(--text-faint)' : undefined, fontWeight: c.key === 'cost' && !cell.faint ? 700 : undefined }} title={cell.title} data-testid={`scoreboard-trip-${row.key}-${c.key}`}>
                {cell.words}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

/** The phone's cards: a trip is a card with the three figures that say it. */
export function ScoreboardTripCards({ cut, columns, reads, onOpenTrip }: { cut: ScoreboardTripCut; columns: ReadonlyArray<ScoreboardColumn>; reads: ScoreboardReads; onOpenTrip?: (tripId: string) => void }) {
  if (cut.pending)
    return (
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '4px 2px' }} data-testid="scoreboard-trip-pending">
        {cut.pending}
      </div>
    )
  const seesCosts = columns.some((c) => c.key === 'cost')
  const keys: ScoreboardColumnKey[] = seesCosts ? ['hours', 'labor', 'cost'] : ['hours', 'days']
  const shown = keys.map((k) => columns.find((c) => c.key === k)).filter((c): c is ScoreboardColumn => !!c)
  return (
    <>
      {cut.rows.map((row) => (
        <div key={row.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: row.home ? 'var(--bg-subtle)' : 'var(--surface)' }} data-testid={`scoreboard-trip-${row.key}`}>
          <div>
            <TripDoor row={row} onOpenTrip={onOpenTrip} />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.kit}</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`, gap: 4, marginTop: 8 }}>
            {shown.map((c) => {
              const cell = cellWords(row, c.key, reads, scoreboardCellWords)
              return (
                <div key={c.key} style={{ padding: '5px 6px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)' }} title={cell?.title}>
                  <span style={capWords}>{c.label}</span>
                  <b style={{ display: 'block', fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem', color: cell && !cell.faint ? 'var(--text-strong)' : 'var(--text-faint)' }} data-testid={`scoreboard-trip-${row.key}-${c.key}`}>
                    {cell ? cell.words : '—'}
                  </b>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

/** The line under the board that says what a trip's row holds and what it leaves on the last row. */
export function ScoreboardTripNote({ seesCosts, phone }: { seesCosts: boolean; phone: boolean }) {
  return (
    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: phone ? '0 2px' : '6px 0 0' }} data-testid="scoreboard-trip-note">
      {seesCosts ? SCOREBOARD_TRIP_NOTE : SCOREBOARD_TRIP_LEAD_NOTE}
    </div>
  )
}
