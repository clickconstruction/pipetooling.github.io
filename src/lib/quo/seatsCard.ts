/**
 * Messages, cut 5's screens: Settings → Phone and texts → **Company phone seats**. A seat is one of Quo's workspace
 * users, by Quo's id ("US…"), and the user of ours who answers on it: `quo-send` texts as the sender's own seat, and
 * `quo-webhook` names a call or a text by the seat it rang. The row is `app_settings` `messages_quo_seats_v1`, the
 * same `{"US…": "<user id>"}` the functions read (`seatsSource` in `quo/rows.ts`). Pure.
 */

export interface QuoSeatRow {
  quoUserId: string
  /** Ours; '' while the person is not picked yet. */
  userId: string
}

/** Quo's user ids start with US. */
export const QUO_USER_ID = /^US[A-Za-z0-9]+$/

/** The row's words as seats, in their order. Words that are not a JSON object of ids read as no seats. */
export function parseQuoSeats(valueText: string | null | undefined): QuoSeatRow[] {
  let parsed: unknown
  try {
    parsed = valueText ? JSON.parse(valueText) : {}
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
  return Object.entries(parsed as Record<string, unknown>)
    .filter((pair): pair is [string, string] => typeof pair[1] === 'string' && pair[1].trim() !== '')
    .map(([quoUserId, userId]) => ({ quoUserId: quoUserId.trim(), userId: userId.trim() }))
}

/** The seats as the row keeps them, each Quo id trimmed. */
export function quoSeatsText(rows: readonly QuoSeatRow[]): string {
  const out: Record<string, string> = {}
  for (const r of rows) out[r.quoUserId.trim()] = r.userId
  return JSON.stringify(out)
}

export function sameQuoSeats(a: readonly QuoSeatRow[], b: readonly QuoSeatRow[]): boolean {
  return quoSeatsText(a) === quoSeatsText(b)
}

/** What stops a save, in the card's words; null when the seats can be saved. No seats at all can be saved. */
export function quoSeatsProblem(rows: readonly QuoSeatRow[]): string | null {
  if (rows.some((r) => !QUO_USER_ID.test(r.quoUserId.trim()))) return 'Give each seat its Quo user id. They start with US.'
  const ids = rows.map((r) => r.quoUserId.trim())
  if (new Set(ids).size !== ids.length) return 'A Quo user id is on two seats. Each seat is one id.'
  if (rows.some((r) => !r.userId)) return 'Pick who answers on each seat.'
  const people = rows.map((r) => r.userId)
  if (new Set(people).size !== people.length) return 'A person is on two seats. Each person has one seat.'
  return null
}

export const QUO_SEATS_INTRO = 'A seat is one person’s place in Quo, the app the company number runs on.'
export const QUO_SEATS_WHY = 'Match each seat to the person who answers on it. A text from the reply box then goes from the sender’s seat. The thread names whose seat a call rang.'
export const QUO_SEATS_NONE = 'No seats yet. Until there are, texts go from the company number with no one’s seat.'
export const QUO_SEATS_SAVED_TOAST = 'Saved. Calls and texts go by these seats from now on.'
