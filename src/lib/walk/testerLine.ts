/**
 * The walk tester's one line on Settings → System → Digital twins & samples (punch list #142 PR 3, v2.5738; README
 * decision 5: a hidden account with send rights is never invisible to the owner). The tester is `users.is_walk_tester`,
 * made by the walk kit's `walk` function and kept between walks; its last walk is the kit's `madeAt` while a kit
 * stands, else the account's last sign-in. Pure: the words from the rows.
 */
import { parseWalkKit } from './kit'

export interface WalkTesterRow {
  id: string
  email: string | null
  read_only: boolean | null
  last_sign_in_at: string | null
}

export interface WalkTesterLine {
  /** The one line, as the card shows it. */
  words: string
  /** Whether a tester account exists. */
  present: boolean
}

export const NO_TESTER_WORDS = 'No walk tester yet. The walk kit makes one on its first run.'

const dayWords = (iso: string, tz: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric' }).format(new Date(iso))

/**
 * The line: *Walk tester · training mode · last walk Oct 22* (the kit's `madeAt` while a kit stands, else the account's
 * last sign-in, else *no walk yet*), and *not in training mode* in place of the mode when the flag is somehow off.
 */
export function walkTesterLine(tester: WalkTesterRow | null, kitValueText: string | null | undefined, tz: string): WalkTesterLine {
  if (!tester) return { words: NO_TESTER_WORDS, present: false }
  const kit = parseWalkKit(kitValueText)
  const last = kit?.madeAt ?? tester.last_sign_in_at
  const mode = tester.read_only ? 'training mode' : 'not in training mode'
  const walk = last ? `last walk ${dayWords(last, tz)}` : 'no walk yet'
  return { words: `Walk tester · ${mode} · ${walk}`, present: true }
}
