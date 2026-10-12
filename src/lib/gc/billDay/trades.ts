/**
 * Messages, cut 9 (wave 1, helper 7): Bill day → From the trades, for one job. The days from the 25th and the cut-off,
 * one row per trade with a signed statement of work, the seven gates that say whether the pay application can go, and
 * the groups the rows sit in. Lifted from the Messages prototype v1.178 (`drawsFor`, `gatesFor`, `gateShorts`,
 * `renderMoney`'s cascade and groups) on branch spike/gc-mode, to-dos/gc-mode/messages/prototype.html. It reads main's
 * draws as `drawRows.ts` lays them over each statement of work, the waivers and certificates of `ownerBilling.ts`, and
 * the schedule's bars through `billingForecast.ts`; it keeps none of its own. The money on a row is the money team's.
 */
import { forecastPct } from '../billingForecast'
import { addDays, drawMoney, payApplication, sentBackOpen, tradeChangesFor, workAllBilled, type TradeChange } from '../building'
import { partnerById } from '../lookups'
import { appCertified, owedDrawWords, ownerPayApp, ownerPayAppsSent } from '../ownerBilling'
import { PAY_WITHIN_DAYS } from '../portal'
import type { Draw, DrawSentBack, GcProject, GcState, Sow, TradePackage } from '../types'
import { daysUntil, money, shortDate, weekdayDate } from '../words'
import { askedOf } from './lines'
import { checkedGateClear, underClaim, walkCounts, type ClaimToCheck } from './walk'

/** The cut-off: the trades' pay applications are due this many days before bill day (cut 9's `bill_day_cutoff_days`). */
export const BILL_DAY_CUTOFF_DAYS = 6

/** The walk is done this many days before bill day, so the office has a day to send back what it doubts. */
export const CHECK_BY_DAYS = 2

export interface BillDayDates {
  /** The owner's pay application this bill day makes. */
  number: number
  billDay: string
  /** The day it goes: bill day, or the Monday after when bill day falls on a weekend. */
  goesOn: string
  /** Trades by: the cut-off. */
  cutoff: string
  cutoffDays: number
  /** The checking days, from the cut-off through two days before bill day. */
  checkFrom: string
  checkBy: string
  /** The first day of this period: the day after last month's cut-off. A draw asked on or after it is this period's. */
  periodFrom: string
  /** The bill day plus the owner's usual days to pay. Null: neither is known. */
  ownerPaysBy: string | null
  /** A draw approved by bill day is paid within this many days of its approval. */
  tradesPaidWithin: number
}

/** The same day a month earlier: last period's bill day. */
function monthBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 2, d ?? 1)).toISOString().slice(0, 10)
}

/** The day itself, or the Monday after when it is a Saturday or a Sunday. */
function weekdayOnOrAfter(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const day = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
  return day === 6 ? addDays(iso, 2) : day === 0 ? addDays(iso, 1) : iso
}

/** Bill day's dates for a job, from the owner's pay application that bill day makes and the cut-off setting. */
export function billDayDates(state: GcState, project: GcProject, cutoffDays = BILL_DAY_CUTOFF_DAYS): BillDayDates {
  const app = ownerPayApp(state, project)
  const billDay = app.billOn
  const cutoff = addDays(billDay, -cutoffDays)
  return {
    number: app.number,
    billDay,
    goesOn: weekdayOnOrAfter(billDay),
    cutoff,
    cutoffDays,
    checkFrom: cutoff,
    checkBy: addDays(billDay, -CHECK_BY_DAYS),
    periodFrom: addDays(monthBefore(billDay), -cutoffDays + 1),
    ownerPaysBy: app.expectPaidOn,
    tradesPaidWithin: PAY_WITHIN_DAYS,
  }
}

/** Where a trade's draw stands this period. */
export type TradeDrawState = 'back' | 'notin' | 'waiting' | 'approved' | 'closing'

/** A trade said it sends nothing this period (cut 9's `bill_day_nothing`). Recorded with who said it, never typed over a draw. */
export interface NothingThisPeriod {
  /** The statement of work's id (`gc_sows.id`). */
  sowId: string
  /** The bill day it is for. */
  periodTo: string
  saidBy: string
  at: string
}

export interface TradeDraw {
  packageId: string
  trade: string
  partnerId: string | null
  company: string
  /** Their contact, as the company has it. Empty: none. */
  person: string
  sow: Sow
  state: TradeDrawState
  /** On a trade not in: it said it sends nothing this period. The gates count it as in. */
  nothing: NothingThisPeriod | null
  /** The draw this row is about: the one in, the one sent back, or the next one. */
  number: number
  first: boolean
  /** The draw waiting on us, approved this period, or the final one closing out. Null: not in, or sent back. */
  draw: Draw | null
  back: DrawSentBack | null
  /** What it asks, after retainage and before any back-charge. Null: not in. */
  asked: number | null
  /** What we approved, after retainage and back-charges. Null: not approved this period. */
  approved: number | null
  /** What the schedule says this draw comes to by bill day, after retainage. */
  expected: number
  /** The lines the schedule moves by bill day, in words. Empty: no bar moves one. */
  expectedWords: string
  /** The day it came in, or the day we sent it back. */
  since: string | null
  /** Their draw before this one. Null: this is their first. */
  last: Draw | null
  /** Draws we paid whose unconditional waiver they still owe (`tradeWaiverChecks`' rule). */
  owedUnconditional: { draw: number; amount: number; final: boolean; paidOn: string | null }[]
  /** Their change orders signed both ways, and the ones not yet: those are held out of any draw. */
  changes: TradeChange[]
}

/** The schedule's own percent on a line by a day: its bar from start to finish, whatever was reported. Null: no bar. */
export function scheduleSays(project: GcProject, sovId: string, on: string): number | null {
  const bar = project.schedule?.activities.find((a) => a.lineId === sovId)
  return bar ? forecastPct(bar.start, bar.finish, 0, addDays(bar.start, -1), on) : null
}

/** What the schedule says draw `number` comes to by bill day: each line with a bar at the bar's percent, the rest where they were billed. */
function expectedDraw(project: GcProject, sow: Sow, number: number, billDay: string): { net: number; words: string } {
  const before: Sow = { ...sow, draws: sow.draws.filter((d) => d.number < number) }
  const toPct: Record<string, number> = {}
  for (const line of sow.sov) {
    const pct = scheduleSays(project, line.id, billDay)
    if (pct !== null) toPct[line.id] = pct
  }
  const app = payApplication(before, number, toPct)
  const moving = app.lines.filter((l) => l.thisPeriod > 0.5)
  const words = moving
    .slice(0, 2)
    .map((l) => `${l.label} ${Math.round(l.pct)}% by ${shortDate(billDay)}`)
    .join(', ')
  return { net: Math.max(0, drawMoney(before, app).net), words: moving.length > 2 ? `${words}, and ${moving.length - 2} more` : words }
}

/**
 * One row per trade with a signed statement of work on the job: sent back, not in, waiting on us, approved this period,
 * or closing out. A trade whose work is all billed, with no final pay application in, has nothing to draw this period.
 */
export function tradeDraws(state: GcState, project: GcProject, dates: BillDayDates, nothing: NothingThisPeriod[] = []): TradeDraw[] {
  const rows: TradeDraw[] = []
  for (const pkg of project.packages) {
    const sow = pkg.sow
    if (pkg.selfPerform || !sow || sow.status !== 'signed') continue
    const finals = sow.draws.filter((d) => d.final)
    if (finals.some((d) => d.status === 'paid')) continue
    const closing = finals.find((d) => d.status !== 'paid') ?? null
    const progress = [...sow.draws].filter((d) => !d.final).sort((a, b) => a.number - b.number)
    const newest = progress[progress.length - 1] ?? null
    const back = closing ? null : sentBackOpen(sow)
    const thisPeriod = (d: Draw) => d.requestedOn >= dates.periodFrom && d.requestedOn <= dates.billDay
    const state_: TradeDrawState | null = closing
      ? 'closing'
      : back
        ? 'back'
        : newest?.status === 'requested'
          ? 'waiting'
          : newest && thisPeriod(newest)
            ? 'approved'
            : workAllBilled(sow)
              ? null
              : 'notin'
    if (!state_) continue
    const draw = state_ === 'closing' ? closing : state_ === 'waiting' || state_ === 'approved' ? newest : null
    const number = draw?.number ?? back?.draw.number ?? sow.draws.length + 1
    const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
    const partner = invite ? partnerById(state, invite.partnerId) : undefined
    // A final pay application releases retainage: the schedule expects nothing of it.
    const expected = state_ === 'closing' ? { net: 0, words: '' } : expectedDraw(project, sow, number, dates.billDay)
    const sowKey = sow.id ?? pkg.id
    rows.push({
      packageId: pkg.id,
      trade: pkg.trade,
      partnerId: partner?.id ?? null,
      company: partner?.company ?? pkg.trade,
      person: partner?.contact ?? '',
      sow,
      state: state_,
      nothing: state_ === 'notin' ? (nothing.find((n) => n.sowId === sowKey && n.periodTo === dates.billDay) ?? null) : null,
      number,
      first: number === 1,
      draw,
      back,
      asked: draw ? askedOf(draw).net : back ? askedOf(back.draw).net : null,
      approved: state_ === 'approved' && draw ? draw.net : null,
      expected: expected.net,
      expectedWords: expected.words,
      since: state_ === 'waiting' ? (draw?.requestedOn ?? null) : state_ === 'back' ? (back?.on ?? null) : null,
      last: progress.filter((d) => d.number < number).pop() ?? null,
      owedUnconditional: sow.draws
        .filter((d) => d.status === 'paid' && d.waiver === 'conditional')
        .map((d) => ({ draw: d.number, amount: d.net, final: d.final === true, paidOn: d.paidOn ?? null })),
      changes: tradeChangesFor(project, pkg),
    })
  }
  return rows
}

/** The draws the walk checks: the ones waiting on us. A draw sent back is out for a fix; its resend is walked when it comes. */
export function walkDraws(rows: TradeDraw[]): { packageId: string; company: string; sow: Sow; draw: Draw }[] {
  return rows.flatMap((r) => (r.state === 'waiting' && r.draw ? [{ packageId: r.packageId, company: r.company, sow: r.sow, draw: r.draw }] : []))
}

/** The not-in rows the office still waits on: not in, and not said to send nothing. */
export function notInRows(rows: TradeDraw[]): TradeDraw[] {
  return rows.filter((r) => r.state === 'notin' && !r.nothing)
}

export type GateKey = 'allIn' | 'nothingBack' | 'checked' | 'conditional' | 'unconditional' | 'changeOrders' | 'lastCertificate'

/** A gate's press: what it does, its words, and the trade it is for. */
export type GateAct =
  | { kind: 'askNotIn'; label: string; packageIds: string[] }
  | { kind: 'remind'; label: string; packageId: string }
  | { kind: 'openLines'; label: string; packageId: string }
  | { kind: 'askSuperintendent'; label: string }
  | { kind: 'askWaiver'; label: string; packageId: string }

export interface BillDayGate {
  key: GateKey
  ok: boolean
  /** Open, and the move is ours: a check still to make. */
  waiting: boolean
  text: string
  small: string
  /** The gate as one short line for Today. */
  short: string
  acts: GateAct[]
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The seven gates the pay application waits on, in the prototype's order. `items` are the walk's claims to check. */
export function billDayGates(
  project: GcProject,
  rows: TradeDraw[],
  dates: BillDayDates,
  today: string,
  items: ClaimToCheck[],
  superintendent: string | null,
): BillDayGate[] {
  const counted = rows.filter((r) => r.state !== 'closing' && !r.nothing)
  const notin = notInRows(rows)
  const back = rows.filter((r) => r.state === 'back')
  const waiting = rows.filter((r) => r.state === 'waiting')
  const conditionalIn = counted.filter((r) => r.state !== 'notin')
  const owing = rows.filter((r) => r.owedUnconditional.length > 0)
  const walker = superintendent ?? 'The superintendent'

  const backSmall = back.map((r) => `${r.company}'s draw ${r.number} went back ${weekdayDate(r.since)}. ${sentence(r.back?.note ?? '')}`.trim()).join(' ')

  const checkedSmall = waiting
    .map((r) => {
      const mine = items.filter((i) => i.drawId === r.draw?.id)
      const { left, needs } = walkCounts(mine)
      const under = mine.filter(underClaim)
      const head = `${r.company}'s draw ${r.number} has waited on us ${plural(r.since ? daysUntil(today, r.since) : 0, 'day')}.`
      if (left) return `${head} ${plural(left, 'line')} ${left === 1 ? 'is' : 'are'} not walked yet.`
      if (needs) return `${head} ${plural(needs, 'line')} under the claim ${needs === 1 ? 'needs' : 'need'} a photo or a note.`
      if (under.length) return `${head} ${plural(under.length, 'line')} ${under.length === 1 ? 'is' : 'are'} under the claim, with the photo or the note.`
      return `${head} Every line is walked.`
    })
    .join(' ')

  const mineToCheck = items.filter((i) => waiting.some((r) => r.draw?.id === i.drawId))
  const checked = waiting.length === 0 || checkedGateClear(mineToCheck)
  const lastTap = mineToCheck.reduce<string | null>((n, i) => (i.at && (!n || i.at > n) ? i.at : n), null)
  const walkedLine = checked && lastTap ? `${walker} walked them ${weekdayDate(lastTap.slice(0, 10))}.` : `${walker} walks them by ${weekdayDate(dates.checkBy)}.`

  const heldOut = rows.flatMap((r) => r.changes.filter((c) => c.state !== 'signed').map((c) => ({ r, c })))
  const signedNow = rows.flatMap((r) =>
    r.changes.filter((c) => c.state === 'signed' && (c.co.tradeChange?.signedOn ?? '') >= dates.periodFrom).map((c) => ({ r, c })),
  )
  // A draw claims only lines of its statement of work, and a change order is a line only once both sides signed it.
  const billedUnsigned = rows.some((r) =>
    (r.draw?.lines ?? []).some((l) => {
      const coId = r.sow.sov.find((s) => s.id === l.sovId)?.changeOrderId
      return coId !== undefined && r.changes.some((c) => c.co.id === coId && c.state !== 'signed')
    }),
  )
  const waitsOn = (c: TradeChange) => (c.state === 'owner' ? "the customer's signature" : c.state === 'toSend' ? 'us to send it to the trade' : "the trade's signature")
  const coSmall = [
    ...signedNow.map(({ r, c }) => `${r.company}'s CO ${c.co.number} for ${money(c.co.cost)} is signed.`),
    ...heldOut.map(({ r, c }) => `${r.company}'s CO ${c.co.number} for ${money(c.co.cost)} waits on ${waitsOn(c)}. It is held out until then.`),
  ].join(' ')

  const sent = ownerPayAppsSent(project).filter((a) => a.periodTo < dates.billDay)
  const last = sent[sent.length - 1]
  const certified = last ? appCertified(last) : null
  const by = project.architect ? ` by ${project.architect}` : ''
  const certSmall = !last
    ? 'This is the first pay application on the job.'
    : certified === null
      ? `Pay application ${last.number} still waits on ${project.architect || 'the architect'} to certify.`
      : `Pay application ${last.number} was certified ${Math.abs(certified - last.due) < 0.5 ? 'in full' : `for ${money(certified)}`}${by}. ${last.paidOn ? `It was paid ${shortDate(last.paidOn)}.` : 'It is not paid yet.'}`

  const firstOwing = owing[0]
  return [
    {
      key: 'allIn',
      ok: notin.length === 0,
      waiting: false,
      text: 'Every trade is in, or said nothing this period.',
      small: notin.length ? `${notin.length} not in: ${notin.map((r) => r.company).join(', ')}. Due ${weekdayDate(dates.cutoff)}.` : 'Every trade is in or said nothing.',
      short: notin.length ? `Ask the ${notin.length} not in · due ${weekdayDate(dates.cutoff)}` : '',
      acts: notin.length ? [{ kind: 'askNotIn', label: `Ask the ${notin.length} not in`, packageIds: notin.map((r) => r.packageId) }] : [],
    },
    {
      key: 'nothingBack',
      ok: back.length === 0,
      waiting: false,
      text: 'Nothing is sent back.',
      small: back.length ? backSmall : 'Nothing is out for a fix.',
      short: back[0] ? `${back[0].company}'s draw, sent back ${weekdayDate(back[0].since)}` : '',
      acts: back[0] ? [{ kind: 'remind', label: `Remind ${back[0].company}`, packageId: back[0].packageId }] : [],
    },
    {
      key: 'checked',
      ok: checked,
      waiting: waiting.length > 0,
      text: 'Every claim is checked against the site.',
      small: waiting.length ? `${checkedSmall} ${walkedLine}` : 'Nothing waits on us.',
      short: waiting[0] ? `${waiting[0].company} waits on us · ${waiting[0].since ? daysUntil(today, waiting[0].since) : 0} d` : '',
      acts: waiting[0]
        ? [
            { kind: 'openLines', label: 'Open the lines', packageId: waiting[0].packageId },
            { kind: 'askSuperintendent', label: superintendent ? `Ask ${superintendent} to walk it` : 'Ask the superintendent to walk it' },
          ]
        : [],
    },
    {
      key: 'conditional',
      ok: conditionalIn.length === counted.length,
      waiting: false,
      text: 'The conditional waivers for this period are in.',
      small: `They come with each draw. ${conditionalIn.length} of ${counted.length} are in so far.`,
      short: `Conditional waivers · ${conditionalIn.length} of ${counted.length} in`,
      acts: [],
    },
    {
      key: 'unconditional',
      ok: owing.length === 0,
      waiting: false,
      text: "The unconditional waivers for last period's payment are in.",
      small: owing.length ? owing.map((r) => `${r.company} still owes the unconditional waiver for ${owedDrawWords(r.owedUnconditional)}.`).join(' ') : 'Every unconditional waiver is in.',
      short: firstOwing ? `${firstOwing.company} owes an unconditional waiver` : '',
      acts: firstOwing ? [{ kind: 'askWaiver', label: `Ask ${firstOwing.company}`, packageId: firstOwing.packageId }] : [],
    },
    {
      key: 'changeOrders',
      ok: !billedUnsigned,
      waiting: false,
      text: 'No change order is being billed before it is signed.',
      small: coSmall || 'No change orders this period.',
      short: heldOut[0] ? `CO ${heldOut[0].c.co.number} unsigned · held out` : '',
      acts: [],
    },
    {
      key: 'lastCertificate',
      ok: !last || (certified !== null && last.paidOn !== null),
      waiting: false,
      text: "Last period's certificate and payment are in.",
      small: certSmall,
      short: "Last period's certificate",
      acts: [],
    },
  ]
}

/** A note as a sentence: trimmed, with its full stop. */
function sentence(note: string): string {
  const t = note.trim()
  return t === '' || /[.?!]$/.test(t) ? t : `${t}.`
}

/** "3 of 7": how many gates are clear, of how many, and whether it can go. */
export function canItGo(gates: BillDayGate[]): { ok: number; of: number; yes: boolean; words: string; openWords: string } {
  const ok = gates.filter((g) => g.ok).length
  const open = gates.length - ok
  return { ok, of: gates.length, yes: open === 0, words: `Can it go? ${open === 0 ? 'Yes.' : 'Not yet.'}`, openWords: `${plural(open, 'gate')} open` }
}

export interface BillGroup {
  key: TradeDrawState
  label: string
  tone: 'warn' | 'hot' | ''
  note: string
  rows: TradeDraw[]
}

/** The rows by where they stand, in the page's order: sent back first, then not in, waiting on us, approved, closing out. */
export function billGroups(rows: TradeDraw[], dates: BillDayDates): BillGroup[] {
  const groups: Omit<BillGroup, 'rows'>[] = [
    { key: 'back', label: 'Sent back', tone: 'warn', note: 'ours to re-check once it comes back' },
    { key: 'notin', label: 'Not in', tone: 'hot', note: `due by ${weekdayDate(dates.cutoff)}` },
    { key: 'waiting', label: 'In, waiting on us', tone: '', note: '' },
    { key: 'approved', label: 'Approved', tone: '', note: '' },
    { key: 'closing', label: 'Closing out', tone: '', note: "a trade's final pay application and retainage release list here when they come" },
  ]
  return groups.map((g) => ({ ...g, rows: rows.filter((r) => r.state === g.key) }))
}

/** Whose move a row is, in the row's pill. */
export function rowMove(row: TradeDraw, today: string): { side: 'ours' | 'theirs' | 'paid' | 'none'; words: string } {
  if (row.state === 'approved' || row.state === 'closing') {
    const d = row.draw
    if (d?.status === 'paid') return { side: 'paid', words: `paid ${shortDate(d.paidOn ?? null)}` }
    return { side: 'paid', words: d?.approvedOn ? `we pay by ${shortDate(addDays(d.approvedOn, PAY_WITHIN_DAYS))}` : `paid within ${PAY_WITHIN_DAYS} days of approval` }
  }
  if (row.state === 'waiting') return { side: 'ours', words: `our move · ${row.since ? daysUntil(today, row.since) : 0} d` }
  if (row.nothing) return { side: 'none', words: `nothing this period · ${row.nothing.saidBy}` }
  return { side: 'theirs', words: row.state === 'back' && row.since ? `their move · ${daysUntil(today, row.since)} d` : 'their move' }
}

/** The trades' sums as they stand, by group, with what each reads at: asked when in, approved once approved, the schedule's expected when not in. */
export function tradesSums(rows: TradeDraw[]): { approved: number; waiting: number; back: number; notIn: number; total: number } {
  const sum = (state: TradeDrawState, pick: (r: TradeDraw) => number) => rows.filter((r) => r.state === state && !r.nothing).reduce((s, r) => s + pick(r), 0)
  const approved = sum('approved', (r) => r.approved ?? 0)
  const waiting = sum('waiting', (r) => r.asked ?? 0)
  const back = sum('back', (r) => r.asked ?? 0)
  const notIn = sum('notin', (r) => r.expected)
  return { approved, waiting, back, notIn, total: approved + waiting + back + notIn }
}

/** The package a row is for, for the screens that open it. */
export function packageOf(project: GcProject, row: TradeDraw): TradePackage | undefined {
  return project.packages.find((p) => p.id === row.packageId)
}
