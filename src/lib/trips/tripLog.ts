/**
 * The trip log on paper (punch list #379, PR 8): one page for a site, every trip oldest first, with its
 * days, where it stands, what it was for, who went and their days by kind, who asked and how, how it went,
 * the jobs its work goes on, its billing, and its hours when the clock is read. A totals line closes it.
 *
 * The paper is built from the Trips look's own model (`tripsLook.ts`), so it says what the screen says.
 * It carries no dollars at all, whoever prints it. Pure: `buildTripLog` makes the lines, `tripLogPrintHtml`
 * the page, and the card opens it through `printAndFile`, which files the page that printed.
 */
import { personDayCounts, TRIP_STANDING_LABEL, type TripDayCounts } from './tripDays'
import { TRIP_HOUR_BUCKET_LABEL, type SiteTripHours, type TripHours } from './tripHours'
import { TRIP_BILLING_LABEL, TRIP_BILLING_WORDS } from './tripRecord'
import { daysWords, hoursWords, tripSpanWords, type TripLookRow, type TripsLookModel } from './tripsLook'

export type TripLogLine = { label: string; words: string }

export type TripLogBlock = {
  id: string
  /** *Oct 29 to Nov 4, 2026 · Back*. */
  heading: string
  lines: TripLogLine[]
  /** Each person with their days by kind: *Luis: 4 days at the site, 2 on the road, 1 getting ready*. */
  people: string[]
}

export type TripLog = {
  siteName: string
  customerName: string | null
  /** *Printed Nov 17, 2026, 3:10 PM by Dana*. */
  stamp: string
  blocks: TripLogBlock[]
  /** The totals line's parts: the trips, the days at the site, and the site's five figures when read. */
  totals: string[]
  /** Why the hours are not on the paper, when they are not. */
  hoursNote: string | null
}

/** Why a page carries no hours, by where the clock's read stood when it was printed. */
export const TRIP_LOG_HOURS_NOTE: Readonly<Record<'reading' | 'closed' | 'failed', string>> = {
  reading: 'The clock was still being read when this was printed, so the hours are not on this page.',
  closed: 'The clock’s days are closed to the person who printed this, so the hours are not on this page.',
  failed: 'The clock would not read, so the hours are not on this page.',
}

/** A trip's days on paper, always with the year: paper is read in a later year than it was printed. */
export function tripSpanOnPaper(first: string, last: string): string {
  // Against a year no trip is in, the look's own words always say the year.
  return tripSpanWords(first, last, '0000-01-01')
}

/** A person's days by kind: *8 days at the site, 2 on the road, 1 getting ready*. */
export function dayKindsWords(c: Pick<TripDayCounts, 'site' | 'road' | 'ready'>): string {
  return [c.site ? `${daysWords(c.site)} at the site` : null, c.road ? `${c.road} on the road` : null, c.ready ? `${c.ready} getting ready` : null].filter(Boolean).join(', ') || 'no day yet'
}

const h = (label: string, hours: number): string => `${label} ${hoursWords(hours)} h`

/** A trip's hours in its four figures, and their sum: *At the site 20.5 h · … · 36.5 h in all*. */
export function tripHoursWords(hours: TripHours): string {
  return [h(TRIP_HOUR_BUCKET_LABEL.site, hours.site), h(TRIP_HOUR_BUCKET_LABEL.road, hours.road), h(TRIP_HOUR_BUCKET_LABEL.ready, hours.ready), h(TRIP_HOUR_BUCKET_LABEL.noPlace, hours.noPlace), `${hoursWords(hours.all)} h in all`].join(' · ')
}

/** The site's hours in the five figures, and their sum. */
export function siteHoursWords(hours: SiteTripHours): string {
  return [h(TRIP_HOUR_BUCKET_LABEL.site, hours.site), h(TRIP_HOUR_BUCKET_LABEL.road, hours.road), h(TRIP_HOUR_BUCKET_LABEL.ready, hours.ready), h(TRIP_HOUR_BUCKET_LABEL.noPlace, hours.noPlace), h(TRIP_HOUR_BUCKET_LABEL.home, hours.home), `${hoursWords(hours.all)} h on the site’s jobs`].join(' · ')
}

function askedWords(row: TripLookRow): string {
  const r = row.record
  if (r.askedBy === 'us') return 'Us'
  if (r.askedBy === 'them') {
    const said = [r.askedWho.trim(), r.askedHow.trim()].filter(Boolean)
    return said.length ? `Them: ${said.join(', ')}` : 'Them'
  }
  return 'Nobody has said'
}

function blockOf(row: TripLookRow, jobLabel: (jobId: string) => string | null): TripLogBlock {
  const r = row.record
  const when = row.span ? tripSpanOnPaper(row.span.first, row.span.last) : 'No day yet'
  const lines: TripLogLine[] = [
    { label: 'What for', words: r.purpose.trim() || 'Nobody has said' },
    { label: 'The days', words: row.dayCounts.days ? `${daysWords(row.dayCounts.days)}: ${dayKindsWords(row.dayCounts)}` : 'No day yet' },
    { label: 'Asked by', words: askedWords(row) },
    { label: 'How it went', words: r.outcome.trim() || (row.standing === 'back' ? 'Nobody has said' : 'Not back yet') },
    { label: 'Work goes on', words: r.jobIds.length ? r.jobIds.map((id) => jobLabel(id) ?? 'A job no longer on this site').join('; ') : 'No job named' },
    { label: 'Billing', words: row.billing ? `${TRIP_BILLING_LABEL[row.billing]}: ${TRIP_BILLING_WORDS[row.billing]}` : 'Nobody has said' },
  ]
  // A planned trip has no hours yet, and a trip's hours are said only once the clock is read.
  if (row.hours && row.standing !== 'planned') lines.push({ label: 'Hours', words: tripHoursWords(row.hours) })
  return {
    id: row.id,
    heading: `${when} · ${TRIP_STANDING_LABEL[row.standing]}`,
    lines,
    people: r.people.map((p) => `${p.name}: ${dayKindsWords(personDayCounts(p.days))}`),
  }
}

const tripsWords = (n: number): string => `${n} ${n === 1 ? 'trip' : 'trips'}`

/**
 * The paper's content from the look's model: the trips oldest first, then the totals. `hoursNote` says why
 * the hours are left off when the clock is not read, closed to the reader or would not read.
 */
export function buildTripLog(args: {
  model: TripsLookModel
  siteName: string
  customerName: string | null
  printedAt: string
  printedBy: string | null
  jobLabel: (jobId: string) => string | null
  hoursNote?: string | null
}): TripLog {
  const { band } = args.model
  // The look lists newest first; the log reads as it happened.
  const blocks = [...args.model.rows].reverse().map((row) => blockOf(row, args.jobLabel))
  const totals = [band.planned ? `${tripsWords(band.gone)} gone out, ${band.planned} planned` : `${tripsWords(band.gone)} gone out`, `${daysWords(band.siteDays)} at the site`]
  if (band.hours) totals.push(siteHoursWords(band.hours))
  return {
    siteName: args.siteName,
    customerName: args.customerName?.trim() || null,
    stamp: `Printed ${args.printedAt}${args.printedBy ? ` by ${args.printedBy}` : ''}`,
    blocks,
    totals,
    hoursNote: band.hours ? null : (args.hoursNote ?? null),
  }
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The print page: a portrait sheet, light whatever the screen's theme, a block a trip and the totals last. */
export function tripLogPrintHtml(log: TripLog): string {
  const blocks = log.blocks
    .map(
      (b) => `<section class="trip">
<h2>${esc(b.heading)}</h2>
<dl>
${b.lines.map((l) => `<dt>${esc(l.label)}</dt><dd>${esc(l.words)}</dd>`).join('\n')}
<dt>Who went</dt><dd>${b.people.length ? b.people.map(esc).join('<br>') : 'Nobody yet'}</dd>
</dl>
</section>`,
    )
    .join('\n')
  return `<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8"><title>${esc(log.siteName)} · trip log</title>
<style>
@page { size: letter portrait; margin: 14mm 12mm; }
body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 12px 16px; background: #ffffff; font-size: 11px; line-height: 1.4; }
.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; border-bottom: 1.5px solid #111827; padding-bottom: 4px; margin-bottom: 4px; }
h1 { font-size: 18px; margin: 0; }
.head span { font-size: 12px; color: #4b5563; }
.stamp { font-size: 9.5px; color: #6b7280; margin: 0 0 10px; }
.trip { break-inside: avoid; page-break-inside: avoid; border-bottom: 1px solid #d1d5db; padding: 8px 0; }
h2 { font-size: 13px; margin: 0 0 4px; }
dl { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 2px 10px; margin: 0; }
dt { color: #6b7280; }
dd { margin: 0; }
.totals { margin: 10px 0 0; font-weight: 700; }
.note { font-size: 10px; color: #6b7280; margin: 4px 0 0; }
</style></head><body>
<div class="head"><h1>${esc(log.siteName)} · trip log</h1><span>${esc(log.customerName ?? '')}</span></div>
<p class="stamp">${esc(log.stamp)}</p>
${blocks || '<p class="note">This site has no trip yet.</p>'}
<p class="totals">${log.totals.map(esc).join(' · ')}</p>
${log.hoursNote ? `<p class="note">${esc(log.hoursNote)}</p>` : ''}
<p class="note">A trip is a reading laid over the clock. It changes no clock row, bill or cost.</p>
</body></html>`
}
