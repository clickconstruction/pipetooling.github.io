/**
 * What a clock line wears on a job whose site has trips (punch list #379, PR 6): a small tag in the kind's
 * colour for a line by a person on one of their trip days, **TRIP · AT THE SITE**, **TRIP · ON THE ROAD**
 * or **TRIP · GETTING READY**; a grey tag, **TRIP · NO PLACE ON THE PUNCH**, for a day whose punches carry
 * no place; and a quiet chip, *at home for the site*, for a line by a person on no trip that day. Which one
 * is `clockTripTag` in `lib/trips/jobTrips.ts`, read from the person's whole day, so every punch of a day
 * wears one tag; this file only draws it. A tag is a reading: it changes no clock row.
 */
import type { CSSProperties } from 'react'
import type { ClockTripTag } from '../../lib/trips/jobTrips'
import { BucketDot, TRIP_KIND_COLOR } from './TripDayBits'

const TAG_TITLE: Readonly<Record<ClockTripTag['bucket'], string>> = {
  site: 'This person was on a trip that day, with a punch at the site.',
  road: 'This person was on a trip that day, on the road or away from the site.',
  ready: 'This person was on a trip that day, getting ready for it.',
  noPlace: 'This person was on a trip that day. Their punches that day carry no place, so they do not say where.',
  home: 'This person was on no trip that day. The hours are for the site, from home.',
}

const base: CSSProperties = { display: 'inline-block', whiteSpace: 'nowrap', marginLeft: '0.4rem', verticalAlign: 'middle', lineHeight: 1.5 }

export function TripClockTag({ tag }: { tag: ClockTripTag }) {
  if (tag.quiet) {
    return (
      <span data-testid="trip-clock-tag" data-bucket={tag.bucket} title={TAG_TITLE[tag.bucket]} style={{ ...base, fontSize: '0.7rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 999, padding: '0 0.4rem' }}>
        <BucketDot bucket="home" />
        {tag.words}
      </span>
    )
  }
  // A trip day's own kind wears its colour; a row with no place is grey, since it does not say where.
  const kind = tag.bucket === 'site' || tag.bucket === 'road' || tag.bucket === 'ready' ? tag.bucket : null
  return (
    <span
      data-testid="trip-clock-tag"
      data-bucket={tag.bucket}
      title={TAG_TITLE[tag.bucket]}
      style={{
        ...base,
        fontSize: '0.625rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        borderRadius: 4,
        padding: '0 0.3rem',
        color: kind ? '#fff' : 'var(--text-700)',
        background: kind ? TRIP_KIND_COLOR[kind] : 'var(--bg-muted)',
        border: kind ? '1px solid transparent' : '1px solid var(--border-strong)',
      }}
    >
      {tag.words}
    </span>
  )
}
