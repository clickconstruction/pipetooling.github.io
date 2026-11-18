/**
 * The Trips look on the Development page (punch list #379, PR 3). It shows only on a site that has a trip
 * or that is far from the shop. The band answers the owner's question first: of all the hours on this
 * site, how many were at the site. Under it one bar of the same hours, the year's trips on a strip, and a
 * row a trip that opens in place: what was typed on the left, what is counted from the clock on the right.
 *
 * Everything drawn comes from one model (`lib/trips/tripsLook.ts`), so the band, the strip, a row and an
 * open trip are counted from the same days. A trip is a reading over the clock: nothing here changes a
 * clock row, a bill or a cost.
 *
 * PR 5: a run of punches at the site that no trip covers is offered above the rows, **Looks like a trip**,
 * with **Make it a trip** and **Not a trip** (`lib/trips/tripOffers.ts`). The app never makes the trip.
 * An open trip says **What shows it**: counts of what the page already reads (`lib/trips/tripEvidence.ts`).
 *
 * PR 8: an open trip that has gone out says **What it cost** to a dev or a controller, the wages of its hours
 * and the card and bank charges in its days (`lib/trips/tripCost.ts`); the look is handed no costs for anyone else.
 * **Print the trip log** sits beside **+ Trip** for everyone who sees the look.
 *
 * The number and the link: a trip leads with its number, **Trip 5**, on its row, its open heading and its bar
 * on the strip (`tripName` in `lib/trips/tripsLook.ts`). `openSignal` opens one trip's row and turns the strip
 * to its year: a link to the trip, or a press on its name elsewhere on the page. **Copy link** on an open
 * trip is there for everyone who sees the look. The number is words only: nothing here lets a person type it.
 *
 * Put on a bill (punch list #391): an open trip marked Extra that has gone out shows **Put on a bill** beside
 * **Change**, to the roles that may change a job's lines. A trip that holds a line shows the door to it in the
 * press's place, and its billing chip says where its money stands, read from the line and the bill that took
 * it (`lib/trips/tripBillLine.ts`). The look is handed the lines; with none handed, a trip says its own word.
 *
 * Deleted trips: under the rows, a fold for the reader who can write, closed until pressed. Each deleted trip says
 * who deleted it and until when it is kept, with **Put back**, which saves it again (`lib/trips/tripDeleted.ts`).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { TRIP_DAY_LABEL, TRIP_STANDING_LABEL, type TripDayKind } from '../../lib/trips/tripDays'
import { TRIP_COST_CAP, TRIP_COST_WHO, tripCostLines, type TripCardsState, type TripCost, type TripCostLine, type TripLaborState } from '../../lib/trips/tripCost'
import { tripEvidenceChips, type TripEvidence, type TripEvidenceChip } from '../../lib/trips/tripEvidence'
import { TRIP_HOUR_BUCKET_LABEL, type TripHourBucket } from '../../lib/trips/tripHours'
import { tripRowAnchor } from '../../lib/trips/jobTrips'
import { TRIP_DELETED_FAILED_WORDS, TRIP_DELETED_FOLD_LABEL, TRIP_DELETED_NOTE, TRIP_PUT_BACK_LABEL, type DeletedTripLine } from '../../lib/trips/tripDeleted'
import { TRIP_PUT_ON_BILL_LABEL, tripBillStanding, tripPutOnBillShows, type TripBillLine, type TripBillStanding } from '../../lib/trips/tripBillLine'
import { TRIP_BILLING_WORDS, type TripRecord } from '../../lib/trips/tripRecord'
import { atSitePercentWords, buildTripStrip, daysWords, filterTripRows, hoursWords, monthDay, tripStripStartYear, tripStripYearOf, TRIPS_FILTERS, type TripLookRow, type TripsFilter, type TripsLookModel } from '../../lib/trips/tripsLook'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { TripDayDots, TripHoursBar, TripLegend, TripPaintDays, TRIP_KIND_COLOR, BucketDot, bucketBackground } from '../trips/TripDayBits'
import { capStyle, LinkButton, SmallButton } from './developmentPageBits'

/** Why the hours are not on the screen yet, when they are not. */
export type TripsHoursState = 'reading' | 'read' | 'closed' | 'failed'

export const TRIPS_HOURS_WORDS: Readonly<Record<Exclude<TripsHoursState, 'read'>, string>> = {
  reading: 'Reading the clock…',
  closed: 'The clock’s days are closed to you, so the hours are not laid over the trips.',
  failed: 'The clock would not read, so the hours are not laid over the trips. Reload to try again.',
}

export const TRIPS_NO_POINT_WORDS = 'This site’s address has no point on the map yet. No punch can be checked against it, so no hour reads At the site.'

const tile = { border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', background: 'var(--bg-subtle)', minWidth: 0 } as const
const tileValue = { font: 'inherit', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 } as const
const tileSub = { fontSize: '0.74rem', color: 'var(--text-muted)' } as const

/** The billing chip. A trip whose line is billed or paid reads green; an Extra trip still owed a bill reads amber. A standing's words may wrap. */
function billingChipStyle(row: TripLookRow, standing: TripBillStanding | null = null) {
  const green = standing?.kind === 'billed' || standing?.kind === 'paid'
  const amber = !green && (row.billing === 'extra' || !!standing)
  const edge = green ? 'var(--border-green)' : amber ? 'var(--text-amber-800)' : 'var(--border)'
  const fill = green ? 'var(--bg-green-tint)' : amber ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)'
  const ink = green ? 'var(--text-green-700)' : amber ? 'var(--text-amber-800)' : 'var(--text-700)'
  return { display: 'inline-flex', alignItems: 'center', border: `1px solid ${edge}`, borderRadius: standing ? 10 : 999, padding: '1px 9px', fontSize: '0.74rem', background: fill, color: ink, whiteSpace: standing ? 'normal' : 'nowrap' } as const
}

/** What each trip cost, for a dev or a controller, and where the two reads behind it stand. */
export type TripsCosts = { byTrip: ReadonlyMap<string, TripCost>; labor: TripLaborState; cards: TripCardsState }

const NO_DELETED: ReadonlyArray<DeletedTripLine> = []

/** One trip to open: its id, and a count that changes with each ask, so the same trip can be asked for twice. */
export type TripOpenSignal = { id: string; n: number }

/** One offer as the look draws it: the finder's key and its sentence. */
export type TripOfferLine = { key: string; words: string }

function evidenceChipStyle(tone: TripEvidenceChip['tone']) {
  const green = tone === 'green'
  return { display: 'inline-flex', alignItems: 'center', border: `1px solid ${green ? 'var(--border-green)' : 'var(--border)'}`, borderRadius: 999, padding: '1px 9px', fontSize: '0.74rem', background: green ? 'var(--bg-green-tint)' : 'var(--surface)', color: green ? 'var(--text-green-700)' : 'var(--text-700)', whiteSpace: 'nowrap' } as const
}

export function DevelopmentTripsLook({
  model,
  hoursState,
  noSitePoint,
  failure,
  onReload,
  todayYmd,
  phone,
  jobLabel,
  canWrite,
  onAdd,
  onChange,
  onDelete,
  offers = [],
  moreOffersWords = null,
  offerBusy = false,
  onOfferMake,
  onOfferDismiss,
  evidence,
  costs = null,
  onPrint,
  printNote = null,
  openSignal = null,
  onOpened,
  onCopyLink,
  billLines = null,
  billRole = null,
  jobShort,
  onPutOnBill,
  onOpenBillLine,
  deleted = NO_DELETED,
  deletedFailed = false,
  putBackBusy = false,
  onPutBack,
}: {
  model: TripsLookModel
  hoursState: TripsHoursState
  /** The site's address has no point, so no punch can be read against it. */
  noSitePoint: boolean
  failure: OfflineRecoveryLastError | null
  onReload: () => void
  todayYmd: string
  phone: boolean
  /** A job's label and name by its id; null for a job no longer on the site. */
  jobLabel: (jobId: string) => string | null
  canWrite: boolean
  onAdd: () => void
  onChange: (record: TripRecord) => void
  onDelete: (record: TripRecord) => void
  /** Runs of punches at the site that no trip covers, oldest first. Drawn only for a reader who can write, once the hours are read, on a site with a point. */
  offers?: ReadonlyArray<TripOfferLine>
  /** The quiet line under the offers when more wait behind them. */
  moreOffersWords?: string | null
  offerBusy?: boolean
  /** **Make it a trip**: open the sheet on a new trip filled from the punches. */
  onOfferMake?: (key: string) => void
  /** **Not a trip**: remember it, so the same days are not offered again. */
  onOfferDismiss?: (key: string) => void
  /** What shows each trip, by its id; a trip with none yet draws no block. */
  evidence?: ReadonlyMap<string, TripEvidence>
  /** What each trip cost. Null for a reader who may not see the site's costs: no table is drawn. */
  costs?: TripsCosts | null
  /** **Print the trip log**: every trip on one paper, with no dollars on it. */
  onPrint?: () => void
  /** What the last press of the print left to say, such as a blocked window. */
  printNote?: string | null
  /** Open this trip's row and turn the strip to its year: a link to the trip, or a press on its name elsewhere on the page. */
  openSignal?: TripOpenSignal | null
  /** Told once the look has opened the trip the signal named, so a look that is folded and opened again does not jump back to it. */
  onOpened?: () => void
  /** **Copy link** on an open trip: the link that opens this trip. Absent, the press is not drawn. */
  onCopyLink?: (record: TripRecord) => void
  /** The lines the site's trips hold, by trip (punch list #391). Null while they are not read, or closed to this reader: a trip then says its own billing word. */
  billLines?: ReadonlyMap<string, TripBillLine> | null
  /** The reader's role, for **Put on a bill**: it shows to the roles that may change a job's lines. */
  billRole?: string | null
  /** A job by its label alone, as *J2101*, for the standing's words; null for a job no longer on the site. */
  jobShort?: (jobId: string) => string | null
  /** **Put on a bill**: open the window on this trip. Absent, the press is not drawn. */
  onPutOnBill?: (record: TripRecord) => void
  /** The door to a trip's line: open its job on Bill with the line picked. Absent, the door is not drawn. */
  onOpenBillLine?: (record: TripRecord, line: TripBillLine) => void
  /** The site's deleted trips, said in words, newest first. Drawn only for a reader who can write. */
  deleted?: ReadonlyArray<DeletedTripLine>
  /** The deleted trips would not read: a quiet line says so in the fold's place. */
  deletedFailed?: boolean
  putBackBusy?: boolean
  /** **Put back**: save this deleted trip again, under its own id. Absent, the press is dead. */
  onPutBack?: (id: string) => void
}) {
  const [filter, setFilter] = useState<TripsFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [yearPick, setYearPick] = useState<number | null>(null)
  const [deletedOpen, setDeletedOpen] = useState(false)
  const startYear = useMemo(() => tripStripStartYear(model.rows, todayYmd), [model.rows, todayYmd])
  const year = yearPick ?? startYear
  const strip = useMemo(() => buildTripStrip(model.rows, year, todayYmd), [model.rows, year, todayYmd])
  const rows = useMemo(() => filterTripRows(model.rows, filter), [model.rows, filter])
  const h = model.band.hours
  const wait = hoursState === 'read' ? null : TRIPS_HOURS_WORDS[hoursState]
  const num = (n: number | undefined) => (n == null ? (hoursState === 'reading' ? '…' : '—') : hoursWords(n))
  const yearAt = strip.years.indexOf(year)
  const offersShown = canWrite && hoursState === 'read' && !noSitePoint ? offers : []

  // A link or a press asked for one trip: every trip is listed, its row opens, and the strip shows its year.
  const openedSignal = useRef<number | null>(null)
  useEffect(() => {
    if (!openSignal || openSignal.n === openedSignal.current) return
    const asked = model.rows.find((r) => r.id === openSignal.id)
    if (!asked) return
    openedSignal.current = openSignal.n
    setFilter('all')
    setOpenId(asked.id)
    setYearPick(tripStripYearOf(asked, todayYmd))
    onOpened?.()
  }, [openSignal, model.rows, todayYmd, onOpened])

  if (failure) return <OfflineRetryPanel failure={failure} onRetry={onReload} surface="development-trips" idempotent />

  return (
    <div data-testid="trips-look">
      {/* The band: the owner's question first. */}
      <div style={{ display: 'grid', gridTemplateColumns: phone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }} data-testid="trips-band">
        <div style={tile}>
          <div style={capStyle}>Trips</div>
          <div style={tileValue} data-testid="trips-band-trips">{model.band.gone}</div>
          <div style={tileSub}>{model.band.planned ? `and ${model.band.planned} planned` : 'gone out'}</div>
        </div>
        <div style={tile}>
          <div style={capStyle}>Days at the site</div>
          <div style={tileValue} data-testid="trips-band-days">{model.band.siteDays}</div>
          <div style={tileSub}>over {model.band.gone === 1 ? 'one trip' : `${model.band.gone} trips`}</div>
        </div>
        <div style={tile}>
          <div style={capStyle}>Hours on this site</div>
          <div style={tileValue} data-testid="trips-band-hours">{num(h?.all)}</div>
          <div style={tileSub}>every job, every person</div>
        </div>
        <div style={tile}>
          <div style={capStyle}>At the site</div>
          <div style={tileValue} data-testid="trips-band-site">{h ? `${hoursWords(h.site)} h` : num(undefined)}</div>
          <div style={tileSub}>{h ? (atSitePercentWords(h) ? `${atSitePercentWords(h)} of the hours` : 'no hours yet') : 'of the hours'}</div>
        </div>
        <div style={{ ...tile, gridColumn: phone ? '1 / -1' : undefined }}>
          <div style={capStyle}>Not at the site</div>
          <div style={tileValue} data-testid="trips-band-away">{h ? `${hoursWords(h.notAtSite)} h` : num(undefined)}</div>
          <div style={tileSub}>{h ? `road ${hoursWords(h.road)} · ready ${hoursWords(h.ready)} · home ${hoursWords(h.home)} · no place ${hoursWords(h.noPlace)}` : 'road · ready · home · no place'}</div>
        </div>
      </div>
      {h ? (
        <div style={{ marginTop: 12 }}>
          <TripHoursBar
            label={`Of ${hoursWords(h.all)} hours on this site, ${hoursWords(h.site)} were at the site`}
            parts={[
              { bucket: 'site', hours: h.site },
              { bucket: 'road', hours: h.road },
              { bucket: 'ready', hours: h.ready },
              { bucket: 'noPlace', hours: h.noPlace },
              { bucket: 'home', hours: h.home },
            ]}
          />
          <TripLegend home />
        </div>
      ) : wait ? (
        <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }} data-testid="trips-hours-wait">
          {wait}
        </p>
      ) : null}
      {noSitePoint && hoursState === 'read' ? (
        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--text-amber-800)' }} data-testid="trips-no-point">
          {TRIPS_NO_POINT_WORDS}
        </p>
      ) : null}

      {/* The year's trips against time. */}
      {model.rows.length > 0 ? (
        <div style={{ position: 'relative', marginTop: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-subtle)', padding: '22px 10px 10px' }} data-testid="trips-strip">
          <div style={{ position: 'absolute', left: 10, right: 10, top: 4, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', fontSize: '0.68rem', color: 'var(--text-muted)' }} aria-hidden>
            {strip.months.map((m) => (
              <span key={m} style={{ borderLeft: '1px solid var(--border)', paddingLeft: 4, overflow: 'hidden' }}>
                {phone ? m.slice(0, 1) : m}
              </span>
            ))}
          </div>
          <div style={{ position: 'relative', height: 40 }}>
            {strip.bars.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setOpenId(b.id)}
                title={b.title}
                aria-label={b.aria}
                data-testid="trips-strip-bar"
                style={{ position: 'absolute', top: 4, left: `${b.leftPct}%`, width: `max(8px, ${b.widthPct}%)`, height: 18, display: 'flex', borderRadius: 5, overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer', opacity: b.planned ? 0.55 : 1, outline: b.planned ? '1px dashed var(--text-700)' : '1px solid var(--surface)', background: 'var(--bg-muted)' }}
              >
                {b.kinds.map((k, i) => (
                  <i key={i} style={{ display: 'block', height: '100%', flex: '1 1 0', background: k ? TRIP_KIND_COLOR[k] : 'var(--bg-muted)' }} />
                ))}
              </button>
            ))}
            {phone
              ? null
              : strip.bars.map((b) => (
                  <span key={b.id} aria-hidden style={{ position: 'absolute', top: 24, left: `${b.leftPct}%`, fontSize: '0.66rem', color: 'var(--text-700)', whiteSpace: 'nowrap', transform: 'translateX(-2px)' }}>
                    {b.label}
                  </span>
                ))}
            {strip.todayPct != null ? (
              <span aria-hidden style={{ position: 'absolute', top: -4, bottom: 0, left: `${strip.todayPct}%`, width: 0, borderLeft: '2px solid var(--text-red-700)' }}>
                {/* On a phone the months are one letter wide and the word would sit on them: the line alone says today. */}
                {phone ? null : <span style={{ position: 'absolute', top: -13, left: -16, fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-red-700)' }}>today</span>}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            <span data-testid="trips-strip-year">{strip.year}</span>
            {strip.years.length > 1 ? (
              <span style={{ display: 'inline-flex', gap: 10 }}>
                {yearAt > 0 ? <LinkButton onClick={() => setYearPick(strip.years[yearAt - 1] ?? year)}>‹ {strip.years[yearAt - 1]}</LinkButton> : null}
                {yearAt >= 0 && yearAt < strip.years.length - 1 ? <LinkButton onClick={() => setYearPick(strip.years[yearAt + 1] ?? year)}>{strip.years[yearAt + 1]} ›</LinkButton> : null}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Looks like a trip: the app only offers. A person makes the trip, or says Not a trip once. */}
      {offersShown.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, marginTop: 12 }} data-testid="trips-offers">
          {offersShown.map((o) => (
            <div
              key={o.key}
              data-testid="trips-offer"
              style={{ border: '1px dashed var(--text-amber-800)', background: 'var(--bg-amber-tint)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: phone ? 'column' : 'row', flexWrap: 'wrap', gap: '8px 12px', alignItems: phone ? 'flex-start' : 'center', justifyContent: 'space-between' }}
            >
              <div style={{ flex: phone ? undefined : '1 1 280px', minWidth: 0, fontSize: '0.86rem' }}>
                <strong style={{ color: 'var(--text-strong)' }}>Looks like a trip.</strong> {o.words}
              </div>
              <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                <SmallButton onClick={() => onOfferMake?.(o.key)} primary disabled={offerBusy} title="Open a new trip filled from these punches. Nothing is saved until you press Save the trip.">
                  Make it a trip
                </SmallButton>
                <SmallButton onClick={() => onOfferDismiss?.(o.key)} disabled={offerBusy} title="Remember that these days were not a trip, so they are not offered again. No clock row changes.">
                  Not a trip
                </SmallButton>
              </span>
            </div>
          ))}
          {moreOffersWords ? (
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }} data-testid="trips-offers-more">
              {moreOffersWords}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* The rows. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label="Which trips">
          {model.rows.length > 0
            ? TRIPS_FILTERS.map((f) => (
                <button key={f.key} type="button" role="radio" aria-checked={filter === f.key} className="developmentHistoryChip" data-on={filter === f.key ? '1' : undefined} onClick={() => setFilter(f.key)} data-testid={`trips-filter-${f.key}`}>
                  {f.label} {model.counts[f.key]}
                </button>
              ))
            : null}
        </span>
        <span style={{ display: 'inline-flex', gap: '6px 14px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          {printNote ? (
            <span style={{ color: 'var(--text-muted)' }} data-testid="trips-print-note">
              {printNote}
            </span>
          ) : null}
          {onPrint && model.rows.length > 0 ? (
            <span data-testid="trips-print">
              <LinkButton onClick={onPrint} title="Opens every trip of this site on one page in a print window. The print window saves it as a PDF too. The page carries no dollars." nowrap>
                Print the trip log
              </LinkButton>
            </span>
          ) : null}
          {canWrite ? (
            <SmallButton onClick={onAdd} primary title="Add a trip to this site: who went, which days, what for">
              + Trip
            </SmallButton>
          ) : null}
        </span>
      </div>

      {model.rows.length === 0 ? (
        <EmptyState {...(canWrite ? emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'trips', control: '+ Trip' }), { onPress: onAdd }) : { main: emptyWords({ kind: 'make', noun: 'trips', control: '+ Trip' }).main, tail: 'The office or a leader adds the first.' })} compact />
      ) : rows.length === 0 ? (
        <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'trips', query: '' }), { onPress: () => setFilter('all') })} compact />
      ) : (
        <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }} data-testid="trips-rows">
          {phone ? null : (
            <div style={{ ...rowGrid(false), background: 'var(--bg-muted)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '6px 12px' }} aria-hidden>
              <div>Days</div>
              <div>What for · who went</div>
              <div>Each day</div>
              <div>Hours</div>
              <div>Billing</div>
            </div>
          )}
          {rows.map((row, i) => {
            const open = openId === row.id
            const billLine = billLines?.get(row.id) ?? null
            const billStanding = tripBillStanding({ billing: row.billing, line: billLine, linesRead: billLines != null, jobShort: billLine ? (jobShort?.(billLine.jobId) ?? null) : null })
            const showsPutOnBill = !!onPutOnBill && tripPutOnBillShows({ billing: row.billing, standing: row.standing, role: billRole, line: billLine, linesRead: billLines != null })
            return (
              // The row wears an id and the cards' own margin under the pinned strip, so a link to the trip lands on it.
              <div key={row.id} id={tripRowAnchor(row.id)} style={{ borderTop: i === 0 && phone ? 'none' : '1px solid var(--border)', background: 'var(--surface)', scrollMarginTop: 'var(--development-jump-offset, 72px)' }} data-testid="trip-row" data-standing={row.standing}>
                <button type="button" onClick={() => setOpenId(open ? null : row.id)} aria-expanded={open} title={open ? 'Close this trip' : 'Open this trip'} data-testid="trip-row-press" style={{ ...rowGrid(phone), width: '100%', textAlign: 'left', border: 'none', background: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', padding: '9px 12px' }}>
                  <div>
                    {/* The trip's number leads: the short thing to say in a text or cite on a bill. */}
                    {row.name.number ? (
                      <span style={{ ...capStyle, display: 'block', color: 'var(--text-700)' }} data-testid="trip-row-number">
                        {row.name.number}
                      </span>
                    ) : null}
                    <strong style={{ display: 'block', color: 'var(--text-strong)' }}>{row.when}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{row.standingWords}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ color: 'var(--text-strong)' }}>{row.why}</strong>
                    <br />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{row.who}</span>
                  </div>
                  <div>
                    <TripDayDots days={row.days} label={dayDotsWords(row)} />
                  </div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.84rem' }} data-testid="trip-row-hours">
                    {row.standing === 'planned' ? (
                      <span style={{ color: 'var(--text-muted)' }}>not yet</span>
                    ) : row.hours ? (
                      <>
                        {hoursWords(row.hours.all)} h · <strong>{hoursWords(row.hours.site)}</strong> at the site
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>{hoursState === 'reading' ? '…' : '—'}</span>
                    )}
                  </div>
                  <div>
                    {billStanding ? (
                      <span style={billingChipStyle(row, billStanding)} data-testid="trip-row-billing" data-standing={billStanding.kind}>
                        {billStanding.words}
                      </span>
                    ) : row.billingLabel ? (
                      <span style={billingChipStyle(row)} data-testid="trip-row-billing">
                        {row.billingLabel}
                      </span>
                    ) : null}
                  </div>
                </button>
                {open ? <OpenTrip row={row} billStanding={billStanding} onPutOnBill={showsPutOnBill ? () => onPutOnBill?.(row.record) : undefined} onOpenBillLine={billLine && onOpenBillLine ? () => onOpenBillLine(row.record, billLine) : undefined} evidence={evidence?.get(row.id) ?? null} costLines={costs && row.standing !== 'planned' ? tripCostLines(costs.byTrip.get(row.id), costs) : null} phone={phone} jobLabel={jobLabel} canWrite={canWrite} hoursState={hoursState} onChange={() => onChange(row.record)} onDelete={() => onDelete(row.record)} onCopyLink={onCopyLink ? () => onCopyLink(row.record) : undefined} /> : null}
              </div>
            )
          })}
        </div>
      )}
      {/* Deleted trips (the fold after v2.7800): kept 90 days, each with who deleted it, and the press that saves it again. */}
      {canWrite && deleted.length > 0 ? (
        <div style={{ marginTop: 14 }} data-testid="trips-deleted">
          <button type="button" onClick={() => setDeletedOpen((v) => !v)} aria-expanded={deletedOpen} data-testid="trips-deleted-fold" style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer' }}>
            <span aria-hidden>{deletedOpen ? '▾' : '▸'}</span> {TRIP_DELETED_FOLD_LABEL} · {deleted.length}
          </button>
          {deletedOpen ? (
            <div style={{ marginTop: 8 }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{TRIP_DELETED_NOTE}</p>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {deleted.map((d, i) => (
                  <div key={d.id} data-testid="trips-deleted-row" style={{ display: 'flex', flexDirection: phone ? 'column' : 'row', flexWrap: 'wrap', gap: '6px 14px', alignItems: phone ? 'flex-start' : 'center', justifyContent: 'space-between', padding: '9px 12px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                    <div style={{ flex: phone ? undefined : '1 1 320px', minWidth: 0 }}>
                      <strong style={{ color: 'var(--text-strong)' }}>{d.name}</strong> <span style={{ color: 'var(--text-700)' }}>· {d.why}</span>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{[d.who || null, d.deleted, d.kept].filter(Boolean).join(' · ')}</div>
                      {d.gone ? <div style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)' }}>{d.gone} Put back saves the trip without it.</div> : null}
                    </div>
                    <span data-testid="trips-deleted-put-back">
                      <SmallButton onClick={() => onPutBack?.(d.id)} disabled={putBackBusy || !onPutBack} title={`${d.pressLabel}: who went, its days and its number are saved again. No clock row, bill or cost changes.`}>
                        {TRIP_PUT_BACK_LABEL}
                      </SmallButton>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : canWrite && deletedFailed ? (
        <p style={{ margin: '12px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }} data-testid="trips-deleted-failed">
          {TRIP_DELETED_FAILED_WORDS}
        </p>
      ) : null}
    </div>
  )
}

function rowGrid(phone: boolean) {
  return phone ? ({ display: 'grid', gridTemplateColumns: '1fr', gap: 4 } as const) : ({ display: 'grid', gridTemplateColumns: '170px minmax(0, 1.4fr) 176px 176px 140px', gap: 10, alignItems: 'center' } as const)
}

/** The day dots said in words: *8 days at the site, 2 on the road, 1 getting ready*. */
function dayDotsWords(row: TripLookRow): string {
  const c = row.dayCounts
  return [c.site ? `${daysWords(c.site)} at the site` : null, c.road ? `${c.road} on the road` : null, c.ready ? `${c.ready} getting ready` : null].filter(Boolean).join(', ') || 'no day yet'
}

const KIND_ROWS: ReadonlyArray<{ bucket: Exclude<TripHourBucket, 'home' | 'noPlace'>; kind: TripDayKind }> = [
  { bucket: 'site', kind: 'site' },
  { bucket: 'road', kind: 'road' },
  { bucket: 'ready', kind: 'ready' },
]

/** One trip, open in place: what was typed on the left, what is counted from the clock on the right. */
function OpenTrip({ row, billStanding, onPutOnBill, onOpenBillLine, evidence, costLines, phone, jobLabel, canWrite, hoursState, onChange, onDelete, onCopyLink }: { row: TripLookRow; /** Where the trip's money stands, read from its line; null when its own billing word says everything. */ billStanding: TripBillStanding | null; /** **Put on a bill**; absent when the press does not show on this trip. */ onPutOnBill?: () => void; /** The door to the trip's line; absent when it holds none. */ onOpenBillLine?: () => void; evidence: TripEvidence | null; /** What it cost, for a dev or a controller; null for everyone else and for a trip that has not gone out. */ costLines: ReadonlyArray<TripCostLine> | null; phone: boolean; jobLabel: (jobId: string) => string | null; canWrite: boolean; hoursState: TripsHoursState; onChange: () => void; onDelete: () => void; /** Copies the link that opens this trip; shown to everyone who sees the look. */ onCopyLink?: () => void }) {
  const r = row.record
  const h = row.hours
  const cell = { padding: '5px 8px', borderTop: '1px solid var(--border)', verticalAlign: 'top' } as const
  const right = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } as const
  const label = { color: 'var(--text-muted)' } as const
  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', padding: '12px 14px' }} data-testid="trip-open">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={capStyle}>{TRIP_STANDING_LABEL[row.standing]}</div>
          <div style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-strong)' }} data-testid="trip-open-heading">
            {row.name.full} · {row.why}
          </div>
        </div>
        {canWrite || onCopyLink || onPutOnBill || onOpenBillLine ? (
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {canWrite ? (
              <SmallButton onClick={onChange} title="Change who went, the days, what for and the rest">
                Change
              </SmallButton>
            ) : null}
            {/* One trip, one line: the press shows until the trip holds a line, and the door to the line takes its place. */}
            {onPutOnBill ? (
              <span data-testid="trip-put-on-bill">
                <SmallButton onClick={onPutOnBill} title="Add this trip to a job’s lines, with an amount. A bill takes the line later.">
                  {TRIP_PUT_ON_BILL_LABEL}
                </SmallButton>
              </span>
            ) : onOpenBillLine && billStanding?.door ? (
              <span data-testid="trip-bill-door">
                <SmallButton onClick={onOpenBillLine} title="Open the job on Bill, with this trip’s line picked">
                  {billStanding.door}
                </SmallButton>
              </span>
            ) : null}
            {onCopyLink ? (
              <span style={{ fontSize: '0.78rem' }} data-testid="trip-copy-link">
                <LinkButton onClick={onCopyLink} title="Copies a link that opens this trip on this page, to paste in a text or an email" strong nowrap>
                  Copy link
                </LinkButton>
              </span>
            ) : null}
            {canWrite ? (
              <button type="button" onClick={onDelete} title="Delete this trip. No clock row, bill or cost changes." data-testid="trip-delete" style={{ border: 'none', background: 'none', padding: '0 4px', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-red-700)', cursor: 'pointer' }}>
                Delete this trip
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 16, alignItems: 'start', marginTop: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={capStyle}>The days{canWrite ? ' · tap a day to change it' : ''}</div>
          <div style={{ marginTop: 6 }}>
            <TripPaintDays days={row.days} dayWords={monthDay} onTap={canWrite ? () => onChange() : undefined} testId="trip-open-days" />
          </div>
          <TripLegend home={false} />
          <div style={{ ...capStyle, marginTop: 14 }}>Who went</div>
          {row.people.map((p, i) => (
            <div key={`${p.personKey}:${i}`} style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr) auto' : '110px minmax(0, 1fr) 70px', gap: 8, alignItems: 'center', padding: '5px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }} data-testid="trip-open-person">
              <strong style={{ color: 'var(--text-strong)', gridColumn: phone ? '1 / -1' : undefined }}>{p.name}</strong>
              <span style={{ minWidth: 0 }}>
                <TripDayDots days={p.days} label={`${p.name}: ${p.days.filter((d) => d.kind).length} days on the trip`} />
                {p.hours && p.hours.noPlace > 0 ? (
                  <span style={{ marginLeft: 6, border: '1px dashed var(--border-strong)', borderRadius: 999, padding: '0 8px', fontSize: '0.72rem', color: 'var(--text-700)', whiteSpace: 'nowrap' }} title="These hours come from rows that carry no place, such as an imported or scheduled row. They say the day was paid. They do not say where.">
                    {hoursWords(p.hours.noPlace)} h no place on the punch
                  </span>
                ) : null}
              </span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.hours ? `${hoursWords(p.hours.all)} h` : hoursState === 'reading' ? '…' : '—'}</span>
            </div>
          ))}
          <dl style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: '6px 10px', margin: '10px 0 0', fontSize: '0.84rem' }}>
            <dt style={label}>Asked by</dt>
            <dd style={{ margin: 0 }} data-testid="trip-open-asked">
              {r.askedBy === 'us' ? 'Us' : r.askedBy === 'them' ? (
                <>
                  <strong>Them</strong>
                  {[r.askedWho.trim(), r.askedHow.trim()].filter(Boolean).length ? `: ${[r.askedWho.trim(), r.askedHow.trim()].filter(Boolean).join(', ')}` : ''}
                </>
              ) : (
                <span style={label}>nobody has said</span>
              )}
            </dd>
            <dt style={label}>How it went</dt>
            <dd style={{ margin: 0 }}>{r.outcome.trim() || <span style={label}>{row.standing === 'back' ? 'nobody has said' : 'not back yet'}</span>}</dd>
            <dt style={label}>Work goes on</dt>
            <dd style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {r.jobIds.length ? (
                r.jobIds.map((id) => {
                  const on = h?.byJob.get(id)
                  return (
                    <span key={id} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '1px 9px', fontSize: '0.74rem', background: 'var(--surface)', color: 'var(--text-700)' }}>
                      {jobLabel(id) ?? 'A job no longer on this site'}
                      {on ? ` · ${hoursWords(on)} h` : ''}
                    </span>
                  )
                })
              ) : (
                <span style={label}>no job named</span>
              )}
            </dd>
            <dt style={label}>Billing</dt>
            <dd style={{ margin: 0 }}>
              {billStanding ? (
                <span data-testid="trip-open-billing" data-standing={billStanding.kind}>
                  <span style={billingChipStyle(row, billStanding)}>{billStanding.words}</span>
                  {billStanding.figure ? <span style={label}> {billStanding.figure}</span> : null}
                </span>
              ) : row.billing && row.billingLabel ? (
                <>
                  <span style={billingChipStyle(row)}>{row.billingLabel}</span> <span style={label}>{TRIP_BILLING_WORDS[row.billing]}</span>
                </>
              ) : (
                <span style={label}>nobody has said</span>
              )}
            </dd>
          </dl>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={capStyle}>Counted from the trip’s days</div>
          {h ? (
            <>
              <div style={{ marginTop: 8 }}>
                <TripHoursBar
                  label={`${hoursWords(h.all)} hours on the trip, ${hoursWords(h.site)} at the site`}
                  parts={[
                    { bucket: 'site', hours: h.site },
                    { bucket: 'road', hours: h.road },
                    { bucket: 'ready', hours: h.ready },
                    { bucket: 'noPlace', hours: h.noPlace },
                  ]}
                />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: 6 }} data-testid="trip-open-counted">
                <tbody>
                  {KIND_ROWS.map(({ bucket, kind }, i) => (
                    <tr key={bucket}>
                      <td style={{ ...cell, borderTop: i === 0 ? 'none' : cell.borderTop }}>
                        <BucketDot bucket={bucket} />
                        {TRIP_DAY_LABEL[kind]}
                      </td>
                      <td style={{ ...right, borderTop: i === 0 ? 'none' : right.borderTop, fontWeight: kind === 'site' ? 700 : 400 }}>{hoursWords(h[bucket])} h</td>
                      <td style={{ ...right, borderTop: i === 0 ? 'none' : right.borderTop }}>{daysWords(row.dayCounts[kind])}</td>
                    </tr>
                  ))}
                  {h.noPlace > 0 ? (
                    <tr>
                      <td style={cell}>
                        <span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: bucketBackground('noPlace'), border: '1px solid var(--text-faint)', verticalAlign: -1, marginRight: 4, boxSizing: 'border-box' }} />
                        {TRIP_HOUR_BUCKET_LABEL.noPlace}
                      </td>
                      <td style={right}>{hoursWords(h.noPlace)} h</td>
                      <td style={right} />
                    </tr>
                  ) : null}
                  <tr>
                    <td style={{ ...cell, fontWeight: 700 }}>The trip</td>
                    <td style={{ ...right, fontWeight: 700 }}>{hoursWords(h.all)} h</td>
                    <td style={right}>{daysWords(row.dayCounts.days)}</td>
                  </tr>
                </tbody>
              </table>
              {row.standing !== 'planned' && row.dayCounts.site > 0 && h.site === 0 ? (
                <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--text-amber-800)' }} data-testid="trip-open-no-punch">
                  No punch at the site on this trip’s days. The days stand as painted.
                </p>
              ) : null}
            </>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{hoursState === 'read' ? '—' : TRIPS_HOURS_WORDS[hoursState]}</p>
          )}
          {evidence ? (
            <div data-testid="trip-open-shows">
              <div style={{ ...capStyle, marginTop: 12 }}>What shows it</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {tripEvidenceChips(evidence).map((c) => (
                  <span key={c.key} data-tone={c.tone} data-testid={`trip-shows-${c.key}`} style={evidenceChipStyle(c.tone)}>
                    {c.words}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {costLines ? (
            <div data-testid="trip-open-cost">
              <div style={{ ...capStyle, marginTop: 12 }}>
                {TRIP_COST_CAP} <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· {TRIP_COST_WHO}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: 6 }}>
                <tbody>
                  {costLines.map((l, i) => (
                    <tr key={l.key} data-testid={`trip-cost-${l.key}`}>
                      <td style={{ ...cell, borderTop: i === 0 ? 'none' : cell.borderTop, fontWeight: l.key === 'total' ? 700 : 400 }}>
                        {l.label}
                        {l.small ? <span style={label}> · {l.small}</span> : null}
                      </td>
                      <td style={{ ...right, borderTop: i === 0 ? 'none' : right.borderTop, fontWeight: l.key === 'total' && l.stands ? 700 : 400, color: l.stands ? undefined : 'var(--text-muted)' }}>{l.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
