/**
 * The releases ride the run (punch list #435, piece 5; the office's call of 2026-11-26: *releases print in the day's
 * run*). A release of a filed lien is made on the Release of record tab, where money holds it. From there it has four
 * acts, and the run's *Out the door* step (`lienRunOut.ts`, punch list #362) lists every saved release under the one
 * it is on:
 *
 *   - `print`   — saved, and the run has not printed it for the notary. One press prints every ready one.
 *   - `notary`  — printed, and no notary's day is on it. The day is typed where it sits.
 *   - `county`  — notarized, and the county has not recorded it. The press opens the tab's stamp.
 *   - `copies`  — recorded in the last thirty days, and no copies are on record. The day is typed where it sits.
 *
 * A release the county recorded more than thirty days ago with no copies on record is left alone: the fact is new,
 * and a release from before it would otherwise stand open for ever.
 *
 * **Held.** A release never goes out on money that is not there. One whose check the bank sent back
 * (`payoffReturned.ts`) is held on every act before the county's, and so is one whose job's bills owe again when it
 * was not released on a typed reason (*short*). A held release does not print: the press counts the ready ones and
 * says what it held (`batchWords`), and it is dead only when none is ready.
 *
 * Pure: the Payoffs facts in (`lienPayoffIo.ts`), the lines out. Every sentence keeps to `plainWords.ts` and marks its
 * values with `val`. The three facts are `lienReleaseFacts.ts`, the writes and the print `lienReleaseRunIo.ts`, the
 * screen `LienRunReleases.tsx`.
 */
import { batchWords, type BatchWords } from '../batchWords'
import { moneyWords } from '../moneyParts'
import { val } from '../valuesInPlace'
import { formatYmdMonthDay } from './billedExpectedPay'
import { lienPayoffPlaces, type LienPayoffFacts } from './lienPayoff'
import { RELEASE_COPIES_ASK_DAYS, releaseByYmd, releaseFacts, releaseRunStage, type ReleaseFacts, type ReleaseRunStage } from './lienReleaseFacts'

export { RELEASE_COPIES_ASK_DAYS, releaseRunStage, type ReleaseRunStage }

export const RELEASE_RUN_WORDS = {
  head: 'Releases',
  lead: 'A release is made on its lien in Payoffs. From here it is printed, notarized, recorded and sent.',
  stages: { print: 'Print for the notary', notary: 'At the notary', county: 'Record at the county', copies: 'Send the copies' } as Record<ReleaseRunStage, string>,
  stageLead: {
    print: 'One print, a release a sheet. The leader signs each before a notary.',
    notary: 'Type the day each was notarized when it comes back.',
    county: 'Take them to the county clerk. Type the stamp on each once the clerk records it.',
    copies: 'Mail each stamped copy to the payer. Type the day they went.',
  } as Record<ReleaseRunStage, string>,
  notarized: 'Notarized',
  notarizedLabel: 'the day it was notarized',
  copies: 'Copies sent',
  copiesLabel: 'the day the stamped copies were sent',
  notYet: 'not yet',
  countyPress: 'Record the county’s stamp ›',
  openPress: 'Open the release ›',
  futureDay: 'That day is still to come.',
  beforeMade: 'A release cannot be notarized before it was made.',
  beforeRecorded: 'The copies cannot go before the county recorded the release.',
  popup: 'The print window was blocked. Allow pop-ups for this site, then print again.',
  kept: 'The release took the change.',
  failed: 'The release did not take the change.',
} as const

export type ReleaseRunLine = {
  releaseId: string
  affidavitId: string
  jobId: string
  jobNumber: string
  jobName: string
  /** The property, as its place reads in Payoffs. */
  place: string
  /** The lien's own instrument number, or ''. */
  instrument: string
  stage: ReleaseRunStage
  /** Why it is held, with its values marked. Null when it may go. */
  held: string | null
  heldKind: 'short' | 'came_back' | null
  facts: ReleaseFacts
  /** The release row's `fields` as read: the paper, and what a write keeps. */
  fields: unknown
  /** The day the release was saved. */
  madeYmd: string
  /** The day the county recorded it, on `copies` alone. */
  recordedYmd: string | null
  /** What is known of the act before this one, with its values marked: *Printed Nov 26 by Alex Rivera.* '' with nothing to say. */
  note: string
}

export type LienReleaseRun = {
  /** A saved release has an act left: the card is drawn. */
  show: boolean
  lines: Record<ReleaseRunStage, ReleaseRunLine[]>
  /** The print press: its words, the releases it prints and the ones it holds. */
  print: BatchWords & { ready: ReleaseRunLine[]; held: ReleaseRunLine[] }
  /** *⟪3⟫ to print · ⟪1⟫ at the notary · ⟪2⟫ to record · ⟪1⟫ to send*, each value marked; a zero is left out. */
  tally: string
}

const field = (fields: unknown, key: string): string => {
  if (!fields || typeof fields !== 'object') return ''
  const v = (fields as Record<string, unknown>)[key]
  return typeof v === 'string' ? v.trim() : ''
}
const count = (n: number) => val('count', String(n))
const day = (ymd: string) => val('day', formatYmdMonthDay(ymd))

/** Why a day typed for the notary cannot be kept, or null. */
export function notarizedDayCheck(draft: string, madeYmd: string, todayYmd: string): string | null {
  if (!draft) return null
  if (draft > todayYmd) return RELEASE_RUN_WORDS.futureDay
  if (madeYmd && draft < madeYmd) return RELEASE_RUN_WORDS.beforeMade
  return null
}

/** Why a day typed for the copies cannot be kept, or null. */
export function copiesDayCheck(draft: string, recordedYmd: string | null, todayYmd: string): string | null {
  if (!draft) return null
  if (draft > todayYmd) return RELEASE_RUN_WORDS.futureDay
  if (recordedYmd && draft < recordedYmd) return RELEASE_RUN_WORDS.beforeRecorded
  return null
}

const STAGES: ReadonlyArray<ReleaseRunStage> = ['print', 'notary', 'county', 'copies']

/** Every saved release with an act left, under the act it is on. */
export function buildLienReleaseRun(facts: LienPayoffFacts): LienReleaseRun {
  const releaseById = new Map(facts.releases.map((r) => [r.id, r]))
  const lines: Record<ReleaseRunStage, ReleaseRunLine[]> = { print: [], notary: [], county: [], copies: [] }
  for (const place of lienPayoffPlaces(facts)) {
    for (const row of place.rows) {
      const release = row.step.releaseId ? releaseById.get(row.step.releaseId) : undefined
      if (!release) continue
      const stage = releaseRunStage(release, facts.todayYmd)
      if (!stage) continue
      const f = releaseFacts(release.fields)
      const owes = row.open > 0.004
      let held: string | null = null
      let heldKind: ReleaseRunLine['heldKind'] = null
      // The county's record stands whatever the money does: only the acts before it are held.
      if (stage !== 'copies') {
        if (row.step.moneyBack) {
          held = 'Held. The check behind it came back.'
          heldKind = 'came_back'
        } else if (owes && !field(release.fields, 'releasedUnpaidReason')) {
          held = `Held. ${val('money', moneyWords(row.open))} is open on this job’s bills again.`
          heldKind = 'short'
        }
      }
      const note =
        stage === 'notary' && f.printed
          ? `Printed ${day(releaseByYmd(f.printed))}${f.printed.name ? ` by ${val('who', f.printed.name)}` : ''}.`
          : stage === 'county' && f.notarizedYmd
            ? `Notarized ${day(f.notarizedYmd)}.`
            : stage === 'copies' && release.filed_at
              ? `Recorded ${day(release.filed_at.slice(0, 10))}${field(release.fields, 'releaseInstrument') ? ` as ${val('instrument', field(release.fields, 'releaseInstrument'))}` : ''}.`
              : ''
      lines[stage].push({
        releaseId: release.id,
        affidavitId: row.affidavitId,
        jobId: row.jobId,
        jobNumber: row.jobNumber,
        jobName: row.jobName,
        place: place.place,
        instrument: row.instrument,
        stage,
        held,
        heldKind,
        facts: f,
        fields: release.fields ?? null,
        madeYmd: releaseByYmd({ by: '', name: '', at: release.created_at }),
        recordedYmd: release.filed_at ? release.filed_at.slice(0, 10) : null,
        note,
      })
    }
  }
  for (const s of STAGES) lines[s].sort((a, b) => a.place.localeCompare(b.place) || a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true }) || a.instrument.localeCompare(b.instrument))

  const ready = lines.print.filter((l) => !l.held)
  const held = lines.print.filter((l) => l.held)
  const allShort = held.length > 0 && held.every((l) => l.heldKind === 'short')
  const words = batchWords({ verb: 'Print', ready: ready.length, held: held.length, heldWhy: allShort ? { one: 'is short', many: 'are short' } : { one: 'is held', many: 'are held' }, noun: ['release for the notary', 'releases for the notary'] })

  const tally = [
    lines.print.length > 0 ? `${count(lines.print.length)} to print` : '',
    lines.notary.length > 0 ? `${count(lines.notary.length)} at the notary` : '',
    lines.county.length > 0 ? `${count(lines.county.length)} to record` : '',
    lines.copies.length > 0 ? `${count(lines.copies.length)} to send` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return { show: STAGES.some((s) => lines[s].length > 0), lines, print: { ...words, ready, held }, tally }
}
