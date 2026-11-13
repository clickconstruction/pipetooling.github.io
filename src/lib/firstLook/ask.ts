/**
 * First look on a thread (punch list #319 PR 1): the office's ask for photos. A `/show` in the reply box, or a press on
 * the look's card, puts one line in the box that names who is writing and ends with a link made for this thread. The
 * line holds the blank `{show}` until the link is back (`mint_first_look`), as a rating ask holds `{rate}`, so the
 * send waits on the link and never on the person. Pure: the words, the `/` words that call it, and the link.
 */
import { APP_LINE_PREFIX } from '../messages/stageLines'
import type { QuickReply } from '../quickReplies/kernel'
import { firstLookAskLine } from './look'

/** The blank the ask's link fills. */
export const SHOW_BLANK = '{show}'

export const SHOW_ASK_WORDS = {
  /** The row in the `/` list and the press on the card. */
  press: 'Ask for photos',
  more: 'Ask for more',
  again: 'Ask again',
  making: 'Making the link for their photos…',
  notMade: 'The link for their photos was not made.',
} as const

/** The words after a `/` that call the ask: two letters or more that start one of them, or a word one of them starts. */
export const SHOW_WORDS: readonly string[] = ['show', 'photo', 'photos', 'picture', 'pictures', 'video', 'look']

export function slashCallsShow(words: string): boolean {
  const typed = words.trim().toLowerCase()
  if (typed.length < 2) return false
  return SHOW_WORDS.some((w) => w.startsWith(typed) || typed.startsWith(w))
}

/** The app's own line for the ask: never written, never counted as a press, never edited (`isAppLine`). */
export const SHOW_ASK_ID = `${APP_LINE_PREFIX}show`

/**
 * The ask as a line the `/` list draws. Their first name is in it already, or left out for a number nobody has named,
 * so the box never waits on a name. `{me}` and `{show}` are the box's to fill.
 */
export function showAskLine(first: string | null): QuickReply {
  return {
    id: SHOW_ASK_ID,
    text: firstLookAskLine({ customerFirst: first, me: '{me}', url: SHOW_BLANK }),
    textEs: firstLookAskLine({ customerFirst: first, me: '{me}', url: SHOW_BLANK, lang: 'es' }),
    for: 'any',
    stepId: null,
    scope: 'team',
    addedBy: 'app',
    addedAt: 0,
    removed: false,
    uses: {},
    lastUsed: null,
    shortcut: 'show',
  }
}

export { showUsLink } from './look'

/** The box after the ask is put in: an empty box takes the line, words already there keep their place above it. */
export function withAsk(body: string, ask: string): string {
  const was = body.trimEnd()
  return was ? `${was}\n${ask}` : ask
}
