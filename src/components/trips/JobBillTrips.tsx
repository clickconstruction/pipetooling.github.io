/**
 * **Extra trips not on a bill**, the strip under a job's Line Items on the Bill tab. The office makes a bill in the
 * Job window, so an Extra trip that nothing has billed is shown there: each with **Put on a bill**, which opens the
 * same small window the trip's own press opens on its site's page, with this job already chosen. **+ Trip** keeps
 * a new trip on the site with its work on this job and its billing on Extra.
 *
 * It draws for the roles that read every trip, on a job that is in a development. Which trips it lists is
 * `lib/trips/jobBillTrips.ts`; the reads are `hooks/useJobBillTrips.ts`; this file draws them. The press adds one
 * line and nothing else: the form is told the line's id, reads its lines again and ticks it for Bill the 1 picked.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobBillTrips, type JobBillTripsIo } from '../../hooks/useJobBillTrips'
import { JOB_BILL_TRIPS_FAILED_WORDS, JOB_BILL_TRIPS_LABEL, JOB_BILL_TRIPS_NONE_WORDS, JOB_BILL_TRIPS_NOTE, jobBillTrips, jobBillTripsReady } from '../../lib/trips/jobBillTrips'
import { TRIP_PUT_ON_BILL_LABEL, tripAlreadyOnLinesWords, tripOnLinesWords, type TripBillJob, type TripBillLineReply } from '../../lib/trips/tripBillLine'
import { putTripOnJobLine, TripBillLineRefusal, type TripBillLinePress } from '../../lib/trips/tripBillLineIo'
import { newTripRecord, type TripRecord } from '../../lib/trips/tripRecord'
import { formatErrorMessage } from '../../utils/errorHandling'
import { capStyle, SmallButton } from '../developments/developmentPageBits'
import { TripBillLineWindow } from './TripBillLineWindow'
import { TripSheet } from './TripSheet'

/** Over the Job window (1010) and its own sheets. */
const WINDOW_Z_INDEX = 1100

export function JobBillTrips({
  job,
  developmentId,
  siteName,
  role,
  todayYmd,
  onLineAdded,
  linesSaved,
  io,
  putOnLine = putTripOnJobLine,
}: {
  /** This job, as the windows name it. */
  job: TripBillJob
  developmentId: string
  siteName: string
  role: string | null | undefined
  todayYmd: string
  /** Told the new line's id once it is on the job, so the form reads its lines again and ticks it. */
  onLineAdded: (fixtureId: string) => void | Promise<void>
  /** Where the form's save of its lines stands. Each time it turns to `saved` the trips are read again, so a trip whose line was just removed is offered again. */
  linesSaved?: string
  /** The reads and the trip's save. Injectable for tests. */
  io?: JobBillTripsIo
  /** The press and its dry run. Injectable for tests. */
  putOnLine?: (press: TripBillLinePress) => Promise<TripBillLineReply>
}) {
  const { showToast } = useToastContext()
  const trips = useJobBillTrips({ developmentId, enabled: true, io })
  const [billing, setBilling] = useState<TripRecord | null>(null)
  const [sheet, setSheet] = useState<TripRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const jobs = useMemo(() => [job], [job])
  const rows = useMemo(() => (trips.records ? jobBillTrips({ records: trips.records, jobId: job.id, lines: trips.lines, role, todayYmd }) : []), [trips.records, trips.lines, job.id, role, todayYmd])

  // The form saved its lines: a line removed there frees its trip, and one tied elsewhere takes it off this list.
  const reload = trips.reload
  const lastSaved = useRef(linesSaved)
  useEffect(() => {
    if (linesSaved === lastSaved.current) return
    lastSaved.current = linesSaved
    if (linesSaved === 'saved') reload()
  }, [linesSaved, reload])

  // The sheet's Who went reads the roster, which nothing has asked for until a trip is being made.
  const askRoster = trips.askRoster
  useEffect(() => {
    if (sheet) askRoster()
  }, [sheet, askRoster])

  // Nothing is drawn until the trips are read, so the strip never says Nothing waiting and then lists a trip.
  if (!trips.records && !trips.failed) return null

  const add = async (press: Omit<TripBillLinePress, 'dryRun'>): Promise<boolean> => {
    const short = rows.find((r) => r.id === press.tripId)?.short ?? 'The trip'
    setBusy(true)
    try {
      const reply = await putOnLine({ ...press, dryRun: false })
      trips.reload()
      if (reply.duplicate) showToast(tripAlreadyOnLinesWords(short, job), 'info', 6000)
      else showToast(tripOnLinesWords(short, job), 'success')
      if (reply.fixtureId) await onLineAdded(reply.fixtureId)
      return true
    } catch (e) {
      showToast(e instanceof TripBillLineRefusal ? e.message : formatErrorMessage(e, 'The line was not added.'), 'error', 8000)
      return false
    } finally {
      setBusy(false)
    }
  }
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
  const ready = jobBillTripsReady(rows)

  return (
    <div data-testid="job-bill-trips" style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-subtle)', padding: '0.55rem 0.75rem', margin: '0.6rem 0 0', minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem 0.75rem' }}>
        <div style={capStyle} data-testid="job-bill-trips-head">
          {JOB_BILL_TRIPS_LABEL}
          {ready > 0 ? ` · ${ready}` : ''}
        </div>
        <SmallButton onClick={() => setSheet({ ...newTripRecord({ id: crypto.randomUUID(), developmentId }), jobIds: [job.id], billing: 'extra' })} disabled={busy} title={`Keep a trip to ${siteName || 'the site'} with its work on this job, marked Extra: who went, which days, what for`}>
          + Trip
        </SmallButton>
      </div>
      {trips.failed ? (
        <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }} data-testid="job-bill-trips-failed">
          {JOB_BILL_TRIPS_FAILED_WORDS}
        </p>
      ) : rows.length === 0 ? (
        <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="job-bill-trips-none">
          {JOB_BILL_TRIPS_NONE_WORDS}
        </p>
      ) : (
        <>
          <div style={{ marginTop: 6 }}>
            {rows.map((row, i) => (
              <div key={row.id} data-testid="job-bill-trip" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem 0.75rem', padding: '0.4rem 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <div style={{ minWidth: 0, flex: '1 1 16rem', fontSize: '0.875rem' }}>
                  <strong style={{ color: 'var(--text-strong)' }}>{row.name}</strong> <span style={{ color: 'var(--text-700)' }}>· {row.why}</span>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
                    {[row.who || null, row.state, row.namesNoJob ? 'names no job yet' : null].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {row.held ? (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} data-testid="job-bill-trip-held">
                    {row.held}
                  </span>
                ) : (
                  <span data-testid="job-bill-trip-press">
                    <SmallButton onClick={() => setBilling(row.record)} disabled={busy} title={row.namesNoJob ? 'Add this trip to this job’s lines, with an amount. The job joins the trip’s jobs. A bill takes the line later.' : 'Add this trip to this job’s lines, with an amount. A bill takes the line later.'}>
                      {TRIP_PUT_ON_BILL_LABEL}
                    </SmallButton>
                  </span>
                )}
              </div>
            ))}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{JOB_BILL_TRIPS_NOTE}</p>
        </>
      )}
      {billing ? <TripBillLineWindow key={billing.id} record={billing} siteName={siteName} jobs={jobs} todayYmd={todayYmd} busy={busy} zIndex={WINDOW_Z_INDEX} preview={putOnLine} onAdd={add} onClose={() => setBilling(null)} /> : null}
      {sheet ? <TripSheet key={sheet.id} record={sheet} isNew siteName={siteName || 'the site'} roster={trips.roster} jobs={jobs} todayYmd={todayYmd} busy={busy} zIndex={WINDOW_Z_INDEX} onSave={save} onClose={() => setSheet(null)} /> : null}
    </div>
  )
}
