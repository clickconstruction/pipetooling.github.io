/**
 * The presses on a Person Desk's head row (v2.7813), in the order they are drawn. A press that
 * cannot work is left off the row, never drawn dead: Imitate signs in as the person, so it needs a
 * login that is attached. Before this it drew for a row with an address and no login, and a press
 * on it did nothing and said nothing. Pure.
 */
export type DeskHeadPress = 'review' | 'email' | 'imitate' | 'more'

export type DeskHeadRowFacts = {
  /** The person has a users row (an account), so there is a schedule to review. */
  hasAccount: boolean
  /** The account's address, when it has one. */
  email: string | null | undefined
  /** A login is attached to the account, so someone can sign in as them. */
  loginAttached: boolean
  /** The viewer may imitate (devs). */
  mayImitate: boolean
  /** The viewer may start or end employment, and the desk offers those windows. */
  mayOpenFlow: boolean
}

export function deskHeadPresses(f: DeskHeadRowFacts): DeskHeadPress[] {
  const out: DeskHeadPress[] = []
  const hasEmail = Boolean(f.email)
  if (f.hasAccount) out.push('review')
  if (hasEmail) out.push('email')
  if (f.mayImitate && hasEmail && f.loginAttached) out.push('imitate')
  if (f.mayOpenFlow) out.push('more')
  return out
}
