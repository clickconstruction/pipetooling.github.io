/**
 * Residential R6's screens: Settings → Phone and texts → **Inboxes**, where the owner or a dev types each box's email
 * address, phone and Quo number id into `app_settings` `messages_boxes_v1` (R6's SQL, v2.5428; the box rules are
 * `boxes.ts`). The owner's team@ or office@ answer is typed here. No function reads the row yet and the reply box sends
 * from it only once `SENDS_FROM_BOXES` is on, so the card's words say the app starts using these once the two inboxes
 * are switched on. Pure.
 */
import type { ContactKind } from '../contacts/kernel'
import { kindWord } from '../contacts/names'
import { normalizeCustomerEmail } from '../customerSimilarity'
import { BOXES, MAILBOXES, parseBoxSettings, type BoxSetting, type BoxSettings, type Mailbox } from './boxes'

const EMPTY: BoxSetting = { address: '', phone: '', numberId: '' }

/** Every field empty, as the row ships. */
export const EMPTY_BOXES: BoxSettings = { team: { ...EMPTY }, bids: { ...EMPTY } }

/** The row as the card reads it: a row not there, or not JSON, reads as every field empty. */
export function boxesFromRow(valueText: string | null | undefined): BoxSettings {
  return parseBoxSettings(valueText) ?? EMPTY_BOXES
}

/** Quo's phone number ids start with PN. */
export const QUO_NUMBER_ID = /^PN[A-Za-z0-9]+$/

/** A phone's ten digits, a leading 1 dropped; '' when it holds some other count. */
export function phoneDigits(raw: string): string {
  const d = raw.replace(/\D/g, '')
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  return ten.length === 10 ? ten : ''
}

/** A phone as the row keeps it, "(512) 555-0144", the way the company number reads today. Typed any other way, it stays as typed. */
export function phoneAsKept(raw: string): string {
  const d = phoneDigits(raw)
  return d ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw.trim()
}

/** The boxes as a save writes them: the address and the Quo id trimmed, the phone in its kept form. */
export function cleanBoxes(boxes: BoxSettings): BoxSettings {
  const clean = (b: BoxSetting): BoxSetting => ({ address: b.address.trim(), phone: phoneAsKept(b.phone), numberId: b.numberId.trim() })
  return { team: clean(boxes.team), bids: clean(boxes.bids) }
}

/** The row's words, each box's three fields in one order. */
export function boxesText(boxes: BoxSettings): string {
  const c = cleanBoxes(boxes)
  const one = (b: BoxSetting) => ({ address: b.address, phone: b.phone, numberId: b.numberId })
  return JSON.stringify({ team: one(c.team), bids: one(c.bids) })
}

export function sameBoxes(a: BoxSettings, b: BoxSettings): boolean {
  return boxesText(a) === boxesText(b)
}

/** Each box's name on the card. */
export const BOX_TITLE: Readonly<Record<Mailbox, string>> = { team: 'Team inbox', bids: 'Bids inbox' }

const plural = (kind: string) => `${kindWord(kind as ContactKind)}s`

/** Who a box is for, from the box rules: "For customers, leads, subs and candidates." */
export function boxForWords(box: Mailbox): string {
  const kinds = BOXES[box].kinds.map(plural)
  const list = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}` : (kinds[0] ?? '')
  return `For ${list}.`
}

/** What an empty field means: the box keeps today's one number or mailbox, which only the server knows. */
export const BOX_EMPTY_WORDS: Readonly<Record<Mailbox, string>> = {
  team: 'Empty means the app keeps using today’s company number.',
  bids: 'Empty means the app keeps using today’s bids@.',
}

/** What stops a save, in the card's words; null when the boxes can be saved. Every field empty can be saved. */
export function boxesProblem(boxes: BoxSettings): string | null {
  const c = cleanBoxes(boxes)
  for (const box of MAILBOXES) {
    const b = c[box]
    const name = BOX_TITLE[box]
    if (b.address && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(b.address)) return `The ${name}’s address does not look like an email address.`
    if (b.phone && !phoneDigits(b.phone)) return `Give the ${name} a phone number with ten digits.`
    if (b.numberId && !QUO_NUMBER_ID.test(b.numberId)) return `The ${name}’s Quo number id starts with PN.`
    if (Boolean(b.phone) !== Boolean(b.numberId)) return `Give the ${name} its phone and its Quo number id together, or neither.`
  }
  const [t, s] = [c.team, c.bids]
  if (t.address && normalizeCustomerEmail(t.address) === normalizeCustomerEmail(s.address)) return 'The two inboxes cannot share an address.'
  if (t.phone && phoneDigits(t.phone) === phoneDigits(s.phone)) return 'The two inboxes cannot share a phone number.'
  if (t.numberId && t.numberId === s.numberId) return 'The two inboxes cannot share a Quo number id.'
  return null
}

export const BOXES_INTRO = 'The app has two inboxes, one for our own customers and one for the GC side.'
export const BOXES_WHEN = 'The app starts using these once the two inboxes are switched on.'
export const BOXES_SAVED_TOAST = 'Saved. The app starts using these once the two inboxes are switched on.'
export const BOXES_NOT_SAVED = 'The inboxes were not saved. Only the owner or a dev can change them.'
