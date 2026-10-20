/**
 * Messages, cut 8 (the portals): *Ready for Priya?*, the office's side panel beside the customer's page, lifted from
 * the Messages prototype (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html` v1.178: `portalReady`,
 * `portalSideHtml`; v1.164). One row per piece of the page: is there something to do, is this week's line fresh (older
 * than seven days reads as stale), are photos marked, does every pay application say what it covers, is the next one
 * sized, does every schedule move carry its why, are there two people to call, do the words read in both languages.
 * Each row names the page that feeds it, with *fix* or *change*. It never checks our numbers; those come from the
 * ledger. These words are the office's, in English.
 *
 * Changed from the prototype: the Words row reads the real gaps, the lines the office types for the customer (this
 * week's line, a pay application's covers line, a change order's description, a milestone, a move and its why, a
 * person's role) that have no Spanish yet, where the prototype always said yes; a customer off the flow gets one row,
 * since the page reads only a thank-you line; counts read in the singular when there is one. Since cut 8d: Photos reads
 * the daily log's photos link and the job's photos switch, as the page shows photos (8b-i), not a count of marked
 * photos; After that is asked only while the page sizes the next bill; Your move takes accepting the work. Pure.
 */

import { customerMoveWords, type CustomerMove } from '../flows/customerMove'
import { daysUntil, shortDate, weekdayDate } from '../gc/words'
import { openChanges, signedChanges, type CustomerChange } from './moneyLines'
import { nextAppSizeWords, type NextAppIn, type PayAppState } from './moneyStory'
import { lacksSpanish, type TypedLine } from './pageWords'

/** Where a fix press goes: the page that feeds the piece. */
export type ReadyFix = 'step' | 'flows' | 'log' | 'payApp' | 'forecast' | 'changeOrders' | 'schedule' | 'people' | 'words'

export interface ReadyRow {
  ok: boolean
  piece: string
  words: string
  /** "the daily log": where the piece comes from. */
  from: string
  fix: ReadyFix
}

export interface ReadinessIn {
  /** What we call them. */
  firstName: string
  off: boolean
  /** Their move as `customerMove` reads it, in English, or the work to accept. */
  move: CustomerMove | { kind: 'accept'; title: string }
  /** The step on now, by its English name. */
  nowStep: string | null
  today: string
  /**
   * This week's customer line on the daily log, and its photos: the log's photos link with the job's switch on
   * (`linked`), no link on the log (`none`), or the switch off (`off`).
   */
  week: { on: string; line: TypedLine; photos: WeekPhotos } | null
  apps: { n: number; covers: TypedLine | null; state: PayAppState }[]
  next: NextAppIn | null
  /** Whether the page sizes the next bill (After that); false leaves the row out. Unsaid: it does. */
  sizesNext?: boolean
  changes: CustomerChange[]
  schedule: { milestones: { name: TypedLine }[]; moves: { name: TypedLine; why: TypedLine | null }[] }
  people: { name: string; role: TypedLine }[]
}

export type WeekPhotos = 'linked' | 'none' | 'off'

const STALE_AFTER_DAYS = 7

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function and(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** The typed lines still waiting on their Spanish, each with the page where it is typed. */
function spanishGaps(input: ReadinessIn): { what: string; from: string; fix: ReadyFix }[] {
  const gaps: { what: string; from: string; fix: ReadyFix }[] = []
  if (lacksSpanish(input.week?.line)) gaps.push({ what: "this week's line", from: 'the daily log', fix: 'log' })
  for (const a of input.apps) if (lacksSpanish(a.covers)) gaps.push({ what: `pay application ${a.n}'s covers line`, from: 'the pay application', fix: 'payApp' })
  for (const c of input.changes) if (lacksSpanish(c.description)) gaps.push({ what: `change order ${c.number}'s description`, from: 'Change orders', fix: 'changeOrders' })
  for (const m of input.schedule.milestones) if (lacksSpanish(m.name)) gaps.push({ what: `the milestone ${m.name.en}`, from: 'the schedule', fix: 'schedule' })
  for (const m of input.schedule.moves) {
    if (lacksSpanish(m.name)) gaps.push({ what: `the move ${m.name.en}`, from: 'the schedule', fix: 'schedule' })
    if (lacksSpanish(m.why)) gaps.push({ what: `the why on ${m.name.en}`, from: 'the schedule', fix: 'schedule' })
  }
  for (const p of input.people) if (lacksSpanish(p.role)) gaps.push({ what: `${p.name}'s role`, from: "the job's people", fix: 'people' })
  return gaps
}

/** The readiness list for one customer's page on one job. */
export function portalReady(input: ReadinessIn): ReadyRow[] {
  const first = input.firstName
  if (input.off) {
    return [{ ok: true, piece: 'Your move', words: `${first} is off the flow. The page reads a thank-you line and the thread.`, from: 'the flow', fix: 'flows' }]
  }
  const rows: ReadyRow[] = []
  const now = input.nowStep
  rows.push({
    ok: true,
    piece: 'Your move',
    words:
      input.move.kind === 'none'
        ? `Nothing owed. ${first} reads that we are on ${now ?? 'the next step'}.`
        : input.move.kind === 'accept'
          ? `${input.move.title}.`
          : customerMoveWords(input.move),
    from: now ? 'the step' : 'the flow',
    fix: now ? 'step' : 'flows',
  })

  const w = input.week
  const age = w ? daysUntil(input.today, w.on) : null
  rows.push({
    ok: !!w && age !== null && age <= STALE_AFTER_DAYS,
    piece: 'This week',
    words: !w
      ? 'No customer line on the log yet. The card would not show.'
      : age !== null && age <= STALE_AFTER_DAYS
        ? `A customer line from ${weekdayDate(w.on)}.`
        : `The last customer line is ${age} days old. ${first} would read stale news.`,
    from: 'the daily log',
    fix: 'log',
  })
  if (w?.photos === 'off') {
    rows.push({ ok: true, piece: 'Photos', words: 'Photos are off for this job.', from: 'Settings → Customer page', fix: 'words' })
  } else {
    rows.push({
      ok: w?.photos === 'linked',
      piece: 'Photos',
      words: w?.photos === 'linked' ? 'This week’s line links to the job’s photos.' : 'No photos link on this week’s log. The card shows words only.',
      from: 'the daily log',
      fix: 'log',
    })
  }

  if (input.apps.length) {
    const bare = input.apps.filter((a) => !a.covers || !a.covers.en.trim()).map((a) => a.n).sort((p, q) => p - q)
    const withArchitect = input.apps.filter((a) => a.state === 'architect').length
    rows.push({
      ok: bare.length === 0,
      piece: 'Pay applications',
      words: bare.length
        ? `${bare.length === 1 ? 'Pay application' : 'Pay applications'} ${and(bare.map(String))} ${bare.length === 1 ? 'has' : 'have'} no customer sentence. ${first} would see a number with nothing it bought.`
        : `Every application says what it covers.${withArchitect ? ` ${withArchitect} ${withArchitect === 1 ? 'is' : 'are'} with the architect.` : ''}`,
      from: 'the pay application',
      fix: 'payApp',
    })
  }

  if (input.sizesNext !== false) rows.push({
    ok: !!input.next,
    piece: 'After that',
    words: input.next
      ? `The next application is sized, ${nextAppSizeWords(input.next.bill)}, ${shortDate(input.next.aboutOn)}.`
      : `No next application sized. ${first} would get no warning before the bill.`,
    from: 'the schedule of values',
    fix: 'forecast',
  })

  const open = openChanges(input.changes)
  rows.push({
    ok: true,
    piece: 'Change orders',
    words: open.length ? `${open.length} waiting on ${first}, with the amount and the days.` : `None open. ${signedChanges(input.changes).length} signed, in the sum.`,
    from: 'Change orders',
    fix: 'changeOrders',
  })

  const { milestones, moves } = input.schedule
  const noWhy = moves.filter((m) => !m.why || !m.why.en.trim()).length
  rows.push({
    ok: milestones.length > 0 && noWhy === 0,
    piece: 'Schedule',
    words: !milestones.length
      ? 'No milestones. The tab would be empty.'
      : noWhy
        ? `${noWhy === 1 ? 'A move has' : `${noWhy} moves have`} no why. ${first} would see a date change and no reason.`
        : `${plural(milestones.length, 'milestone', 'milestones')}${moves.length ? `, ${moves.length === 1 ? '1 move with its why' : `${moves.length} moves, each with its why`}` : ''}.`,
    from: 'the schedule',
    fix: 'schedule',
  })

  rows.push({
    ok: input.people.length >= 2,
    piece: 'Your people',
    words: input.people.length >= 2 ? `${input.people.map((p) => p.name).join(', ')}.` : `Fewer than two names. ${first} would not know who to call.`,
    from: "the job's people",
    fix: 'people',
  })

  const gaps = spanishGaps(input)
  rows.push({
    ok: gaps.length === 0,
    piece: 'Words',
    words: gaps.length
      ? `${and(gaps.map((g) => g.what)).replace(/^./, (c) => c.toUpperCase())} ${gaps.length === 1 ? 'has' : 'have'} no Spanish yet. ${first} would read English there.`
      : 'Every sentence of ours reads in English and Spanish.',
    from: gaps[0]?.from ?? 'Settings → Customer page',
    fix: gaps[0]?.fix ?? 'words',
  })
  return rows
}

/** The panel's heading: "Ready for Priya?" with "all set" or "1 thing to fix". */
export function readyTitle(firstName: string, rows: ReadyRow[]): { title: string; state: string; good: boolean } {
  const bad = rows.filter((r) => !r.ok).length
  return { title: `Ready for ${firstName}?`, state: bad ? `${plural(bad, 'thing', 'things')} to fix` : 'all set', good: bad === 0 }
}
