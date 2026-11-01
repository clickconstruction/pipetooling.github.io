/**
 * Hand off counties (punch list #222, PR 4, v2.6233): what the sheet says before the press, its button and why it
 * is dead, the toast after, and the words for retire as its own step. The owner, 2026-10-30: "if we're going to
 * replace someone replace them for that coverage zone." `legal_hand_off_counties` moves the counties picked from
 * the giving firm to the receiving firm, which becomes first call there; a live matter never moves. Pure.
 */
import { formatErrorMessage } from '../../utils/errorHandling'
import { andList } from './firmAreaPresets'
import { countyWords, firmsOfCover, type Coverage } from './firmCounties'
import type { LegalMapCase } from './firmMap'

export type HandOffReceiver = { kind: 'firm'; id: string; name: string } | { kind: 'new'; name: string }

export type HandOffInput = {
  firmId: string
  firmName: string
  coverage: Coverage
  /** The counties ticked. */
  picked: ReadonlyArray<string>
  receiver: HandOffReceiver | null
  /** The accounts with the giving firm (`legalFirmFacts(...).withFirm`): they stay with it. */
  liveMatters: ReadonlyArray<{ payerName: string }>
  cases: ReadonlyArray<Pick<LegalMapCase, 'name' | 'county' | 'stand'>>
  retire: boolean
}

/** The receiver's name in a sentence: the firm's, the typed one, or `the new firm`. */
export function receiverName(r: HandOffReceiver | null): string {
  if (!r) return 'the firm you pick'
  return r.name.trim() || 'the new firm'
}

/** The counties the firm covers, first call or not, sorted. */
export function coveredBy(coverage: Coverage, firmId: string): string[] {
  const out: string[] = []
  for (const [county, cover] of coverage) if (firmsOfCover(cover).includes(firmId)) out.push(county)
  return out.sort((a, b) => a.localeCompare(b))
}

/** What happens when the button is pressed, one plain sentence each. Empty until a county is ticked. */
export function handOffWords(input: HandOffInput): string[] {
  const picked = [...input.picked].sort((a, b) => a.localeCompare(b))
  if (picked.length === 0) return []
  const to = receiverName(input.receiver)
  const lines = [`New releases in ${andList(picked.map(countyWords))} go to ${to}. ${to} is first call there.`]
  const kept = coveredBy(input.coverage, input.firmId).filter((c) => !picked.includes(c))
  lines.push(kept.length ? `${input.firmName} keeps ${andList(kept.map(countyWords))}.` : `${input.firmName} keeps no county.`)
  if (input.liveMatters.length) {
    const names = input.liveMatters.map((m) => m.payerName)
    lines.push(names.length === 1 ? `${names[0]} stays with ${input.firmName} until it closes.` : `${andList(names)} stay with ${input.firmName} until they close.`)
  }
  const inReview = input.cases.filter((c) => c.stand === 'eyes' && c.county && picked.includes(c.county)).map((c) => c.name)
  if (inReview.length) {
    lines.push(`${andList(inReview)}, in review there, ${inReview.length === 1 ? 'reads' : 'read'} ${to} as ${inReview.length === 1 ? 'its' : 'their'} firm from now on. This sends no email.`)
  }
  if (input.retire) lines.push(`${input.firmName} is retired. Its link stops working, its people stop getting emails, and its history stays.`)
  return lines
}

/** Why the button is dead, or null when it can go. */
export function handOffHold(input: Pick<HandOffInput, 'picked' | 'receiver'>): string | null {
  if (input.picked.length === 0) return 'Pick the counties that move.'
  if (!input.receiver) return 'Pick the firm that takes them.'
  if (input.receiver.kind === 'new' && !input.receiver.name.trim()) return 'Give the new firm a name.'
  return null
}

/** The button: `Hand off 2 counties to Alamo`, or `Hand off counties` while nothing is ready. */
export function handOffButton(input: Pick<HandOffInput, 'picked' | 'receiver'>): string {
  const n = input.picked.length
  if (n === 0 || !input.receiver) return 'Hand off counties'
  return `Hand off ${n} ${n === 1 ? 'county' : 'counties'} to ${receiverName(input.receiver)}`
}

/** Why `Retire <firm> too` is off in the sheet, or null when it may be ticked. */
export function retireWithHandOffHold(firmName: string, allPicked: boolean, liveMatters: ReadonlyArray<{ payerName: string }>): string | null {
  if (!allPicked) return `Tick every county to retire ${firmName} with them.`
  if (liveMatters.length) return liveMatterWords(firmName, liveMatters)
  return null
}

function liveMatterWords(firmName: string, live: ReadonlyArray<{ payerName: string }>): string {
  return live.length === 1 ? `${live[0]!.payerName} is still with ${firmName}.` : `${live.length} accounts are still with ${firmName}.`
}

/** The toast after a hand-off. */
export function handOffDoneWords(picked: ReadonlyArray<string>, to: string, firmName: string, retired: boolean): string {
  const sorted = [...picked].sort((a, b) => a.localeCompare(b))
  return `${andList(sorted.map(countyWords))} went to ${to}.${retired ? ` ${firmName} is retired.` : ''}`
}

/**
 * Retire as its own step, the last section of the window: why it waits, or null when it may go. A firm still
 * covering a county hands it off first; a firm still holding an account waits for it; the only firm that stands is
 * replaced, never retired, so the desk is never left with no firm.
 */
export function retireHold(firmName: string, countiesLeft: number, liveMatters: ReadonlyArray<{ payerName: string }>, otherFirms: number): string | null {
  const parts: string[] = []
  if (countiesLeft > 0) parts.push(`Hand off its ${countiesLeft} ${countiesLeft === 1 ? 'county' : 'counties'} first.`)
  if (liveMatters.length) parts.push(liveMatterWords(firmName, liveMatters))
  if (parts.length) return parts.join(' ')
  if (otherFirms === 0) return `${firmName} is the only firm. Replace it with a new firm instead.`
  return null
}

/** Beside a ready Retire: what it does. */
export function retireReadyWords(firmName: string): string {
  return `${firmName} covers no county and holds no live matter. Its link stops working, its people stop getting emails, and its history stays.`
}

/** A refusal in the office's words: the database update not pushed yet reads as that, not as Postgres. */
export function handOffErrorWords(error: unknown): string {
  const text = formatErrorMessage(error)
  if (/legal_hand_off_counties|legal_retire_firm/.test(text) && /(could not find|does not exist|schema cache)/i.test(text)) return 'Handing off needs a database update that is not live yet. Ask a dev to push it, then try again.'
  return `Could not finish: ${text}`
}
