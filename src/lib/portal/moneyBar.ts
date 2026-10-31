/**
 * The GC customer's Money tab as one bar (punch list #217, *Show it, don't say it*, outside-2 — a prototype). The head
 * read *34% built*, which is the paid share, over a bar of one part, so the owner could not tell whether the $45,000 on
 * the statement under it was inside the $187,000 or on top of it. This kernel draws the revised sum as one bar in four
 * parts: paid, billed and open (with the architect, or certified and due, each its own shade), the next pay application
 * hatched as our guess, and to finish. The six-line statement is its legend. *34% built* becomes *34% paid*. Pure, over
 * the same `MoneyStoryIn` the story reads; the component draws the fractions. Reuses the Legal desk's bar geometry
 * (`lib/legal/moneyBars.ts`): a length, fractions of it, a hatch for a figure not on record.
 */
import { moneyLines, paidPct, type MoneyLines } from './moneyLines'
import { nextAppSize, type MoneyStoryIn } from './moneyStory'
import { CODE_WORDS, money, pDate, type PageWords, type PortalLang } from './pageWords'

/**
 * The bar's own words, both languages. A prototype's: they live here and not in `pageWords.ts`'s table, which the
 * office edits on Settings → Customer page and a migration seeds (`customer_page_words`); the build step moves them
 * there. Plain words: one idea a sentence, nothing glued.
 */
const BAR_WORDS = {
  paidPct: { en: '{pct}% paid', es: '{pct}% pagado' },
  barNothingPaid: { en: 'Nothing paid yet', es: 'Nada pagado todavía' },
  barCaption: { en: 'Your contract, {sum}', es: 'Su contrato, {sum}' },
  barPaid: { en: 'paid {amount}', es: 'pagado {amount}' },
  barWithArchitect: { en: 'with your architect {amount}', es: 'con su arquitecto {amount}' },
  barDue: { en: 'certified and due {amount}', es: 'certificada y por pagar {amount}' },
  barNext: { en: 'next, about {amount}', es: 'próxima, cerca de {amount}' },
  barToFinish: { en: 'to finish {amount}', es: 'por terminar {amount}' },
  barOnTime: { en: '{n} of {n} on time', es: '{n} de {n} a tiempo' },
  barGuess: { en: 'Pay application {n} is our guess from the schedule: about {amount}, around {day}.', es: 'La solicitud de pago {n} es nuestra estimación según el calendario: cerca de {amount}, alrededor del {day}.' },
} as const
export type MoneyBarWordKey = keyof typeof BAR_WORDS
export const MONEY_BAR_WORD_KEYS = Object.keys(BAR_WORDS) as MoneyBarWordKey[]

/** One of the bar's sentences in a language, its {blanks} filled. */
export function barWord(lang: PortalLang, key: MoneyBarWordKey, vars?: Record<string, string | number>): string {
  let out: string = BAR_WORDS[key][lang]
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}

export type MoneyBarPart = 'paid' | 'architect' | 'due' | 'next' | 'rest'

export interface MoneyBarSegment {
  part: MoneyBarPart
  amount: number
  /** Of the bar's length, 0 to 1. */
  fraction: number
  /** The legend's words: "paid $63,580", "with your architect $45,000", "next, about $38,000". */
  label: string
}

export interface MoneyBar {
  /** "Your contract · $187,000" — the revised sum. */
  caption: string
  total: number
  segments: MoneyBarSegment[]
  /** "34% paid", or "Nothing paid yet" in month zero. */
  big: string
  /** "3 of 3 on time" when every paid one was; else null. */
  onTime: string | null
  /** "next pay application ≈ $38,000 · our guess from the schedule", when the page knows the next one; else null. */
  guess: string | null
  pct: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100

function frac(amount: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(1, amount / total)) : 0
}

/** The next application's one figure for the bar: the middle of its range, or its about. */
export function nextGuess(bill: number): number {
  const size = nextAppSize(bill)
  return 'about' in size ? size.about : Math.round((size.low + size.high) / 2)
}

export function moneyBar(lang: PortalLang, input: MoneyStoryIn, _words: PageWords = CODE_WORDS, lines: MoneyLines = moneyLines(input)): MoneyBar {
  const total = round2(lines.revised)
  const paid = round2(Math.min(lines.paid, total))
  // Billed and open, by where each open application stands; the ledger's billed less paid is what is open in all.
  const openApps = input.apps.filter((a) => a.state !== 'paid')
  const architect = round2(openApps.filter((a) => a.state === 'architect').reduce((t, a) => t + a.amount, 0))
  const due = round2(openApps.filter((a) => a.state === 'due').reduce((t, a) => t + a.amount, 0))
  const next = input.next ? nextGuess(input.next.bill) : 0
  const used = paid + architect + due + next
  const rest = round2(Math.max(0, total - used))
  const segments: MoneyBarSegment[] = []
  if (paid > 0.004) segments.push({ part: 'paid', amount: paid, fraction: frac(paid, total), label: barWord(lang, 'barPaid', { amount: money(paid) }) })
  if (architect > 0.004) segments.push({ part: 'architect', amount: architect, fraction: frac(architect, total), label: barWord(lang, 'barWithArchitect', { amount: money(architect) }) })
  if (due > 0.004) segments.push({ part: 'due', amount: due, fraction: frac(due, total), label: barWord(lang, 'barDue', { amount: money(due) }) })
  if (next > 0.004) segments.push({ part: 'next', amount: next, fraction: frac(next, total), label: barWord(lang, 'barNext', { amount: money(next) }) })
  if (rest > 0.004 || segments.length === 0) segments.push({ part: 'rest', amount: rest, fraction: frac(rest, total), label: barWord(lang, 'barToFinish', { amount: money(rest) }) })
  const paidApps = input.apps.filter((a) => a.state === 'paid')
  const onTime = paidApps.length > 0 && paidApps.every((a) => !!a.dueOn && a.paidOn <= a.dueOn) ? barWord(lang, 'barOnTime', { n: paidApps.length }) : null
  const pct = paidPct(lines)
  return {
    caption: barWord(lang, 'barCaption', { sum: money(total) }),
    total,
    segments,
    big: paid > 0.004 ? barWord(lang, 'paidPct', { pct }) : barWord(lang, 'barNothingPaid'),
    onTime,
    guess: input.next ? barWord(lang, 'barGuess', { n: input.next.n, amount: money(next), day: pDate(lang, input.next.aboutOn) }) : null,
    pct,
  }
}
