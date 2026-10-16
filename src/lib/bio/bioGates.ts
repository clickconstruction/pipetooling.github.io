/**
 * The tech's bio (v2.5587, punch list #114): who sees which block. The people whose press texts a customer are
 * primaries, helpers and the office team (the owner works jobs); the office team writes a bio on the person's desk.
 * Kept out of `bio.ts` so the kernel stays free of the app's role tables. A role arrives as the app's `UserRole` or as
 * the plain string a desk viewer or a users row carries; both are read the same way.
 */
import type { UserRole } from '../../hooks/useAuth'
import { GC_OFFICE_TEAM, MESSAGES_TECH_TEAM } from '../gc/access'

const has = (list: readonly UserRole[], role: string | null | undefined): boolean => role != null && (list as readonly string[]).includes(role)

/** Someone whose On my way texts a customer, so a bio can ride it. */
export function pressesOnMyWay(role: string | null | undefined): boolean {
  return has(MESSAGES_TECH_TEAM, role) || has(GC_OFFICE_TEAM, role)
}

/** Settings → Your account → Your bio draws for the people who press On my way. */
export function yourBioShown(role: string | null | undefined): boolean {
  return pressesOnMyWay(role)
}

/** The desk draws the bio for the office, on a person who presses On my way. */
export function bioOnDesk(viewerRole: string | null | undefined, personRole: string | null | undefined): boolean {
  return has(GC_OFFICE_TEAM, viewerRole) && pressesOnMyWay(personRole)
}
