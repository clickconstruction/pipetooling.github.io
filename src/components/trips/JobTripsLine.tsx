/**
 * **Trips on this job**, the line in the Job window's Job tab (punch list #379, PR 6). The owner's example
 * is why it exists: a trip that was part of one job had been given a job of its own so it could be seen
 * alone. Here the job says its trips, and no extra job is needed.
 *
 * It draws only on a job that a trip names under *Work goes on*, for the office door, so every other Job
 * window is unchanged. It says how many trips have gone out, the newest with who went and the next one
 * planned, each by its number (*last Trip 5, Oct 23 to Nov 4*); under the sentence the job's hours stand in
 * the five figures. *last* and *next* are doors: each opens its own trip on the Development page.
 * **Open the site's trips** goes to the Development page at its Trips look. **+ Trip** opens the sheet on a new trip kept on the site with
 * this job already picked. Saving a trip changes no clock row, bill or cost.
 *
 * The reads and the sentence are `hooks/useJobTrips.ts` and `lib/trips/jobTrips.ts`; this file draws them.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import type { JobTripsState } from '../../hooks/useJobTrips'
import { JOB_TRIPS_HOURS_WORDS, JOB_TRIPS_NO_POINT_WORDS, tripHref, tripsLookHref } from '../../lib/trips/jobTrips'
import { TRIP_HOUR_BUCKET_LABEL } from '../../lib/trips/tripHours'
import { newTripRecord, type TripRecord } from '../../lib/trips/tripRecord'
import { hoursWords } from '../../lib/trips/tripsLook'
import { formatErrorMessage } from '../../utils/errorHandling'
import { capStyle, linkButtonStyle, SmallButton } from '../developments/developmentPageBits'
import { BucketDot, TRIP_BUCKET_ORDER, TripHoursBar } from './TripDayBits'
import { TripSheet, type TripSheetJob } from './TripSheet'

/** Over the Job window (1010) and its own sheets. */
const SHEET_Z_INDEX = 1100

export function JobTripsLine({
  trips,
  job,
  developmentId,
  siteName,
  todayYmd,
  onLeave,
}: {
  trips: JobTripsState
  /** This job, as the sheet names it under Work goes on. */
  job: TripSheetJob
  developmentId: string | null
  siteName: string
  todayYmd: string
  /** Closes the Job window before the page changes. */
  onLeave: () => void
}) {
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const [sheet, setSheet] = useState<TripRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const line = trips.line
  if (!line || !developmentId) return null

  const h = trips.hours
  const save = async (record: TripRecord): Promise<boolean> => {
    setBusy(true)
    try {
      await trips.save(record)
      showToast('The trip is saved.', 'success')
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, 'The trip did not save.'), 'error', 6000)
      return false
    } finally {
      setBusy(false)
    }
  }
  // *last* and *next* each open their own trip on the site's page.
  const door = (words: string, tripId: string | null, title: string | null, testId: string) =>
    tripId ? (
      <button
        type="button"
        style={{ ...linkButtonStyle(false, false), overflowWrap: 'anywhere' }}
        title={`${title ?? 'Open this trip'} on ${siteName || 'the site'}’s page`}
        onClick={() => {
          onLeave()
          navigate(tripHref(developmentId, tripId))
        }}
        data-testid={testId}
      >
        {words}
      </button>
    ) : (
      words
    )

  return (
    <div data-testid="job-trips-line" style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-subtle)', padding: '0.55rem 0.75rem', minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem 0.75rem' }}>
        <div style={{ minWidth: 0, flex: '1 1 16rem' }}>
          <div style={capStyle}>Trips on this job</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', overflowWrap: 'anywhere' }} data-testid="job-trips-words">
            {line.count ? <strong style={{ color: 'var(--text-strong)' }}>{line.count}</strong> : null}
            {line.count && (line.last || line.next) ? ' · ' : null}
            {line.last ? door(line.last, line.lastTripId, line.lastDoor, 'job-trips-last') : null}
            {line.last && line.next ? ' · ' : null}
            {line.next ? door(line.next, line.nextTripId, line.nextDoor, 'job-trips-next') : null}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 0.75rem' }}>
          <button
            type="button"
            style={{ ...linkButtonStyle(true, true), fontSize: '0.8125rem', minHeight: 30 }}
            title={`Opens ${siteName || 'the site'} at its Trips look, where every trip stands with its days`}
            onClick={() => {
              onLeave()
              navigate(tripsLookHref(developmentId))
            }}
            data-testid="job-trips-open"
          >
            Open the site’s trips
          </button>
          <SmallButton onClick={() => setSheet({ ...newTripRecord({ id: crypto.randomUUID(), developmentId }), jobIds: [job.id] })} title="Add a trip to the site with its work on this job: who went, which days, what for">
            + Trip
          </SmallButton>
        </div>
      </div>
      {h ? (
        <div style={{ marginTop: 8 }} data-testid="job-trips-hours">
          <TripHoursBar label={`Of ${hoursWords(h.all)} hours on this job, ${hoursWords(h.site)} were at the site`} parts={TRIP_BUCKET_ORDER.map((bucket) => ({ bucket, hours: h[bucket] }))} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: '0.74rem', color: 'var(--text-700)', marginTop: 6 }}>
            {TRIP_BUCKET_ORDER.map((bucket) => (
              <span key={bucket} style={{ whiteSpace: 'nowrap' }} data-testid={`job-trips-hours-${bucket}`}>
                <BucketDot bucket={bucket} />
                {TRIP_HOUR_BUCKET_LABEL[bucket]} <strong style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{hoursWords(h[bucket])} h</strong>
              </span>
            ))}
          </div>
        </div>
      ) : trips.hoursState !== 'read' ? (
        <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }} data-testid="job-trips-hours-wait">
          {JOB_TRIPS_HOURS_WORDS[trips.hoursState]}
        </p>
      ) : null}
      {trips.noSitePoint && h ? (
        <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-amber-800)' }} data-testid="job-trips-no-point">
          {JOB_TRIPS_NO_POINT_WORDS}
        </p>
      ) : null}
      {sheet ? <TripSheet key={sheet.id} record={sheet} isNew siteName={siteName || 'the site'} roster={trips.roster} jobs={[job]} todayYmd={todayYmd} busy={busy} zIndex={SHEET_Z_INDEX} onSave={save} onClose={() => setSheet(null)} /> : null}
    </div>
  )
}
