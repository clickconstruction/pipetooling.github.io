/**
 * First look, the spike (punch list #319, v2.6981): the pure rules the pages share with the `first-look` function.
 * They live in `supabase/functions/_shared/firstLook.ts`, which has no imports, so the function and the app's tests
 * read one copy.
 */
export * from '../../../supabase/functions/_shared/firstLook'

import type { UserRole } from '../../hooks/useAuth'
import { APP_ORIGIN } from '../appOrigin'
import { isOwnerOrDev } from '../gc/access'

/** The desk's address. */
export const FIRST_LOOKS_PATH = '/first-looks'

/** The customer's page for a code, on the app's own origin while the short host has no `/show/` line. */
export function showUsPath(code: string): string {
  return `/show/${code}`
}

/** The customer's page for a code, as the text carries it. */
export function showUsLink(code: string, origin: string = APP_ORIGIN): string {
  return `${origin}${showUsPath(code)}`
}

/** Who opens the desk while this is a spike: the owner and the developers. */
export function canOpenFirstLooks(role: UserRole | null | undefined): boolean {
  return isOwnerOrDev(role)
}
