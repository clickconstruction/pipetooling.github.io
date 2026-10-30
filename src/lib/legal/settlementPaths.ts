import { formatLegalMoney } from './legalPacket'
import type { CounselRead } from './counselRead'
import { counselTriesWords } from './counselRead'
import { moneyBarDayWords, offerStands, type MoneyBarOffer } from './moneyBars'
import { currentCounselRead } from './counselRead'
import { isOfferEntry, offerMetaOf } from './legalOffers'
import { isVoidedEntry } from '../../../supabase/functions/_shared/legalPortalActs'

/**
 * What each path nets (punch list #218, direction C, PR 3). The owner's words of 2026-10-30: the
 * attorney settles for what can be had, and we get what we get; if they don't settle it costs us
 * more in collections and at trial. The floor (v2.4643, retired in v2.6170) was one number with
 * nothing beside it about what trial would net. This kernel draws the comparison the floor never
 * made: every standing offer as a path — the offer, the firm's cut on it, what we keep, when — beside
 * collections and trial — the claim, the firm's cut, the filing cost, the costs to try it from the
 * attorney's read (PR 2), what we keep at a full win, the months to a judgment — and one line
 * derived from the cost to continue: the offer at which settling nets the same as winning everything.
 *
 *   line = claim − (filing + costs to try) / (1 − the firm's %)
 *
 * Above it, settling beats a full win. Below it, the read says whether a full win is the likely end.
 * No probability: the desk never invents a figure (the rule v2.6105 kept); the read is the attorney's
 * word, and the rest is arithmetic on numbers the desk holds or the firm typed. Pure: the component draws it.
 */

/** Suit is filed from these stages on: the filing cost is spent, so no path carries it. */
export const LEGAL_FILED_STAGES = ['suit', 'judgment', 'post_judgment'] as const
export function legalSuitFiled(stage: string | null | undefined): boolean {
  return (LEGAL_FILED_STAGES as readonly string[]).includes(stage ?? '')
}

export type SettlementPathsInput = {
  claim: number
  contingencyPct: number
  filingCost: number
  /** True once suit is filed (stage suit · judgment · post_judgment): the filing cost is spent on every path. */
  filed: boolean
  offers: ReadonlyArray<MoneyBarOffer>
  read: CounselRead | null
}

export type SettlementPathKind = 'offer' | 'trial'
export type SettlementPathPart = { key: 'keep' | 'fee' | 'filing' | 'try' | 'letgo'; label: string; amount: number; fraction: number }
export type SettlementPath = {
  key: string
  kind: SettlementPathKind
  /** *Settle at their offer* · *Settle at our counter* · *Collections and trial* */
  title: string
  /** The figure the path starts from: the offer, or the claim. */
  gross: number
  /** What we keep on it. */
  keep: number
  /** The rows under the figure, in order; `fraction` is of the claim's scale, so the paths compare. */
  parts: SettlementPathPart[]
  /** *within the month* · *9 months to a judgment, then collecting it* · *the firm has not said how long* */
  when: string
  /** The chip beside the title: the offer's amount, or the read. */
  chip: { text: string; tone: 'ok' | 'warn' | 'info' | 'neutral' }
  /** A hard read's caveat under the trial path; '' elsewhere. */
  caveat: string
}

export type SettlementLine = {
  amount: number
  /** Of the claim; the mark's place on the claim bar. */
  fraction: number
  /** *above this, settling beats a full win* */
  label: string
  /** The arithmetic in words, for the hover. */
  title: string
}

export type SettlementPaths = { paths: SettlementPath[]; line: SettlementLine | null; words: string }

const round2 = (n: number): number => Math.round(n * 100) / 100
const frac = (amount: number, scale: number): number => (scale > 0 ? Math.max(0, Math.min(1, amount / scale)) : 0)

function pctWords(pct: number): string {
  return `${Math.round(pct * 100)}%`
}

/** The offer at which settling nets what a full win at trial nets; null when the firm's cut would take everything. */
export function settlementLineAmount(input: Pick<SettlementPathsInput, 'claim' | 'contingencyPct' | 'filingCost' | 'filed' | 'read'>): number | null {
  const keepShare = 1 - input.contingencyPct
  if (keepShare <= 0.0001 || input.claim <= 0.004) return null
  const filing = input.filed ? 0 : Math.max(0, input.filingCost)
  const toTry = Math.max(0, input.read?.costToTry ?? 0)
  return round2(Math.max(0, input.claim - (filing + toTry) / keepShare))
}

export function settlementPaths(input: SettlementPathsInput): SettlementPaths {
  const claim = round2(Math.max(0, input.claim))
  const pct = Math.max(0, Math.min(1, input.contingencyPct))
  const filing = input.filed ? 0 : round2(Math.max(0, input.filingCost))
  const toTry = round2(Math.max(0, input.read?.costToTry ?? 0))
  const standing = input.offers.filter((o) => offerStands(o.status) && o.amount > 0.004)
  const scale = round2(Math.max(claim, ...standing.map((o) => o.amount)))
  const paths: SettlementPath[] = []

  for (const o of standing.slice().sort((a, b) => a.amount - b.amount)) {
    const gross = round2(o.amount)
    const fee = round2(gross * pct)
    const keep = round2(gross - fee)
    const letGo = round2(claim - gross)
    const parts: SettlementPathPart[] = [
      { key: 'keep', label: `we keep ${formatLegalMoney(keep)}`, amount: keep, fraction: frac(keep, scale) },
      { key: 'fee', label: `firm ${pctWords(pct)} · ${formatLegalMoney(fee)}`, amount: fee, fraction: frac(fee, scale) },
    ]
    if (letGo > 0.004) parts.push({ key: 'letgo', label: `we let go of the claim · ${formatLegalMoney(letGo)}`, amount: letGo, fraction: frac(letGo, scale) })
    const theirs = o.direction === 'received'
    const when = theirs ? 'within the month' : o.expiresOn && moneyBarDayWords(o.expiresOn) ? `within the month, if they take it by ${moneyBarDayWords(o.expiresOn)}` : 'within the month, if they take it'
    paths.push({
      key: `offer:${o.key}`,
      kind: 'offer',
      title: theirs ? 'Settle at their offer' : 'Settle at our counter',
      gross,
      keep,
      parts,
      when,
      chip: { text: formatLegalMoney(gross), tone: theirs ? 'info' : 'neutral' },
      caveat: '',
    })
  }

  if (claim > 0.004) {
    const fee = round2(claim * pct)
    const keep = round2(claim - fee - filing - toTry)
    const parts: SettlementPathPart[] = [
      { key: 'keep', label: `we keep ${formatLegalMoney(Math.max(0, keep))}`, amount: Math.max(0, keep), fraction: frac(Math.max(0, keep), scale) },
      { key: 'fee', label: `firm ${pctWords(pct)} · ${formatLegalMoney(fee)}`, amount: fee, fraction: frac(fee, scale) },
    ]
    if (filing > 0.004) parts.push({ key: 'filing', label: `filing ${formatLegalMoney(filing)}`, amount: filing, fraction: frac(filing, scale) })
    if (toTry > 0.004) parts.push({ key: 'try', label: `costs to try it ${formatLegalMoney(toTry)}, the firm's figure`, amount: toTry, fraction: frac(toTry, scale) })
    const read = input.read
    const when = read?.months != null ? `${read.months} month${read.months === 1 ? '' : 's'} to a judgment, then collecting it` : 'the firm has not said how long'
    paths.push({
      key: 'trial',
      kind: 'trial',
      title: 'Collections and trial',
      gross: claim,
      keep,
      parts,
      when,
      chip: read ? { text: counselTriesWords(read.tries), tone: read.tries === 'hard' ? 'warn' : 'ok' } : { text: 'not read yet', tone: 'neutral' },
      caveat: read?.tries === 'hard' ? 'A hard case. A full win is not the likely end. The firm’s call.' : '',
    })
  }

  const lineAmount = settlementLineAmount({ claim, contingencyPct: pct, filingCost: input.filingCost, filed: input.filed, read: input.read })
  const line: SettlementLine | null =
    lineAmount != null && lineAmount > 0.004
      ? {
          amount: lineAmount,
          fraction: frac(lineAmount, claim),
          label: 'above this, settling beats a full win',
          title: `The claim ${formatLegalMoney(claim)} less ${filing > 0.004 ? `the filing cost ${formatLegalMoney(filing)}` : 'nothing to file'}${toTry > 0.004 ? ` and the costs to try it ${formatLegalMoney(toTry)}` : ''}, divided by what we keep after the firm's ${pctWords(pct)}: an offer above ${formatLegalMoney(lineAmount)} nets more than winning everything at trial.`,
        }
      : null

  // --- One sentence ---------------------------------------------------------
  const parts: string[] = []
  const theirs = standing.filter((o) => o.direction === 'received').sort((a, b) => b.ymd.localeCompare(a.ymd))[0]
  if (theirs) parts.push(`Their offer nets ${formatLegalMoney(round2(theirs.amount - theirs.amount * pct))} within the month.`)
  const trial = paths.find((p) => p.kind === 'trial')
  if (trial) {
    const costs = round2(filing + toTry)
    const whenWords = input.read?.months != null ? ` after ${input.read.months} month${input.read.months === 1 ? '' : 's'}` : ''
    parts.push(`A full win at trial nets ${formatLegalMoney(Math.max(0, trial.keep))}${whenWords}${costs > 0.004 ? ` and ${formatLegalMoney(costs)} of costs` : ''}.`)
  }
  if (line) parts.push(`An offer above ${formatLegalMoney(line.amount)} beats a full win.`)
  if (trial) parts.push(input.read ? `The firm reads this case as ${counselTriesWords(input.read.tries)}.` : 'The firm has not said how this case tries.')
  return { paths, line, words: parts.join(' ') }
}

type MatterEntryLike = { id: string; kind: string; meta: unknown; amount: number | null; occurred_on: string; created_at: string; via_portal: boolean; voided_at?: string | null; created_by?: string | null }

/**
 * The paths of a matter from what every reader holds (v2.6177, PR 4): the worth's claim and fee model, the stage
 * (filed or not), and the matter's entries — the standing offers and the current read come from them. The desk,
 * the firm's view and both prints call this, so the office and the firm read one set of cards.
 */
export function settlementPathsOfMatter(
  worth: Pick<SettlementPathsInput, 'claim' | 'contingencyPct' | 'filingCost'>,
  stage: string | null | undefined,
  entries: ReadonlyArray<MatterEntryLike>,
  nameOf: (userId: string | null | undefined) => string | null = () => null,
): SettlementPaths {
  const offers: MoneyBarOffer[] = entries.filter((e) => isOfferEntry(e) && !isVoidedEntry(e)).map((e) => {
    const meta = offerMetaOf(e.meta)
    return { key: e.id, direction: meta.direction, amount: Number(e.amount ?? 0), status: meta.status, ymd: e.occurred_on, expiresOn: meta.expiresOn }
  })
  return settlementPaths({ claim: worth.claim, contingencyPct: worth.contingencyPct, filingCost: worth.filingCost, filed: legalSuitFiled(stage), offers, read: currentCounselRead(entries, nameOf) })
}
