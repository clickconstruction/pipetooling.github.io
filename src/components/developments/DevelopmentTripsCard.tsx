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
 *
 * PR 8: for a dev or a controller it lays the site's wages and card and bank charges over the trips as **What it
 * cost** (`lib/trips/tripCost.ts`), from the labor read and the cost rows the page already holds: the card
 * makes no read of its own, and a reader who may not see costs is handed none. **Print the trip log** builds
 * one paper from the look's own model (`lib/trips/tripLog.ts`) and opens it through `printAndFile`, so the
 * page that printed is filed under the site, as the Plans by date print is (`docs/SENT_COPIES.md`).
 *
 * The number and the link: a trip is named with its number wherever the card names one (the delete's question,
 * its toast and the Undo's). `askedTripId` is the trip a link named (`?trip=`): once the trips are read the card
 * opens its row, one time a link, or says **That trip is no longer here.** `openTrip` is the same ask from a
 * press on the page (a History line, a Plans by date card, a Scoreboard row). **Copy link** copies the link.
 *
 * Put on a bill (punch list #391): the card reads the lines the site's trips hold (`useTripBillLines`) and hands
 * them to the look, which says where each trip's money stands. **Put on a bill** opens the small window
 * (`TripBillLineWindow`); its press adds one line to the job through `trip_put_on_job_line`, and the page then
 * opens that job on Bill with the line picked. Nothing is billed here, and a trip still changes no clock row,
 * bill or cost: the press is its own, and it writes one line.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import type { SiteTripsState } from '../../hooks/useSiteTrips'
import { useTripBillLines } from '../../hooks/useTripBillLines'
import type { SiteCostsRead } from '../../lib/developments/siteCosts'
import type { SiteLaborRead } from '../../lib/developments/siteLabor'
import { appUrl } from '../../lib/appOrigin'
import { ymdFromDateOnlyOrIso } from '../../lib/jobChargesTimeline'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import { TRIP_GONE_WORDS, tripHref } from '../../lib/trips/jobTrips'
import { tripAlreadyOnLinesWords, tripOnLinesWords, type TripBillLine, type TripBillLineReply } from '../../lib/trips/tripBillLine'
import { putTripOnJobLine, TripBillLineRefusal, type TripBillLinePress } from '../../lib/trips/tripBillLineIo'
import { siteCardCharges, tripCostLines, tripCostsOfTrips, type TripCardsState, type TripLaborState } from '../../lib/trips/tripCost'
import { tripEvidence, type TripEvidence } from '../../lib/trips/tripEvidence'
import type { TripSuggestion } from '../../lib/trips/tripFinder'
import { placesByPersonDay, tripHourRowsFromLabor } from '../../lib/trips/tripHourRows'
import { buildTripLog, TRIP_LOG_HOURS_NOTE, tripLogPrintHtml } from '../../lib/trips/tripLog'
import { buildTripOffers, dismissalRowsForOffer, moreTripOffersWords, notATripWords, tripOfferWords, tripOffersShown, tripRecordFromOffer } from '../../lib/trips/tripOffers'
import { newTripRecord, tripPeopleIndex, type TripRecord } from '../../lib/trips/tripRecord'
import { buildTripsLook, tripNameOfRecord, tripsLookWords } from '../../lib/trips/tripsLook'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import ConfirmDialog from '../ConfirmDialog'
import { TripBillLineWindow } from '../trips/TripBillLineWindow'
import { TripSheet, type TripSheetJob } from '../trips/TripSheet'
import { Card, type CardFold } from './developmentPageBits'
import { DevelopmentTripsLook, type TripOpenSignal, type TripsCosts, type TripsHoursState } from './DevelopmentTripsLook'

/** How long a deleted trip can be put back, and a Not a trip taken back. */
export const TRIP_UNDO_MS = 60_000

const NO_OFFERS: TripSuggestion[] = []

/** The day of a card charge's bank stamp, read the way the Scoreboard's window and the Timeline read it. */
const cardDay = (raw: string | null): string | null => ymdFromDateOnlyOrIso(raw, calendarYmdInAppTzFromIso)

/** What the trip log needs that the look does not: who the site is for, and who printed. */
export type TripLogPrint = { customerName: string | null; customerId: string | null; printedBy: string | null }

/** A trip by name, for the delete's question and its toast: *Trip 5, Oct 23 to Nov 4*, or *the trip of Oct 23 to Nov 4* for a trip made before numbers. */
export function tripNameWords(r: TripRecord, todayYmd: string): string {
  return tripNameOfRecord(r, todayYmd).theTrip
}

/** What the Undo of a delete says once the trip is saved again: *Trip 5 is back.* */
export function tripBackWords(r: TripRecord, todayYmd: string): string {
  const number = tripNameOfRecord(r, todayYmd).number
  return number ? `${number} is back.` : 'The trip is back.'
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
  seesCosts = false,
  costsRead,
  print,
  askedTripId = null,
  openTrip = null,
  billRole = null,
  onOpenJobOnBill,
  billIo = putTripOnJobLine,
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
  /** Whether this reader may see the site's costs (`canSeeSiteCosts`): a dev or a controller. */
  seesCosts?: boolean
  /** The site's cost rows as the page already reads them for the Jobs & bids table; undefined when it reads none. */
  costsRead?: SiteCostsRead
  /** The trip log's head and where its copy is filed. Absent, the look has no print. */
  print?: TripLogPrint
  /** The trip a link named (`?trip=`): its row opens once the trips are read, one time a link. */
  askedTripId?: string | null
  /** The same ask from a press on the page; `n` changes with each press. */
  openTrip?: TripOpenSignal | null
  /** The reader's role, for **Put on a bill** (punch list #391): it shows to the roles that may change a job's lines. */
  billRole?: string | null
  /**
   * Open a job's window on Bill with these lines picked. `onJobSaved` is the card's to call when that window
   * saves, so a line renamed, billed or removed there is read again here. Absent, a trip's line has no door
   * and the press opens nothing after it.
   */
  onOpenJobOnBill?: (jobId: string, lineIds: ReadonlyArray<string>, onJobSaved: () => void) => void
  /** The press and its dry run. Injectable for tests. */
  billIo?: (press: TripBillLinePress) => Promise<TripBillLineReply>
}) {
  const { showToast, showActionToast } = useToastContext()
  const [sheet, setSheet] = useState<{ record: TripRecord; isNew: boolean } | null>(null)
  const [asking, setAsking] = useState<TripRecord | null>(null)
  const [busy, setBusy] = useState(false)
  /** The trip whose Put on a bill window is open. */
  const [billing, setBilling] = useState<TripRecord | null>(null)

  // One trip asked for, by a link or a press: handed to the look, which opens its row. It waits here while the
  // look is folded, and is dropped once the look has opened it.
  const [signal, setSignal] = useState<TripOpenSignal | null>(null)
  const records = trips.records
  const landedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!askedTripId || !records) return
    const key = `${developmentId}|${askedTripId}`
    if (landedFor.current === key) return
    landedFor.current = key
    // A trip that was deleted, or another site's: said once, quietly, with nothing to retry.
    if (records.some((r) => r.id === askedTripId)) setSignal({ id: askedTripId, n: Date.now() })
    else showToast(TRIP_GONE_WORDS, 'info')
  }, [askedTripId, records, developmentId, showToast])
  const seenOpen = useRef<number | null>(openTrip?.n ?? null)
  useEffect(() => {
    if (!openTrip || openTrip.n === seenOpen.current) return
    seenOpen.current = openTrip.n
    if ((records ?? []).some((r) => r.id === openTrip.id)) setSignal(openTrip)
    else showToast(TRIP_GONE_WORDS, 'info')
  }, [openTrip, records, showToast])
  const signalDone = useCallback(() => setSignal(null), [])
  // Copy link: the app's address with this page and this trip, as the app copies a link elsewhere.
  const copyLink = async (record: TripRecord) => {
    const url = appUrl(tripHref(developmentId, record.id))
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copied.', 'success')
    } catch {
      showToast(`Copy this link: ${url}`, 'info')
    }
  }

  // The lines the site's trips hold, read once the look shows: each trip's billing standing is read from them.
  const tripIds = useMemo(() => (records ?? []).map((r) => r.id), [records])
  const billLines = useTripBillLines(tripIds, trips.shows && !!records)
  const jobShort = useMemo(() => {
    const byId = new Map(jobs.map((j) => [j.id, j.label.trim() || j.name.trim()]))
    return (id: string) => byId.get(id) || null
  }, [jobs])

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
  // What it cost, for a dev or a controller alone: the wages from the clock read, the card and bank charges from the page's cost rows.
  const cardCharges = useMemo(() => (seesCosts && costsRead?.state === 'read' && costsRead.rows ? siteCardCharges(costsRead.rows, cardDay) : null), [seesCosts, costsRead])
  const costs = useMemo<TripsCosts | null>(() => {
    if (!seesCosts) return null
    const rosterIn = !!trips.roster
    const byTrip = tripCostsOfTrips({ seesCosts, trips: model.rows.map((r) => r.trip), labor: rosterIn ? labor : null, index, cards: cardCharges })
    if (!byTrip) return null
    const laborState: TripLaborState = laborRead?.state === 'failed' ? 'failed' : labor && !labor.daysKnown ? 'closed' : labor && rosterIn ? 'read' : 'reading'
    // No cost read at all means the site has no job to cost: nothing to wait for. Rows with no card lines on them leave the row out.
    const cardsState: TripCardsState = cardCharges ? 'read' : !costsRead ? 'off' : costsRead.state === 'failed' ? 'failed' : costsRead.state === 'reading' ? 'reading' : 'off'
    return { byTrip, labor: laborState, cards: cardsState }
  }, [seesCosts, trips.roster, model.rows, labor, laborRead?.state, index, cardCharges, costsRead])
  // Print the trip log: the look's own model on one paper, no dollars on it, filed under the site as a print is.
  const [printNote, setPrintNote] = useState<string | null>(null)
  const printLog = () => {
    if (!print) return
    const html = tripLogPrintHtml(
      buildTripLog({
        model,
        siteName,
        customerName: print.customerName,
        printedAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
        printedBy: print.printedBy,
        jobLabel,
        hoursNote: hoursState === 'read' ? null : TRIP_LOG_HOURS_NOTE[hoursState],
      }),
    )
    const printed = printAndFile(html, { kind: 'trip_log', title: `Trip log · ${siteName}`, customerId: print.customerId, source: { table: 'developments', id: developmentId } })
    setPrintNote(printed ? null : 'The print window was blocked. Allow pop-ups for this site and press again.')
  }

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
              () => showToast(tripBackWords(record, todayYmd), 'success'),
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

  // Put on a bill: one line on the job, then the job's window on Bill with that line picked. The function's own
  // refusal is said in its words. A trip that already holds a line is told so, and its door is read again.
  const reloadTrips = trips.reload
  const reloadBillLines = billLines.reload
  const putOnBill = async (press: Omit<TripBillLinePress, 'dryRun'>): Promise<boolean> => {
    const record = (records ?? []).find((r) => r.id === press.tripId)
    const short = record ? tripNameOfRecord(record, todayYmd).short : 'The trip'
    setBusy(true)
    try {
      const reply = await billIo({ ...press, dryRun: false })
      const job = jobs.find((j) => j.id === (reply.jobId ?? press.jobId)) ?? null
      reloadBillLines()
      // The picked job joined the trip's jobs, so the trips are read again too.
      reloadTrips()
      if (reply.duplicate) showToast(tripAlreadyOnLinesWords(short, job), 'info', 6000)
      else showToast(tripOnLinesWords(short, job), 'success')
      if (reply.fixtureId && reply.jobId) onOpenJobOnBill?.(reply.jobId, [reply.fixtureId], reloadBillLines)
      return true
    } catch (e) {
      showToast(e instanceof TripBillLineRefusal ? e.message : formatErrorMessage(e, 'The line was not added.'), 'error', 8000)
      return false
    } finally {
      setBusy(false)
    }
  }
  const openBillLine = (_record: TripRecord, line: TripBillLine) => onOpenJobOnBill?.(line.jobId, [line.fixtureId], reloadBillLines)
  // What the trip cost, in the window's hint, for a dev or a controller alone and only when the figure stands.
  const billingCost = useMemo(() => {
    if (!billing || !costs) return null
    const total = tripCostLines(costs.byTrip.get(billing.id), costs).find((l) => l.key === 'total')
    return total?.stands ? total.value : null
  }, [billing, costs])

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
            costs={costs}
            onPrint={print ? printLog : undefined}
            printNote={printNote}
            openSignal={signal}
            onOpened={signalDone}
            onCopyLink={(record) => void copyLink(record)}
            billLines={billLines.lines}
            billRole={billRole}
            jobShort={jobShort}
            onPutOnBill={setBilling}
            onOpenBillLine={onOpenJobOnBill ? openBillLine : undefined}
          />
        </Card>
      ) : null}
      {sheet ? <TripSheet key={sheet.record.id} record={sheet.record} isNew={sheet.isNew} siteName={siteName} roster={trips.roster} jobs={jobs} todayYmd={todayYmd} busy={busy} onSave={save} onClose={() => setSheet(null)} /> : null}
      {billing ? <TripBillLineWindow key={billing.id} record={billing} siteName={siteName} jobs={jobs} todayYmd={todayYmd} costWords={billingCost} busy={busy} preview={billIo} onAdd={putOnBill} onClose={() => setBilling(null)} /> : null}
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
