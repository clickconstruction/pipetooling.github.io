/**
 * Messages, cut 8 (the portals): the customer's Money tab as the owner picked it (v1.163, `money-tab-mockups.html`),
 * lifted from the Messages prototype (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html` v1.178:
 * `portalMoneyHtml`). The win first: *34% built*, what they paid of the revised sum, *3 of 3 paid on time* only when
 * true, and the line that says the sum is the contract plus the changes they signed. Month zero reads *Getting
 * started* and teaches how paying works. Then one card per pay application (the open one first, with what it covers,
 * its photos and where it stands), *After that* with the next one sized, the change orders waiting on them, the newest
 * paid one with its certificate, waivers and thank-you, and the older paid ones folded. *History*, folded, is the money
 * timeline; *The statement*, folded, is the six lines (`moneyLines.ts`). The page praises and never nags.
 *
 * Changed from the prototype: every date is a day in their language; the days to pay come from the job's terms, not a
 * fixed 30; the next application's range is the forecast's bill ten percent either side, rounded out to $5,000, and
 * under $20,000 one "about" rounded to $1,000 (the lead's rule; the prototype typed its range); *paid on time* is worked
 * out from each payment's day against its due day, never typed; a change order's credit and working days read from the
 * order; the card's fee is the job's, and with no card it is not offered.
 *
 * *Built* is the paid share of the revised sum, as the plan says. With retainage held it reads a little under the
 * work in place; counting retainage as built is one line in `paidPct` if the owner wants it. Pure.
 */

import { moneyLines, openChanges, paidPct, signedChanges, statementRows, type CustomerChange, type MoneyLines, type StatementRow } from './moneyLines'
import {
  changeAmount,
  CODE_WORDS,
  listWords,
  money,
  pDate,
  pMonth,
  pWeekday,
  signedMoney,
  typed,
  type PageWords,
  type PortalLang,
  type TypedLine,
} from './pageWords'

/** Where a pay application stands for them: with the architect for the certificate, certified and due, or paid. */
export type PayAppState = 'architect' | 'due' | 'paid'

interface PayAppBase {
  n: number
  /** Any day in the month the work is for. */
  month: string
  /** What it covers, in customer words, from the application's customer line. */
  covers: TypedLine | null
  amount: number
  /** Photos marked for the customer on it. */
  photos: number
}

/** A pay application as their page reads it. Each state carries the days its sentences need, so none reads blank. */
export type PayAppIn = PayAppBase &
  (
    | { state: 'architect'; architect: string | null; withArchitectSince: string }
    | {
        state: 'due'
        certifiedBy: string | null
        certifiedOn: string | null
        /** Null when the job keeps no days to pay: the card says who certified it and no due day. */
        dueOn: string | null
      }
    | {
        state: 'paid'
        certifiedBy: string | null
        certifiedOn: string | null
        /** The day it was due, for *paid on time*. Null: not on file, and then it is not praised. */
        dueOn: string | null
        paidOn: string
        /** One lien waiver per trade we paid on it. */
        waivers: number
        tradesPaidOn: string | null
      }
  )

type PaidApp = Extract<PayAppIn, { state: 'paid' }>

/** The next application as the billing forecast sizes it (`billingForecast.ts`, its next month's bill). */
export interface NextAppIn {
  n: number
  /** Any day in the month the work is for. */
  month: string
  bill: number
  /** About when it reaches them. */
  aboutOn: string
}

export interface MoneyStoryIn {
  contract: number
  contractSignedOn: string | null
  /** Every pay application sent, in dollars, and every payment that cleared: the ledger's, not a sum of the cards. */
  billed: number
  paid: number
  changes: CustomerChange[]
  apps: PayAppIn[]
  next: NextAppIn | null
  /** The days to pay after the certificate, from the job's terms. Null: not on this job. */
  payDays: number | null
  /** The card's fee as a percent. Null: no card on this job. */
  cardFeePct: number | null
}

export interface MoneyHeader {
  /** "34% built", or "Getting started" in month zero. */
  big: string
  /** The small print under it, each a piece the page joins. */
  small: string[]
  pct: number
  /** "The sum is your contract plus the 2 changes you signed. Nothing else." */
  check: string
  /** Month zero only: how paying works. */
  howPay: { title: string; words: string } | null
}

export type MoneyCheckMark = 'done' | 'plain' | 'strong'

export type MoneyCard =
  | {
      kind: 'payApp'
      n: number
      title: string
      month: string
      /** Open: drawn in orange, at the top. */
      open: boolean
      /** "paid Sep 25" on a paid one. */
      pill: string | null
      covers: string
      amount: string
      photos: number
      checks: { mark: MoneyCheckMark; words: string }[]
      buttons: { label: string; primary: boolean; press: 'receipt' | 'waivers' | 'pay' | 'read' }[]
    }
  | { kind: 'after'; title: string; rows: { title: string; month: string; words: string }[]; note: string }
  | { kind: 'changes'; title: string; rows: { title: string; detail: string; amount: string }[]; note: string }
  | { kind: 'older'; words: string; ns: number[] }

export interface HistoryEvent {
  kind: 'done' | 'open' | 'next'
  title: string
  amount: string | null
  sub: string[]
}

export interface MoneyStory {
  header: MoneyHeader
  cards: MoneyCard[]
  history: { title: string; events: HistoryEvent[]; investedSoFar: { label: string; amount: string }; toFinish: { label: string; amount: string } }
  statement: { title: string; rows: StatementRow[] }
  payNote: string
}

/** The next application's size in words: a range rounded out to $5,000, or under $20,000 one rounded amount. */
export type NextAppSize = { low: number; high: number } | { about: number }

const NEXT_RANGE_FLOOR = 20_000

export function nextAppSize(bill: number): NextAppSize {
  if (bill < NEXT_RANGE_FLOOR) return { about: Math.round(bill / 1000) * 1000 }
  // The tiny nudges keep a round bill on its own step: $100,000 is $90,000 to $110,000, not $115,000.
  return { low: Math.floor((bill * 0.9) / 5000 + 1e-9) * 5000, high: Math.ceil((bill * 1.1) / 5000 - 1e-9) * 5000 }
}

/** "$115,000 to $145,000" or "about $15,000", for the office's readiness list. */
export function nextAppSizeWords(bill: number): string {
  const size = nextAppSize(bill)
  return 'about' in size ? `about ${money(size.about)}` : `${money(size.low)} to ${money(size.high)}`
}

function nextAppWords(lang: PortalLang, next: NextAppIn, words: PageWords): string {
  const size = nextAppSize(next.bill)
  const day = pDate(lang, next.aboutOn)
  return 'about' in size
    ? words.say(lang, 'afterAbout', { amount: money(size.about), day })
    : words.say(lang, 'afterRange', { low: money(size.low), high: money(size.high), day })
}

/** Paid by the day it was due. A payment with no due day on file is not praised. */
function onTime(app: PaidApp): boolean {
  return !!app.dueOn && app.paidOn <= app.dueOn
}

function sumIs(lang: PortalLang, n: number, words: PageWords): string {
  if (n === 0) return words.say(lang, 'sumIsNone')
  return n === 1 ? words.say(lang, 'sumIsOne') : words.say(lang, 'sumIsMany', { n })
}

function header(lang: PortalLang, input: MoneyStoryIn, lines: MoneyLines, paidApps: PaidApp[], words: PageWords): MoneyHeader {
  const pct = paidPct(lines)
  const check = sumIs(lang, lines.changesCount, words)
  if (paidApps.length) {
    const small = [words.say(lang, 'investedOf', { paid: money(lines.paid), sum: money(lines.revised) })]
    if (paidApps.every(onTime)) small.push(words.say(lang, 'paidOnTime', { n: paidApps.length }))
    return { big: words.say(lang, 'builtPct', { pct }), small, pct, check, howPay: null }
  }
  const small = [words.say(lang, 'soFarOf', { paid: money(lines.paid), sum: money(lines.revised) })]
  if (input.next) small.push(words.say(lang, 'firstAppAbout', { day: pDate(lang, input.next.aboutOn) }))
  const howPay = input.apps.length
    ? null
    : {
        title: words.say(lang, 'howPayTitle'),
        words: input.payDays != null ? words.say(lang, 'howPayWords', { days: input.payDays }) : words.say(lang, 'howPayWordsNoDays'),
      }
  return { big: words.say(lang, 'startingTitle'), small, pct, check, howPay }
}

function appCard(lang: PortalLang, input: MoneyStoryIn, a: PayAppIn, words: PageWords): MoneyCard {
  const checks: { mark: MoneyCheckMark; words: string }[] = []
  let buttons: Extract<MoneyCard, { kind: 'payApp' }>['buttons']
  if (a.state === 'architect') {
    const day = pWeekday(lang, a.withArchitectSince)
    checks.push({ mark: 'plain', words: a.architect ? words.say(lang, 'withArchitect', { name: a.architect, day }) : words.say(lang, 'withArchitectUnnamed', { day }) })
    if (input.payDays != null) checks.push({ mark: 'plain', words: words.say(lang, 'dueDaysAfter', { days: input.payDays }) })
    checks.push({ mark: 'plain', words: words.say(lang, 'nothingYet') })
    buttons = [{ label: words.say(lang, 'readApp'), primary: false, press: 'read' }]
  } else {
    if (a.certifiedBy && a.certifiedOn) checks.push({ mark: 'done', words: words.say(lang, 'certifiedBy', { name: a.certifiedBy, day: pDate(lang, a.certifiedOn) }) })
    if (a.state === 'due') {
      if (a.dueOn) checks.push({ mark: 'strong', words: words.say(lang, 'dueOnDay', { day: pDate(lang, a.dueOn) }) })
      buttons = [
        { label: words.say(lang, 'payIt'), primary: true, press: 'pay' },
        { label: words.say(lang, 'readApp'), primary: false, press: 'read' },
      ]
    } else {
      if (a.waivers > 0 && a.tradesPaidOn) {
        const day = pDate(lang, a.tradesPaidOn)
        checks.push({ mark: 'done', words: a.waivers === 1 ? words.say(lang, 'waiversOne', { day }) : words.say(lang, 'waiversMany', { n: a.waivers, day }) })
      }
      checks.push({ mark: 'done', words: words.say(lang, 'thankYou') })
      buttons = [
        { label: words.say(lang, 'receipt'), primary: false, press: 'receipt' },
        { label: words.say(lang, 'waiversButton'), primary: false, press: 'waivers' },
      ]
    }
  }
  return {
    kind: 'payApp',
    n: a.n,
    title: words.say(lang, 'payAppN', { n: a.n }),
    month: pMonth(lang, a.month),
    open: a.state !== 'paid',
    pill: a.state === 'paid' ? words.say(lang, 'paidOnDay', { day: pDate(lang, a.paidOn) }) : null,
    covers: a.covers ? typed(lang, a.covers) : '',
    amount: money(a.amount),
    photos: a.photos,
    checks,
    buttons,
  }
}

function history(lang: PortalLang, input: MoneyStoryIn, lines: MoneyLines, openApps: PayAppIn[], paidApps: PaidApp[], words: PageWords): MoneyStory['history'] {
  const dated: { at: string; event: HistoryEvent }[] = []
  for (const a of paidApps) {
    const sub = [pDate(lang, a.paidOn), words.say(lang, 'thankYouSmall')]
    if (a.waivers > 0 && a.tradesPaidOn) {
      const day = pDate(lang, a.tradesPaidOn)
      sub.push(a.waivers === 1 ? words.say(lang, 'tradesPaidOne', { day }) : words.say(lang, 'tradesPaidMany', { n: a.waivers, day }))
    }
    dated.push({ at: a.paidOn, event: { kind: 'done', title: words.say(lang, 'payAppPaid', { n: a.n }), amount: money(a.amount), sub } })
  }
  for (const x of signedChanges(input.changes)) {
    dated.push({
      at: x.signedOn ?? '',
      event: { kind: 'done', title: words.say(lang, 'changeSigned', { n: x.number }), amount: signedMoney(x.price), sub: [pWeekday(lang, x.signedOn ?? null), typed(lang, x.description)].filter(Boolean) },
    })
  }
  dated.sort((p, q) => (p.at < q.at ? -1 : p.at > q.at ? 1 : 0))
  const events: HistoryEvent[] = [
    { kind: 'done', title: words.say(lang, 'contractSigned'), amount: money(input.contract), sub: input.contractSignedOn ? [pWeekday(lang, input.contractSignedOn)] : [] },
    ...dated.map((d) => d.event),
  ]
  for (const a of openApps) {
    const sub =
      a.state === 'architect'
        ? [words.say(lang, 'withArchitectSince', { day: pWeekday(lang, a.withArchitectSince) }), ...(input.payDays != null ? [words.say(lang, 'dueDaysAfter', { days: input.payDays })] : [])]
        : a.state === 'due' && a.dueOn
          ? [words.say(lang, 'dueOnDay', { day: pDate(lang, a.dueOn) })]
          : []
    events.push({ kind: 'open', title: words.say(lang, 'payAppN', { n: a.n }), amount: money(a.amount), sub })
  }
  if (input.next) {
    events.push({ kind: 'next', title: words.say(lang, 'payAppN', { n: input.next.n }), amount: null, sub: [words.say(lang, 'aboutDay', { day: pDate(lang, input.next.aboutOn) }), pMonth(lang, input.next.month)] })
  }
  return {
    title: words.say(lang, 'historyTitle'),
    events,
    investedSoFar: { label: words.say(lang, 'investedSoFar'), amount: money(lines.paid) },
    toFinish: { label: words.say(lang, 'toFinish'), amount: money(lines.balance) },
  }
}

/**
 * The Money tab for one job. `showOlder` opens the paid applications folded under the newest one, the way the fold
 * line's press does.
 */
export function moneyStory(lang: PortalLang, input: MoneyStoryIn, opts: { showOlder?: boolean; words?: PageWords } = {}): MoneyStory {
  const words = opts.words ?? CODE_WORDS
  const lines = moneyLines(input)
  const byNewest = [...input.apps].sort((p, q) => q.n - p.n)
  const openApps = byNewest.filter((a) => a.state !== 'paid')
  const paidApps = byNewest.filter((a): a is PaidApp => a.state === 'paid')
  const waiting = openChanges(input.changes)

  const cards: MoneyCard[] = openApps.map((a) => appCard(lang, input, a, words))
  if (input.next) {
    cards.push({
      kind: 'after',
      title: words.say(lang, 'afterThatTitle'),
      rows: [{ title: words.say(lang, 'payAppN', { n: input.next.n }), month: pMonth(lang, input.next.month), words: nextAppWords(lang, input.next, words) }],
      note: words.say(lang, 'sizesNote'),
    })
  }
  if (waiting.length) {
    cards.push({
      kind: 'changes',
      title: words.say(lang, 'waitingAnswer'),
      rows: waiting.map((x) => ({ title: words.say(lang, 'changeOrderN', { n: x.number }), detail: typed(lang, x.description), amount: changeAmount(lang, x.price, words) })),
      note: words.say(lang, 'signingAdds'),
    })
  }
  const older = paidApps.slice(1)
  for (const a of opts.showOlder ? paidApps : paidApps.slice(0, 1)) cards.push(appCard(lang, input, a, words))
  if (older.length && !opts.showOlder) {
    cards.push({ kind: 'older', words: words.say(lang, 'olderPaid', { list: listWords(lang, older.map((a) => a.n), words) }), ns: older.map((a) => a.n) })
  }

  return {
    header: header(lang, input, lines, paidApps, words),
    cards,
    history: history(lang, input, lines, openApps, paidApps, words),
    statement: { title: words.say(lang, 'statementTitle'), rows: statementRows(lang, lines, words) },
    payNote: input.cardFeePct != null ? words.say(lang, 'payNoteCard', { fee: `${input.cardFeePct}%` }) : words.say(lang, 'payNoteBank'),
  }
}
