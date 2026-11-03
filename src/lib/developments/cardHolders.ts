/**
 * Who holds the card a charge went on (v2.6457, punch list #250 PR 2, the Scoreboard's card rows):
 * the person the card is linked to (`mercury_debit_card_user_links`), else the card's nickname
 * (`mercury_debit_card_nicknames`, the name Banking shows), else the card's short id, else *Card*
 * when the bank record names no card. The bank record's card id is read on its own, never the
 * whole record (`fetchCardHolders.ts`). Pure.
 */
import { formatMercuryDebitCardIdCompact } from '../../../supabase/functions/_shared/mercuryRawDebitCard'

export type CardHolder = {
  /** The card's id, lowercased; null when the bank record names no card. */
  cardId: string | null
  /** The words the board shows for the holder. */
  name: string
  /** The person the card is linked to, for the viewer's gold row; null for a company card or no link. */
  userId: string | null
}

export type CardHoldersRead = { state: 'off' } | { state: 'reading' } | { state: 'read'; byTxId: ReadonlyMap<string, CardHolder> } | { state: 'failed' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** The card id a bank record carries at either of its two places, as `mercuryDebitCardIdFromRaw` reads it; null when neither is a card id. */
export function cardIdOf(a: string | null | undefined, b: string | null | undefined): string | null {
  for (const v of [a, b]) {
    const t = typeof v === 'string' ? v.trim() : ''
    if (t && UUID_RE.test(t)) return t.toLowerCase()
  }
  return null
}

/** The holder of one card: linked person, nickname, short id, in that order. */
export function cardHolderOf(
  cardId: string | null,
  look: { userIdByCard: ReadonlyMap<string, string>; nicknameByCard: ReadonlyMap<string, string>; names: ReadonlyMap<string, string> },
): CardHolder {
  if (!cardId) return { cardId: null, name: 'Card', userId: null }
  const userId = look.userIdByCard.get(cardId) ?? null
  const person = userId ? look.names.get(userId)?.trim() : ''
  if (userId && person && person !== '—') return { cardId, name: person, userId }
  const nick = look.nicknameByCard.get(cardId)?.trim()
  if (nick) return { cardId, name: nick, userId }
  return { cardId, name: `Card ${formatMercuryDebitCardIdCompact(cardId)}`, userId }
}
