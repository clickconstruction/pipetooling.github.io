/**
 * The Trips look's card on the Development page (punch list #379, PR 3): it lays the site's hours over the
 * kept trips, draws the look, and holds the sheet and the delete. The page hands it the trips it already
 * read (`useSiteTrips`) and the clock's hours it already reads for the Scoreboard (`useSiteLabor`), so the
 * page itself only mounts this.
 *
 * It is mounted for the office door whether or not the look shows, since the site's first trip is added
 * from the head of the page: `addSignal` opens the sheet. The card is drawn only when the look shows.
 * Saving or deleting a trip changes no clock row, bill or cost. A delete asks once, by name, and can be
 * undone for a minute, which saves the same trip again under its own id.
 *
 * PR 5: the card also finds the runs of punches at the site that no trip covers (`lib/trips/tripOffers.ts`)
 * and hands them to the look as **Looks like a trip**. **Make it a trip** opens the sheet on a new trip
 * filled from the punches, and nothing is saved until Save. **Not a trip** keeps one row a person and can
 * be undone for a minute. It counts **What shows it** for each trip (`lib/trips/tripEvidence.ts`) from the
 * punches it holds and the days of the page's History lines.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import type { SiteTripsState } from '../../hooks/useSiteTrips'
import type { SiteLaborRead } from '../../lib/developments/siteLabor'
import { tripEvidence, type TripEvidence } from '../../lib/trips/tripEvidence'
import type { TripSuggestion } from '../../lib/trips/tripFinder'
import { placesByPersonDay, tripHourRowsFromLabor } from '../../lib/trips/tripHourRows'
import { buildTripOffers, dismissalRowsForOffer, moreTripOffersWords, notATripWords, tripOfferWords, tripOffersShown, tripRecordFromOffer } from '../../lib/trips/tripOffers'
import { newTripRecord, tripPeopleIndex, type TripRecord } from '../../lib/trips/tripRecord'
import { buildTripsLook, tripSpanWords, tripsLookWords } from '../../lib/trips/tripsLook'
import { formatErrorMessage } from '../../utils/errorHandling'
import ConfirmDialog from '../ConfirmDialog'
import { TripSheet, type TripSheetJob } from '../trips/TripSheet'
import { Card, type CardFold } from './developmentPageBits'
import { DevelopmentTripsLook, type TripsHoursState } from './DevelopmentTripsLook'

/** How long a deleted trip can be put back, and a Not a trip taken back. */
export const TRIP_UNDO_MS = 60_000

const NO_OFFERS: TripSuggestion[] = []

const firstDay = (r: TripRecord): string | null => r.people.flatMap((p) => Object.keys(p.days)).sort()[0] ?? null
const lastDay = (r: TripRecord): string | null => r.people.flatMap((p) => Object.keys(p.days)).sort().pop() ?? null

/** A trip by name, for the delete's question and its toast: *the trip of Oct 23 to Nov 4*. */
export function tripNameWords(r: TripRecord, todayYmd: string): string {
  const first = firstDay(r)
  const last = lastDay(r)
  return first && last ? `the trip of ${tripSpanWords(first, last, todayYmd)}` : 'this trip'
}

export function DevelopmentTripsCard({
  anchorId,
  developmentId,
  siteName,
  trips,
  laborRead,
  jobs,
  todayYmd,
  phone,
  foldFor,
  addSignal,
  historyDays,
  onOffers,
}: {
  anchorId: string
  developmentId: string
  siteName: string
  trips: SiteTripsState
  /** The site's hours, as the Scoreboard reads them; undefined while not asked for. */
  laborRead: SiteLaborRead | undefined
  jobs: ReadonlyArray<TripSheetJob>
  todayYmd: string
  phone: boolean
  /** The look's fold, given the line it says when folded. */
  foldFor: (line: string) => CardFold
  /** A count the page bumps to open the sheet on a new trip. */
  addSignal: number
  /** The day of each History line on the page that is not a trip's own, one entry a line, for What shows it. */
  historyDays: ReadonlyArray<string>
  /** Told how many offers the card holds, so the page's strip can say *1 looks like a trip*. */
  onOffers?: (count: number) => void
}) {
  const { showToast, showActionToast } = useToastContext()
  const [sheet, setSheet] = useState<{ record: TripRecord; isNew: boolean } | null>(null)
  const [asking, setAsking] = useState<TripRecord | null>(null)
  const [busy, setBusy] = useState(false)

  const index = useMemo(() => tripPeopleIndex(trips.roster ?? []), [trips.roster])
  const places = useMemo(() => placesByPersonDay(trips.punches ?? [], trips.sitePoint, index), [trips.punches, trips.sitePoint, index])
  const labor = laborRead?.state === 'read' ? laborRead.labor : null
  const hourRows = useMemo(() => (labor && trips.roster && trips.punches ? tripHourRowsFromLabor(labor, index, places) : null), [labor, trips.roster, trips.punches, index, places])
  const hoursState: TripsHoursState = laborRead?.state === 'failed' || trips.punchesFailed ? 'failed' : labor && !labor.daysKnown ? 'closed' : hourRows ? 'read' : 'reading'
  const model = useMemo(() => buildTripsLook({ records: trips.records ?? [], index, hours: hourRows, todayYmd }), [trips.records, index, hourRows, todayYmd])
  // Looks like a trip: runs of punches at the site that no kept trip covers. They need the roster, the punches, the site's point and the days said to be Not a trip.
  const offers = useMemo(
    () => (trips.roster && trips.punches && !trips.punchesFailed && trips.sitePoint && trips.dismissals ? buildTripOffers({ places, trips: model.rows.map((r) => r.trip), dismissals: trips.dismissals, index, roster: trips.roster, names: trips.names }) : NO_OFFERS),
    [trips.roster, trips.punches, trips.punchesFailed, trips.sitePoint, trips.dismissals, trips.names, places, model.rows, index],
  )
  const offerLines = useMemo(() => {
    const { shown, more } = tripOffersShown(offers)
    return { lines: shown.map((s) => ({ key: s.key, words: tripOfferWords(s, siteName, todayYmd) })), more: moreTripOffersWords(more) }
  }, [offers, siteName, todayYmd])
  const offerCount = offers.length
  useEffect(() => {
    onOffers?.(offerCount)
  }, [offerCount, onOffers])
  // What shows each trip, from the punches and the page's History days; none while the punches are not in.
  const evidence = useMemo(() => {
    const out = new Map<string, TripEvidence>()
    if (!trips.roster || !trips.punches) return out
    for (const row of model.rows) out.set(row.id, tripEvidence({ trip: row.trip, punches: trips.punches, site: trips.sitePoint, index, historyDays }))
    return out
  }, [trips.roster, trips.punches, trips.sitePoint, model.rows, index, historyDays])
  const words = tripsLookWords(model, offerCount)
  const jobLabel = useMemo(() => {
    const byId = new Map(jobs.map((j) => [j.id, `${j.label} ${j.name}`.trim()]))
    return (id: string) => byId.get(id) ?? null
  }, [jobs])

  const openNew = () => setSheet({ record: newTripRecord({ id: crypto.randomUUID(), developmentId }), isNew: true })
  // The sheet's Who went reads the roster, which a site with no look yet has not asked for.
  const askRoster = trips.askRoster
  useEffect(() => {
    if (sheet) askRoster()
  }, [sheet, askRoster])
  // The page's own door to the first trip: a bump of the count opens the sheet; the count it was mounted with does not.
  const seenSignal = useRef(addSignal)
  useEffect(() => {
    if (addSignal === seenSignal.current) return
    seenSignal.current = addSignal
    setSheet({ record: newTripRecord({ id: crypto.randomUUID(), developmentId }), isNew: true })
  }, [addSignal, developmentId])

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
  const remove = async (record: TripRecord) => {
    setAsking(null)
    setBusy(true)
    try {
      await trips.remove(record.id)
      showActionToast(
        `Deleted ${tripNameWords(record, todayYmd)}. No clock row changed.`,
        {
          label: 'Undo',
          onClick: () =>
            void trips.save(record).then(
              () => showToast('The trip is back.', 'success'),
              (e: unknown) => showToast(formatErrorMessage(e, 'The trip could not be put back.'), 'error', 6000),
            ),
        },
        { durationMs: TRIP_UNDO_MS },
      )
    } catch (e) {
      showToast(formatErrorMessage(e, 'The trip was not deleted.'), 'error', 6000)
    } finally {
      setBusy(false)
    }
  }

  // Make it a trip: the sheet opens on a new trip filled from the punches. Nothing is saved until Save.
  const makeFromOffer = (key: string) => {
    const offer = offers.find((o) => o.key === key)
    if (offer) setSheet({ record: tripRecordFromOffer(offer, newTripRecord({ id: crypto.randomUUID(), developmentId }), trips.roster ?? []), isNew: true })
  }
  // Not a trip: one row a person, and a minute to take it back.
  const dismissOffer = async (key: string) => {
    const offer = offers.find((o) => o.key === key)
    if (!offer) return
    setBusy(true)
    try {
      const made = await trips.dismiss(dismissalRowsForOffer(offer, { developmentId, roster: trips.roster ?? [] }))
      showActionToast(
        `${notATripWords(offer, todayYmd)} No clock row changed.`,
        {
          label: 'Undo',
          onClick: () =>
            void trips.undismiss(made.map((r) => r.id)).then(
              () => showToast('Not a trip is taken back. The days are offered again.', 'success'),
              (e: unknown) => showToast(formatErrorMessage(e, 'Not a trip could not be taken back.'), 'error', 6000),
            ),
        },
        { durationMs: TRIP_UNDO_MS },
      )
    } catch (e) {
      showToast(formatErrorMessage(e, 'Not a trip was not remembered.'), 'error', 6000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {trips.shows ? (
        <Card id={anchorId} title="Trips" fold={foldFor(words.need ? `${words.count} · ${words.need}` : words.count)} meta={trips.miles != null ? `${Math.round(trips.miles).toLocaleString('en-US')} miles from the shop · days at the site, apart from the hours on its jobs` : 'days at the site, apart from the hours on its jobs'}>
          <DevelopmentTripsLook
            model={model}
            hoursState={hoursState}
            noSitePoint={trips.sitePointKnown && !trips.sitePoint}
            failure={trips.failure}
            onReload={trips.reload}
            todayYmd={todayYmd}
            phone={phone}
            jobLabel={jobLabel}
            canWrite
            onAdd={openNew}
            onChange={(record) => setSheet({ record, isNew: false })}
            onDelete={setAsking}
            offers={offerLines.lines}
            moreOffersWords={offerLines.more}
            offerBusy={busy}
            onOfferMake={makeFromOffer}
            onOfferDismiss={(key) => void dismissOffer(key)}
            evidence={evidence}
          />
        </Card>
      ) : null}
      {sheet ? <TripSheet key={sheet.record.id} record={sheet.record} isNew={sheet.isNew} siteName={siteName} roster={trips.roster} jobs={jobs} todayYmd={todayYmd} busy={busy} onSave={save} onClose={() => setSheet(null)} /> : null}
      {asking ? (
        <ConfirmDialog
          title={`Delete ${tripNameWords(asking, todayYmd)}?`}
          body={`${asking.purpose.trim() ? `${asking.purpose.trim()}. ` : ''}The trip goes, with who went and its days. No clock row, bill or cost changes. You can undo it for a minute.`}
          confirmLabel="Delete this trip"
          onConfirm={() => void remove(asking)}
          onCancel={() => setAsking(null)}
        />
      ) : null}
    </>
  )
}
