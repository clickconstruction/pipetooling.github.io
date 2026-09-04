// Debit cards (v2.2750): one directory for what a Mercury debit card is called,
// whether it is a person's card or a company (management-tool) card, and which
// person it belongs to. The Debit cards modal edits all three in one row; the
// Wheels report reads roles to keep company cards out of anyone's fuel.

import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

export type DebitCardRole = 'person' | 'company'

export function parseDebitCardRole(raw: unknown): DebitCardRole {
  return raw === 'company' ? 'company' : 'person'
}

export const DEBIT_CARD_ROLE_OPTIONS: ReadonlyArray<{ key: DebitCardRole; label: string; hint: string }> = [
  { key: 'person', label: "Person's card", hint: 'Fuel on it counts as that person’s once the card is linked.' },
  { key: 'company', label: 'Company card', hint: 'Management tools — GPS, charging, subscriptions. Never anyone’s fuel.' },
]

export type DebitCardDirectory = {
  nicknameByCard: Record<string, string>
  roleByCard: Record<string, DebitCardRole>
}

/** Nicknames + roles, keyed by lower-cased card id. */
export async function loadDebitCardDirectory(): Promise<DebitCardDirectory> {
  const rows = await withSupabaseRetry(async () => await supabase.from('mercury_debit_card_nicknames').select('*'), 'load debit card directory')
  const nicknameByCard: Record<string, string> = {}
  const roleByCard: Record<string, DebitCardRole> = {}
  for (const r of rows ?? []) {
    const id = String(r.mercury_debit_card_id).toLowerCase()
    nicknameByCard[id] = r.nickname
    roleByCard[id] = parseDebitCardRole(r.card_role)
  }
  return { nicknameByCard, roleByCard }
}

/** A role needs a nickname row to live on (the table requires a non-empty nickname). */
export async function saveDebitCardRole(cardId: string, role: DebitCardRole): Promise<void> {
  await withSupabaseRetry(
    async () =>
      await supabase
        .from('mercury_debit_card_nicknames')
        .update({ card_role: role, updated_at: new Date().toISOString() })
        .eq('mercury_debit_card_id', cardId.toLowerCase()),
    'save debit card role',
  )
}

export type DebitCardLink = { userId: string | null; autoAssignUserId: string | null }

export async function loadDebitCardLinks(cardIds: readonly string[]): Promise<Record<string, DebitCardLink>> {
  if (cardIds.length === 0) return {}
  const rows = await withSupabaseRetry(
    async () => await supabase.from('mercury_debit_card_user_links').select('mercury_debit_card_id, user_id, auto_assign_user_id').in('mercury_debit_card_id', [...cardIds]),
    'load debit card links',
  )
  const out: Record<string, DebitCardLink> = {}
  for (const r of rows ?? []) out[String(r.mercury_debit_card_id).toLowerCase()] = { userId: r.user_id ?? null, autoAssignUserId: r.auto_assign_user_id ?? null }
  return out
}

/**
 * Link a card to a person: the Tally user and the auto-assign user become the
 * same person, and existing unattributed purchases on the card are backfilled.
 * `null` removes the link (attributions already saved stay).
 * Returns how many past purchases the backfill stamped.
 */
export async function saveDebitCardPerson(cardId: string, userId: string | null, authUserId: string | null): Promise<number> {
  const id = cardId.toLowerCase()
  if (userId == null) {
    await withSupabaseRetry(async () => await supabase.from('mercury_debit_card_user_links').delete().eq('mercury_debit_card_id', id), 'remove debit card link')
    return 0
  }
  const now = new Date().toISOString()
  const existing = await withSupabaseRetry(
    async () => await supabase.from('mercury_debit_card_user_links').select('mercury_debit_card_id').eq('mercury_debit_card_id', id).maybeSingle(),
    'check debit card link',
  )
  if (existing) {
    await withSupabaseRetry(
      async () => await supabase.from('mercury_debit_card_user_links').update({ user_id: userId, auto_assign_user_id: userId, updated_at: now }).eq('mercury_debit_card_id', id),
      'update debit card link',
    )
  } else {
    if (!authUserId) throw new Error('Not signed in.')
    await withSupabaseRetry(
      async () =>
        await supabase.from('mercury_debit_card_user_links').insert({ mercury_debit_card_id: id, user_id: userId, auto_assign_user_id: userId, created_by: authUserId, updated_at: now }),
      'insert debit card link',
    )
  }
  const count = await withSupabaseRetry(
    async () => await supabase.rpc('backfill_mercury_auto_attributions_for_debit_card', { p_mercury_debit_card_id: id }),
    'backfill debit card attributions',
  )
  return typeof count === 'number' ? count : 0
}

/** Door from anywhere to the Debit cards modal, opened on one card. */
export function debitCardsHref(cardId?: string | null): string {
  return cardId ? `/banking?tab=sorting&cards=${encodeURIComponent(cardId)}` : '/banking?tab=sorting&cards=1'
}
