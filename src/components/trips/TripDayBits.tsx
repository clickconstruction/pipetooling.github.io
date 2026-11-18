/**
 * The small drawn pieces of a trip (punch list #379, PR 3): a day's colour by its kind, a row of day dots,
 * the painted days a tap changes, the bar of hours and the legend. One file so a kind wears one colour on
 * the band, the strip, a row, an open trip and the sheet.
 */
import type { CSSProperties } from 'react'
import { TRIP_DAY_LABEL, type TripDayKind } from '../../lib/trips/tripDays'
import { TRIP_HOUR_BUCKET_LABEL, type TripHourBucket } from '../../lib/trips/tripHours'

/** A day kind's colour. Saturated status colours, the same in light and dark. */
export const TRIP_KIND_COLOR: Readonly<Record<TripDayKind, string>> = { site: '#16a34a', road: '#2563eb', ready: '#d97706' }

/** A figure of hours and its colour: the three kinds, the hatch for no place, and the hours at home. */
export const TRIP_BUCKET_ORDER: ReadonlyArray<TripHourBucket> = ['site', 'road', 'ready', 'noPlace', 'home']

const HATCH = 'repeating-linear-gradient(45deg, var(--text-faint), var(--text-faint) 3px, transparent 3px, transparent 6px)'

export function bucketBackground(bucket: TripHourBucket): string {
  if (bucket === 'noPlace') return HATCH
  if (bucket === 'home') return '#a78bfa'
  return TRIP_KIND_COLOR[bucket]
}

const dotStyle = (bucket: TripHourBucket): CSSProperties => ({ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: bucketBackground(bucket), border: bucket === 'noPlace' ? '1px solid var(--text-faint)' : undefined, verticalAlign: -1, marginRight: 4, boxSizing: 'border-box' })

export function BucketDot({ bucket }: { bucket: TripHourBucket }) {
  return <span aria-hidden style={dotStyle(bucket)} />
}

/** The legend under a bar or a set of days. `home` adds At home for the site, which only a site's bar has. */
export function TripLegend({ home, noPlace = true }: { home?: boolean; noPlace?: boolean }) {
  const keys = TRIP_BUCKET_ORDER.filter((k) => (k === 'home' ? !!home : k === 'noPlace' ? noPlace : true))
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: '0.74rem', color: 'var(--text-700)', marginTop: 6 }} data-testid="trip-legend">
      {keys.map((k) => (
        <span key={k} style={{ whiteSpace: 'nowrap' }}>
          <BucketDot bucket={k} />
          {TRIP_HOUR_BUCKET_LABEL[k]}
        </span>
      ))}
    </div>
  )
}

/** A trip's days as a row of small marks, one a day, grey where nobody was on it. */
export function TripDayDots({ days, label }: { days: ReadonlyArray<{ ymd: string; kind: TripDayKind | null }>; label: string }) {
  return (
    <span role="img" aria-label={label} title={label} style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle', flexWrap: 'wrap' }} data-testid="trip-day-dots">
      {days.map((d) => (
        <i key={d.ymd} data-kind={d.kind ?? 'off'} style={{ display: 'block', width: 9, height: 16, borderRadius: 3, background: d.kind ? TRIP_KIND_COLOR[d.kind] : 'var(--bg-muted)' }} />
      ))}
    </span>
  )
}

/** What a day says to a screen reader and on hover: *Oct 31, At the site*. */
export function dayTitle(dayWords: string, kind: TripDayKind | null): string {
  return `${dayWords}, ${kind ? TRIP_DAY_LABEL[kind] : 'off'}`
}

/**
 * The painted days: one square a day with the day of the month on it. With `onTap` each is a button and a
 * tap turns its kind; without it they are a picture.
 */
export function TripPaintDays({ days, dayWords, onTap, testId = 'trip-paint-days' }: { days: ReadonlyArray<{ ymd: string; kind: TripDayKind | null }>; dayWords: (ymd: string) => string; onTap?: (ymd: string) => void; testId?: string }) {
  const square = (kind: TripDayKind | null): CSSProperties => ({
    width: 34,
    height: 40,
    borderRadius: 6,
    border: kind ? '1px solid transparent' : '1px dashed var(--border-strong)',
    background: kind ? TRIP_KIND_COLOR[kind] : 'var(--bg-muted)',
    color: kind ? '#fff' : 'var(--text-muted)',
    font: 'inherit',
    fontSize: '0.72rem',
    fontWeight: 600,
    display: 'grid',
    placeItems: 'center',
    padding: 0,
    flex: '0 0 auto',
  })
  return (
    <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 2 }} data-testid={testId}>
      {days.map((d) =>
        onTap ? (
          <button key={d.ymd} type="button" onClick={() => onTap(d.ymd)} aria-label={`${dayTitle(dayWords(d.ymd), d.kind)}. Tap to change.`} title={dayTitle(dayWords(d.ymd), d.kind)} data-kind={d.kind ?? 'off'} data-ymd={d.ymd} style={{ ...square(d.kind), cursor: 'pointer' }}>
            {Number(d.ymd.slice(8, 10))}
          </button>
        ) : (
          <span key={d.ymd} title={dayTitle(dayWords(d.ymd), d.kind)} data-kind={d.kind ?? 'off'} style={square(d.kind)}>
            {Number(d.ymd.slice(8, 10))}
          </span>
        ),
      )}
    </div>
  )
}

/** A bar of hours split into its figures. Nothing is drawn for a figure with no hours. */
export function TripHoursBar({ parts, label }: { parts: ReadonlyArray<{ bucket: TripHourBucket; hours: number }>; label: string }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.hours), 0)
  return (
    <div role="img" aria-label={label} title={label} style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: 'var(--bg-muted)', minWidth: 120 }} data-testid="trip-hours-bar">
      {total > 0
        ? parts
            .filter((p) => p.hours > 0)
            .map((p) => <i key={p.bucket} data-bucket={p.bucket} style={{ display: 'block', height: '100%', width: `${(p.hours / total) * 100}%`, background: bucketBackground(p.bucket) }} />)
        : null}
    </div>
  )
}
