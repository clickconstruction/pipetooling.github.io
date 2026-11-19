/**
 * Share this map, the sheet's rules (punch list #394). Pure.
 *
 * The owner, 2026-11-18, on the sheet before a link exists: *how could I offer this page with less
 * words and in a more intuitive way where the user doesn't have to put in the effort to read so
 * much?* The sheet stood at 163 words, and its one live press, Make a link, sent nothing.
 *
 * So there is no Make a link step. Every press that sends makes the link itself, and one press
 * leads in blue. This file says which presses the sheet draws, which one leads, and the few words
 * it stands with. A press's own name carries what its second line used to say.
 */
import { smsHref } from '../gc/followUpSheet'
import { linkOpenedWords } from './paintedMapLink'
import { PAINTED_MAP_TEXT_WORDS, paintedMapTextDoor, paintedMapTextWords, type PaintedMapTextDoor } from './paintedMapText'

/** The tiles under the leading press, in the order they are drawn. */
export type PaintedMapShareTile = 'code' | 'copy' | 'picture' | 'another'

/** The one blue press. */
export type PaintedMapShareLead = 'own-text' | 'customer-text' | 'copy'

export type PaintedMapShareInput = {
  /** The office team writes to a customer (`jobBoxOffered`). */
  office: boolean
  /** The job the map is on, or none. */
  jobId: string | null | undefined
  /** A phone, where the person's own Messages can be opened (`isPhoneDevice`). */
  phone: boolean
  /** The browser has a share sheet of its own (`navigator.share`). */
  canShare: boolean
  /** The sheet was handed the map's lines and places, so it can make a copy. */
  copies: boolean
}

export type PaintedMapShareWays = {
  lead: PaintedMapShareLead
  /** Text it from my phone…: drawn on a phone alone. A desk has no Messages to open. */
  ownText: boolean
  /** Text the customer…: the office's, on a job. On no job it stays in place, grey, and says why. */
  customer: PaintedMapTextDoor
  tiles: PaintedMapShareTile[]
  /** Print or a file: the page to print and the two files, behind one press. */
  fold: boolean
}

/**
 * What the sheet draws for whoever is looking. The same before a link and after one, so a press
 * never moves. On a phone the person's own text leads for everyone, the office too. At a desk the
 * office's text leads on a job, and Copy the link leads for everyone else.
 */
export function paintedMapShareWays(input: PaintedMapShareInput): PaintedMapShareWays {
  const customer = paintedMapTextDoor({ office: input.office, jobId: input.jobId })
  const lead: PaintedMapShareLead = input.phone ? 'own-text' : customer.kind === 'offered' ? 'customer-text' : 'copy'
  const tiles: PaintedMapShareTile[] = ['code']
  if (lead !== 'copy') tiles.push('copy')
  if (input.copies) tiles.push('picture')
  if (input.canShare) tiles.push('another')
  return { lead, ownText: input.phone, customer, tiles, fold: input.copies }
}

/** Every word the sheet stands with. One home, so a count can hold them (`paintedMapShare.test.ts`). */
export const PAINTED_MAP_SHARE_SHEET_WORDS = {
  ownText: 'Text it from my phone…',
  /** The same press, once the link is made and the phone did not open Messages by itself. */
  openMessages: 'Open Messages',
  making: 'Making the link…',
  customer: PAINTED_MAP_TEXT_WORDS.press,
  customerSub: PAINTED_MAP_TEXT_WORDS.pressSub,
  customerNoJob: PAINTED_MAP_TEXT_WORDS.noJob,
  code: 'Show a code to scan',
  hideCode: 'Hide the code',
  copy: 'Copy the link',
  copied: 'Copied',
  picture: 'Make a picture',
  another: 'Send it another way…',
  fold: 'Print or a file',
  /** What a sender must know, on the sheet at all times. The rest opens under `seePress`. */
  short: 'Anyone with the link can open it. They give their name first.',
  seePress: 'What they see',
  seeHide: 'Hide this',
  end: 'End this link now',
  back: 'Every way to share',
  /** The phone made the link and then would not open another app that long after the press. */
  ready: 'The link is ready. Press Open Messages.',
  readyAnother: 'The link is ready. Press Send it another way… again.',
  /** The phone was handed a text, and the link in it was then refused or lost: said after the reason. */
  textLinkDead: 'The link in that text will not open. Do not send it.',
  /** The second press, with the link already made, opened nothing either. */
  noMessages: 'This phone would not open Messages. Copy the link and paste it into a text.',
  noShareSheet: 'This phone would not open its share sheet. Copy the link.',
  copiedSaid: 'Copied. Paste it into a text or an email.',
  wouldNotCopy: 'This browser would not copy the link. Press and hold the link to copy it.',
} as const

/** A tile's name. */
export function paintedMapShareTileName(tile: PaintedMapShareTile): string {
  return PAINTED_MAP_SHARE_SHEET_WORDS[tile]
}

/** `One link is out, since Nov 13. Not opened yet.` · `2 links are out. Opened 3 times.` */
export function paintedMapLinksOutWords(input: { open: number; since: string | null; opened: number }): string {
  const out = input.open === 1 ? 'One link is out' : `${input.open.toLocaleString('en-US')} links are out`
  return `${out}${input.since ? `, since ${input.since}` : ''}. ${linkOpenedWords(input.opened)}.`
}

/** `End this link now` · `End all 2 links now`. */
export function paintedMapEndWords(open: number): string {
  return open === 1 ? PAINTED_MAP_SHARE_SHEET_WORDS.end : `End all ${open.toLocaleString('en-US')} links now`
}

/**
 * The address that opens the phone's own Messages with the words written and nobody picked: the
 * person picks who gets it. The words are the ones the office's text carries (`paintedMapTextWords`).
 */
export function paintedMapOwnTextHref(mapName: string | null | undefined, url: string): string {
  return smsHref('', paintedMapTextWords(mapName, url))
}

/**
 * The words a sheet with these presses stands with before anyone presses: the head, each press's
 * name and second line, and the one line about a reader. For a count, so the sheet does not grow
 * back to a page of reading.
 */
export function paintedMapShareStandingWords(ways: PaintedMapShareWays): string[] {
  const w = PAINTED_MAP_SHARE_SHEET_WORDS
  const lines: string[] = ['Share this map', 'Close']
  if (ways.ownText) lines.push(w.ownText)
  if (ways.customer.kind === 'offered') lines.push(w.customer, w.customerSub)
  if (ways.customer.kind === 'no-job') lines.push(w.customer, w.customerNoJob)
  if (ways.lead === 'copy') lines.push(w.copy)
  for (const tile of ways.tiles) lines.push(paintedMapShareTileName(tile))
  if (ways.fold) lines.push(w.fold)
  lines.push(w.short, w.seePress)
  return lines
}

/** How many words those are, counted as a reader would. */
export function paintedMapShareWordCount(lines: ReadonlyArray<string>): number {
  return lines.join(' ').split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word)).length
}

/** The most words the sheet may stand with before a link is out. It stood at 163 before this card. */
export const PAINTED_MAP_SHARE_WORDS_MAX = 55
