/**
 * My way (v2.5597, punch list #115 PR 6): per person and per moment, whether the Tell the customer sheet asks first or
 * sends and shows the receipt. The principle holds either way: they know. Pure; the row is `tell_customer_prefs`
 * (`myWayIo.ts`); the card is `components/settings/MyWayCard.tsx`; the sheet reads it on open.
 */
import type { TellMoment } from './tellCustomer'

export type MyWay = 'ask' | 'send'

/** The moments a person picks a way for: a booking and an estimate. A moved visit follows the booking's; a board's move (v2.5627) always asks, since the person is there. */
export type MyWayMoment = 'booked' | 'estimate'

/** The moments the card offers, in its order. */
export const MY_WAY_MOMENTS: readonly MyWayMoment[] = ['booked', 'estimate']

export type MyWays = Readonly<Record<MyWayMoment, MyWay>>

/** Nobody has said: the sheet asks first. */
export const MY_WAY_DEFAULT: MyWays = { booked: 'ask', estimate: 'ask' }

/** The way for a moment; a moved visit follows the booking's, and a board's move always asks. */
export function myWayFor(ways: MyWays, moment: TellMoment): MyWay {
  if (moment === 'booked' || moment === 'estimate') return ways[moment]
  return moment === 'rescheduled' ? ways.booked : 'ask'
}

/** The row as stored, read fail-soft: an unknown word reads as ask. */
export function myWaysFrom(row: { booked?: unknown; estimate?: unknown } | null | undefined): MyWays {
  const way = (v: unknown): MyWay => (v === 'send' ? 'send' : 'ask')
  return { booked: way(row?.booked), estimate: way(row?.estimate) }
}

export const MY_WAY_WORDS = {
  title: 'My way',
  hint: 'The sheet can ask you first, or send and show you the receipt. Pick for a booking and for an estimate.',
  moment: { booked: 'A booking’s first visit', estimate: 'An estimate' } as Readonly<Record<MyWayMoment, string>>,
  way: { ask: 'Ask me first', send: 'Send it and show me the receipt' } as Readonly<Record<MyWay, string>>,
  saved: (moment: MyWayMoment, way: MyWay) => (way === 'send' ? `${MY_WAY_WORDS.moment[moment]}: the app sends and shows you the receipt.` : `${MY_WAY_WORDS.moment[moment]}: the app asks you first.`),
  /** On the sheet, when it sent by itself. */
  sentMyWay: 'Sent your way. Change it under Settings → Your account.',
} as const
