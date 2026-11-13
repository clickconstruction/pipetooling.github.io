/**
 * Cards and footers (punch list #313) — who sees each of the two cards. One copy, read by the card
 * that draws itself and by the Settings search row that leads to it, so a row never lands a person
 * on a tab where their card is not drawn.
 */
import type { UserRole } from '../../hooks/useAuth'
import { isOwnerOrDev } from '../gc/access'

/**
 * *Your card and footer* on Settings → Your account: every role but a subcontractor, who is not on
 * the company's card.
 */
export function makesOwnCard(role: UserRole | null | undefined): boolean {
  return role != null && role !== 'subcontractor'
}

/**
 * *Card and footer looks* on Settings → People & teams: the owner approves a look or a size and a
 * dev draws one, so the card is theirs alone (v2.7139; a dev's alone before). The database holds
 * the same line: the two settings take a write from `is_master_or_dev()`
 * (`20261113130000_card_looks_keys_owner.sql`).
 */
export function approvesCardLooks(role: UserRole | null | undefined): boolean {
  return isOwnerOrDev(role)
}
