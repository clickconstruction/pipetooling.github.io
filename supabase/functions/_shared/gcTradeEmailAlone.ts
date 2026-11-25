/**
 * gc-trade-email, one email a person (punch list #205). A trade email goes as one message: the first person on To and
 * the rest on CC. The mail service refuses the whole message when it refuses one address, so one bad address stopped the
 * word to everyone at the company, and no row was written. The owner's answer of 2026-11-25: send one email a person.
 *
 * A caller that asks for it (`eachAlone`, today the project card's Word to every trade) gets this instead:
 *  - The one message is tried first, as before. When it goes, nothing here changes.
 *  - When the service refuses it, each person is sent the email alone. The ones that go are the row's `to_names`. Each
 *    one the service refuses is held, by name, with the service's own reason.
 *  - Only when nobody goes is the send refused, as before, with no row.
 *  - A second press of the same key sends nothing to a person on the row. A person who gets these emails and is not on
 *    the row is owed: the email goes to that person alone, and the row gains the name. That is the retry for a person
 *    held the first time, once the address is mended.
 *
 * Pure, with the sender passed in, so vitest runs every path (`src/lib/gc/gcTradeEmailAlone.test.ts`). It lives beside
 * `gcTradeEmail.ts` and not in it: four functions bundle that file, and only `gc-trade-email` bundles this one.
 */

/** A person the email can reach: `tradeEmailReach`'s row. */
export interface TradeReachPerson {
  name: string
  email: string
}

/** A person the mail service refused, by the name the office knows, with the service's own reason on one line. */
export interface TradeEmailHeld {
  name: string
  reason: string
}

/** What one send answered: `sendEmailViaResend`'s answer. */
export interface TradeSendAnswer {
  success: boolean
  error?: string
  resendEmailId?: string
}

/** One email that went: who was on To, who was on CC, and the mail service's id for it. */
export interface TradeMailSent {
  to: TradeReachPerson
  cc: TradeReachPerson[]
  resendEmailId: string | null
}

/** What a send came to: the emails that went and who was held, or nobody reached and the reason. */
export type TradeSendOutcome =
  | { went: true; mails: TradeMailSent[]; held: TradeEmailHeld[] }
  | { went: false; reason: string; held: TradeEmailHeld[] }

/** A held reason is one line, cut here. */
export const TRADE_HELD_REASON_MAX = 200

/** The words when the service gave none. */
export const TRADE_HELD_NO_REASON = 'The mail service refused it and gave no reason.'

/**
 * The request's `eachAlone`, read from the body as it came: true or false, and null when it is anything else, which is a
 * bad request. Unset is false, so every caller that does not ask is sent to as before.
 */
export function readEachAlone(body: unknown): boolean | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  const v = (body as Record<string, unknown>).eachAlone
  if (v === undefined) return false
  return typeof v === 'boolean' ? v : null
}

/** The service's reason as the office reads it: one line, cut at 200 characters, never empty. */
export function tradeHeldReason(error: unknown): string {
  const said = (typeof error === 'string' ? error : error instanceof Error ? error.message : '').replace(/\s+/g, ' ').trim()
  if (!said) return TRADE_HELD_NO_REASON
  return said.length > TRADE_HELD_REASON_MAX ? `${said.slice(0, TRADE_HELD_REASON_MAX - 1)}…` : said
}

/** The name a held person is listed by: the name on record, else the address, which the office also knows them by. */
export function tradeHeldName(person: TradeReachPerson): string {
  return person.name.trim() || person.email.trim()
}

const sameName = (name: string): string => name.trim().toLowerCase()

/**
 * Who is owed on a second press of a key: each person the email can reach whose name is not on the row. The row keeps
 * names and no addresses, so two people of one name at a company count as one, and neither is sent to twice.
 */
export function tradeEmailOwed(reach: readonly TradeReachPerson[], toNames: readonly string[]): TradeReachPerson[] {
  const have = new Set(toNames.map(sameName))
  return reach.filter((r) => !have.has(sameName(r.name)))
}

/** The row's names after more people got it: the ones before, then each new one once. */
export function tradeNamesWith(before: readonly string[], went: readonly string[]): string[] {
  const out = [...before]
  const have = new Set(before.map(sameName))
  for (const name of went) {
    if (have.has(sameName(name))) continue
    have.add(sameName(name))
    out.push(name)
  }
  return out
}

/** Everyone the emails that went reached, in order: each email's To, then its CC. */
export function tradeMailsReached(mails: readonly TradeMailSent[]): TradeReachPerson[] {
  return mails.flatMap((m) => [m.to, ...m.cc])
}

async function sendAlone(
  people: readonly TradeReachPerson[],
  send: (to: TradeReachPerson, cc: TradeReachPerson[]) => Promise<TradeSendAnswer>,
  pause: () => Promise<void>,
): Promise<{ mails: TradeMailSent[]; held: TradeEmailHeld[] }> {
  const mails: TradeMailSent[] = []
  const held: TradeEmailHeld[] = []
  for (const person of people) {
    await pause()
    // A send that throws (the network, not the service's refusal) holds that person and never stops the rest.
    const answer = await send(person, []).catch((e: unknown): TradeSendAnswer => ({ success: false, error: tradeHeldReason(e) }))
    if (answer.success) mails.push({ to: person, cc: [], resendEmailId: answer.resendEmailId ?? null })
    else held.push({ name: tradeHeldName(person), reason: tradeHeldReason(answer.error) })
  }
  return { mails, held }
}

/**
 * Send one trade email to the people it can reach.
 *
 * - `aloneOnly` (a second press, to the people owed): each person alone, no message to all of them first.
 * - Otherwise the one message first: the first person on To, the rest on CC. When the service refuses it and the caller
 *   asked for `eachAlone`, each person is sent it alone. With one person there is nobody else to try.
 *
 * It keeps going past a person the service refuses and names each with the reason. `pause` runs before each email that
 * goes alone, so a run of them stays under the mail service's rate. `reach` is never empty: the caller refuses that
 * first (`noEmail`).
 */
export async function sendTradeEmailToReach(args: {
  reach: readonly TradeReachPerson[]
  eachAlone: boolean
  aloneOnly?: boolean
  send: (to: TradeReachPerson, cc: TradeReachPerson[]) => Promise<TradeSendAnswer>
  pause?: () => Promise<void>
}): Promise<TradeSendOutcome> {
  const { reach, eachAlone, send } = args
  const pause = args.pause ?? (() => Promise.resolve())
  const [first, ...rest] = reach
  if (!first) return { went: false, reason: TRADE_HELD_NO_REASON, held: [] }

  let refusal: string | null = null
  if (!args.aloneOnly) {
    const one = await send(first, rest)
    if (one.success) return { went: true, mails: [{ to: first, cc: rest, resendEmailId: one.resendEmailId ?? null }], held: [] }
    refusal = tradeHeldReason(one.error)
    if (!eachAlone || rest.length === 0) return { went: false, reason: refusal, held: [] }
  }

  const { mails, held } = await sendAlone(reach, send, pause)
  if (mails.length === 0) return { went: false, reason: refusal ?? held[0]?.reason ?? TRADE_HELD_NO_REASON, held }
  return { went: true, mails, held }
}
