/**
 * Whom dev-login may sign in as (v2.6639). The dev door takes a secret and an address and mints a magic link, with no
 * caller behind it; login-as-user (Imitate and View as) records every imitation in `user_imitations` before its link
 * exists, so Messages → My email refuses the session it opens (v2.6290). A dev-login link was never on that record, so
 * one minted as a teammate would have read that teammate's Gmail through the app. The door now opens only the accounts
 * it was written for: a dev (`src/pages/DevLogin.tsx`'s fixed identity, `scripts/dev-pane-login.mjs`) and a digital twin
 * (`?as=twin:<role>`), and since v2.6652 the walk kit's tester (`users.is_walk_tester`, `docs/WALK_KIT.md`): a hidden
 * training-mode account with no mailbox, which the kit signs in through this door to press its three sends and which
 * can write nothing else, so a link minted as it reads nobody's Gmail. Everyone else is View as, on record. Pure, no
 * imports, so `src/lib/devLoginGate.test.ts` holds it.
 */

export type DevLoginAccount = { role: string | null; is_digital_twin: boolean | null; is_walk_tester?: boolean | null }

/** The words a refused address gets, with the door that opens that person instead. */
export const DEV_LOGIN_NOT_FOR_THEM = 'dev-login signs in a dev, a digital twin or the walk tester only. Open anyone else through View as, which puts the session on record so My email refuses it.'

/** A dev, a digital twin, or the walk tester: the accounts the dev door signs in. */
export function devLoginMayMint(account: DevLoginAccount | null | undefined): boolean {
  if (!account) return false
  return account.role === 'dev' || account.is_digital_twin === true || account.is_walk_tester === true
}
