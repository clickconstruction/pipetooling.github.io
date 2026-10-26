/**
 * What a Quickfill station holds (punch list #187, PR 5): the card behind the ? on a station's question
 * line, one legend per station built from the registry, so thirty-two stations share one kernel and
 * not thirty-two hand-written cards. The question itself is not repeated: it is printed right above the
 * ?. The rows say what the rest of the station is; the door is the station's own guide where it has one,
 * else *run the office day with Quickfill*. Held by `deskLegends.test.ts` for every station. Pure.
 */
import type { DeskLegend, LegendRow } from '../help/deskLegend'
import { QUICKFILL_SECTIONS } from './sections'

export const QUICKFILL_GUIDE = { slug: 'quickfill', title: 'run the office day with Quickfill' } as const

/** One dot for every station: a person who pressed one station's ? knows where the others are. */
export const STATION_LEGEND_PRESSED_KEY = 'quickfill-station'

/** A station with a guide of its own; the rest door to the Quickfill guide. */
export const STATION_GUIDES: Readonly<Record<string, { slug: string; title: string }>> = {
  'needs-you': { slug: 'needs-you-card', title: 'work the Needs you list on the dashboard' },
  'people-hours-new': { slug: 'approve-my-teams-hours', title: "approve my team's hours" },
  'unassigned-field-time': { slug: 'match-clock-sessions', title: 'match clock sessions to jobs and bids' },
  'vehicle-odometers': { slug: 'manage-company-vehicles', title: 'manage company vehicles and track their odometers' },
  'banking-sorting': { slug: 'sort-the-bank-feed', title: 'sort the bank feed' },
  'billed-awaiting': { slug: 'chase-late-payments', title: 'chase late payments with call mode' },
  'jobs-billing': { slug: 'ready-to-bill-pipeline', title: 'bill a customer and get paid' },
  'complete-no-bill': { slug: 'ready-to-bill-pipeline', title: 'bill a customer and get paid' },
  'property-kinds': { slug: 'mark-property-kinds-from-quickfill', title: 'mark property kinds from Quickfill' },
  'percent-complete': { slug: 'fix-a-jobs-percent-done-in-quickfill', title: "fix a job's percent done in Quickfill" },
  'field-photos': { slug: 'move-field-photos-to-google-drive', title: 'move field photos to google drive' },
  schedule: { slug: 'schedule-dispatch', title: 'schedule people onto jobs' },
  'tomorrow-schedule': { slug: 'schedule-dispatch', title: 'schedule people onto jobs' },
  'email-inbox': { slug: 'choose-which-mail-quickfill-counts', title: 'choose which mail quickfill counts' },
  'physical-inbox': { slug: 'clear-the-physical-inbox', title: 'clear the physical inbox' },
  'supply-houses': { slug: 'mark-an-invoice-on-a-job-account', title: 'mark an invoice as on a job account' },
}

/** The rows every station shares. */
export const STATION_ROWS: readonly LegendRow[] = [
  { key: 'question', label: 'The question', accent: '#2563eb', note: 'The line beside this ? says what up to date means on this station.' },
  { key: 'count', label: 'The count', note: 'Items waiting on someone in the office. A dash means the station has no count.' },
  { key: 'next', label: 'The Next line', note: 'The first row to act on and its verb.' },
  { key: 'presses', label: 'The three presses', accent: '#059669', note: 'Done when nothing is left, Worked it when rows are left, Not sure to ask the owner.' },
  { key: 'colors', label: 'The colors', accent: '#d97706', note: 'Red is never marked or past due, yellow is due today, green is looked at and not due.' },
  { key: 'history', label: 'Mark history', note: 'Eight weeks of looks, behind the chart icon.' },
]

/** The legend for one station: the shared rows and the station's door. */
export function stationLegend(sectionId: string): DeskLegend {
  const meta = QUICKFILL_SECTIONS.find((s) => s.sectionId === sectionId)
  return {
    key: `quickfill-${sectionId}`,
    label: meta ? `What this station holds: ${meta.label}` : 'What this station holds',
    rows: [...STATION_ROWS],
    guide: STATION_GUIDES[sectionId] ?? QUICKFILL_GUIDE,
  }
}

/** Every station's legend, for the test that holds them all. */
export function allStationLegends(): DeskLegend[] {
  return QUICKFILL_SECTIONS.map((s) => stationLegend(s.sectionId))
}
