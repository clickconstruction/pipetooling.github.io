/**
 * The three presses over the reply box on a text (punch list #319 PR 1b, the owner's ask of 2026-11-11): *Send Dana*
 * **Ask for photos** · **An estimate** · **A bill**, so nobody has to know that `/show`, `/estimate` and `/bill` exist.
 * A press and its word run the same code: Ask for photos puts the ask in as `/show` does, and the other two write
 * their word into the box, which opens the `/` list on that person's papers. Pure: the words, who sees the row, and
 * the box after a press.
 */
import { canOpenMessages } from '../gc/access'
import type { UserRole } from '../../hooks/useAuth'

export const SEND_PRESSES = {
  photos: 'Ask for photos',
  photosTip: 'Puts the ask in the box with a link made for them, where they add photos and a short video.',
  estimate: 'An estimate',
  estimateTip: 'Lists their estimates. Pick one and its line goes in the box with its link.',
  bill: 'A bill',
  billTip: 'Lists their bills. Pick one and its line goes in the box with its pay page.',
  /** The `/estimate` list's last row: with estimates to pick from, and with none. */
  startNewEstimate: 'Start a new estimate',
  startEstimate: 'Start an estimate',
  startEstimateHint: 'Opens a new estimate on them.',
  /** The `/bill` list with no open bill. */
  nothingOwed: 'Nothing is owed. Bill Customer makes a bill.',
} as const

/** Who the three presses are for: a customer, a lead, and a number nobody has named yet. */
export const SEND_PRESS_KINDS: readonly string[] = ['customer', 'lead', 'unknown']

/** The row's opening words: *Send Dana*, or *Send them* for a number nobody has named. Never a guessed pronoun. */
export function sendPressesHead(first: string | null): string {
  const who = first?.trim()
  return who ? `Send ${who}` : 'Send them'
}

/**
 * Whether the row draws: on a text to someone we may price for, for the office team, while the box is open and nothing
 * else has it (a folded box, the texts switch off, a team note that settles what we owe). A tech's Job Mode box never
 * draws it, and neither does a teammate's thread or a trade partner's.
 */
export function sendPressesShown(input: { role: UserRole | null | undefined; kind: string; who: string; folded: boolean; textWaits: boolean; settling: boolean }): boolean {
  return input.kind === 'text' && SEND_PRESS_KINDS.includes(input.who) && !input.folded && !input.textWaits && !input.settling && canOpenMessages(input.role)
}

/** The box after An estimate or A bill: the `/` word on a line of its own under what is written, the caret after it. */
export function withSlashWord(body: string, word: 'estimate' | 'bill'): { text: string; caret: number } {
  const was = body.trimEnd()
  const text = was ? `${was}\n/${word}` : `/${word}`
  return { text, caret: text.length }
}
