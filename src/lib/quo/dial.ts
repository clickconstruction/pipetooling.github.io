/**
 * To-do #152 (v2.5803): **Call in Quo** or **Call from my phone**. Every Call button in the app was a `tel:` link, so on
 * a phone the call went out from the person's own number and Quo never saw it. Quo's phone app opens on a link,
 * `openphone://dial?number=…&from=…&action=call`, and dials from the company number; Quo's API cannot place a call for
 * a person, and a desk has no link at all, only the one-time setting that makes Quo the computer's default calling
 * app. The owner's one change to the proposal (2026-10-23): "the user can choose to call with QO or on their own
 * phone." So the choice is the person's, at the press: a seat holder's first Call on a phone opens a small sheet with
 * the two ways, the pick is kept on that phone (`localStorage`, as Show Mine · Everyone is), the next press is one tap
 * again, and a ▾ beside the button brings the sheet back. The button says **Call in Quo** only when that is what it
 * will do. Pure; `useCallThrough` reads the seats, the boxes and the device, `CallButton` draws it.
 */
import { telHrefFor } from '../phoneContact'
import { phoneWords as dashedWords } from '../messages/boxes'
import { phoneWords, toE164 } from './events'
import { isSharedSeat } from './rows'

export type CallThrough = 'quo' | 'phone'

export const CALL_THROUGH_KEY = 'messages_call_through'

/** A number as plain words read it, with no parentheses: *512-555-0144*. One outside the US and Canada as it came. */
export function numberWords(raw: string): string {
  return dashedWords(phoneWords(raw))
}

export const DIAL_WORDS = {
  /** The verb's tail when the press goes through Quo: *Call in Quo*, *Call back in Quo*. */
  inQuo: 'in Quo',
  quoWay: 'Call in Quo',
  phoneWay: 'Call from my phone',
  quoNote: (from: string | null) => `Dials from ${from ? numberWords(from) : 'the company number'}. Quo writes the call in the thread.`,
  phoneNote: 'Dials from your own number. Quo does not see the call.',
  kept: 'Kept on this phone',
  keptLine: 'The app keeps your pick on this phone. Press ▾ beside Call to change it.',
  storeLine: 'No Quo app on this phone? Quo sends you to the store.',
  /** The ▾'s name. */
  change: 'Call another way',
  title: (name: string | null | undefined, number: string) => `Call ${name?.trim() || numberWords(number)}`,
  deskTitle: 'Calls on a computer',
  deskLine: 'Call opens the app your computer uses for calls.',
  deskQuo: 'To call through Quo, set Quo as the default for calls once.',
  deskMac: 'On a Mac, open FaceTime, then its Settings, and pick Quo under Default for calls.',
  deskWindows: 'On Windows, open Settings, Apps, Default apps, choose by link type, and pick Quo for TEL.',
  deskGuide: 'How calls go',
  deskGuideHref: '/help/call-a-customer-from-a-task',
} as const

/** The button's words: the verb, with *in Quo* when that is what the press does. */
export function callWords(verb: string, through: CallThrough): string {
  return through === 'quo' ? `${verb} ${DIAL_WORDS.inQuo}` : verb
}

/**
 * Whether this is a phone, where Quo's link can open its app. An iPhone, an iPod and Android say so; an iPad reads as
 * a Mac since iPadOS 13, so a Mac with a touch screen is one. A desk is everything else, the browser pane's mobile
 * preset included only once it wears a phone's user agent.
 */
export function isPhoneDevice(userAgent: string, touchPoints = 0): boolean {
  if (/iPhone|iPod|iPad|Android/i.test(userAgent)) return true
  return /Macintosh/.test(userAgent) && touchPoints > 1
}

/**
 * Whether the signed-in person has a seat on the Company phone seats card: their own, or the one shared by the
 * office, since that login may be on their phone too. Nobody signed in has none.
 */
export function hasQuoSeat(userId: string | null | undefined, seats: ReadonlyArray<{ userId: string }>): boolean {
  if (!userId) return false
  return seats.some((s) => s.userId === userId || isSharedSeat(s.userId))
}

/**
 * Quo's link to dial a number from its phone app, as its deep-linking page gives it: the number in E.164 with `+`
 * written `%2B`, `from` the company number the call shows as, `action=call` so Quo dials at once (decision 1). Null
 * when the number is not one Quo's link can carry: a number outside the US and Canada, or one with an extension,
 * which `toE164` reads as no number; those stay `tel:`.
 */
export function quoDialHref(number: string, from?: string | null): string | null {
  const to = toE164(number)
  if (!to) return null
  const fromE164 = from ? toE164(from) : null
  const params = [`number=${encodeURIComponent(to)}`, ...(fromE164 ? [`from=${encodeURIComponent(fromE164)}`] : []), 'action=call']
  return `openphone://dial?${params.join('&')}`
}

type ReadStore = Pick<Storage, 'getItem'>
type WriteStore = Pick<Storage, 'setItem' | 'removeItem'>

const localStore = (): Storage | null => (typeof localStorage === 'undefined' ? null : localStorage)

/** The way kept on this phone; null until the person has picked once, or when the browser keeps nothing. */
export function readCallThrough(storage: ReadStore | null = localStore()): CallThrough | null {
  try {
    const v = storage?.getItem(CALL_THROUGH_KEY)
    return v === 'quo' || v === 'phone' ? v : null
  } catch {
    return null
  }
}

export function keepCallThrough(pick: CallThrough | null, storage: WriteStore | null = localStore()): void {
  try {
    if (pick) storage?.setItem(CALL_THROUGH_KEY, pick)
    else storage?.removeItem(CALL_THROUGH_KEY)
  } catch {
    // A browser that keeps nothing asks again next time.
  }
}

/** One way to make the call, as the sheet draws it. */
export interface CallWay {
  through: CallThrough
  href: string
  words: string
  note: string
  /** The way kept on this phone, marked. */
  kept: boolean
}

export interface CallPlanInput {
  number: string
  /** The company number the call shows as: the box the thread texts from (decision 4). Null when the boxes are not read. */
  from?: string | null
  seat: boolean
  phone: boolean
  kept: CallThrough | null
  /** The button's verb: *Call*, *Call back*, *Call them*. */
  verb?: string
}

export interface CallPlan {
  /** The link the button is, or null when a press opens the sheet instead: a seat holder's first press on a phone. */
  href: string | null
  /** The button's words: the verb, *in Quo* only when the press goes through Quo (decision 5). */
  words: string
  /** What the button does: Quo, or the phone's own dialer. */
  through: CallThrough
  /**
   * What the ▾ beside the button opens: the two ways for a seat holder on a phone, the one-time desk words for a seat
   * holder on a computer, nothing for anyone with no seat or a number Quo's link cannot carry.
   */
  sheet: 'ways' | 'desk' | null
  ways: CallWay[]
}

/**
 * What the button is, from the seat, the device, the kept pick and the number. No seat: `tel:` as it always was. A
 * seat on a desk: `tel:` with the desk's words a ▾ away. A seat on a phone: the first press asks, the kept way then
 * dials at once, and the ▾ asks again. No silent default: nobody is sent through Quo on a press they did not pick.
 */
export function planCall({ number, from = null, seat, phone, kept, verb = 'Call' }: CallPlanInput): CallPlan {
  const tel = telHrefFor(number)
  const quo = seat && phone ? quoDialHref(number, from) : null
  if (!seat) return { href: tel, words: verb, through: 'phone', sheet: null, ways: [] }
  if (!phone) return { href: tel, words: verb, through: 'phone', sheet: 'desk', ways: [] }
  if (!quo) return { href: tel, words: verb, through: 'phone', sheet: null, ways: [] }
  const ways: CallWay[] = [
    { through: 'quo', href: quo, words: DIAL_WORDS.quoWay, note: DIAL_WORDS.quoNote(from), kept: kept === 'quo' },
    { through: 'phone', href: tel, words: DIAL_WORDS.phoneWay, note: DIAL_WORDS.phoneNote, kept: kept === 'phone' },
  ]
  if (!kept) return { href: null, words: verb, through: 'phone', sheet: 'ways', ways }
  const way = ways.find((w) => w.through === kept)!
  return { href: way.href, words: callWords(verb, kept), through: kept, sheet: 'ways', ways }
}
