/**
 * The Bridge is a pulse (punch list #334, PR 7): the words the page uses now that it makes no call.
 *
 * The owner: "Why would Friday ask if the numbers move? Shouldn't this page always be a direct reflection of whatever
 * the current status is, like a pulse?" So the card on the first screen is a reading of today. It is not named a
 * call, it records nothing and it promises no question on Friday. These are its few words, and the step desk's.
 *
 * Pure: words only.
 */

/** The card's name on the first screen. */
export const NOW_CARD_LABEL = 'What to do now'

/** The card's line while the five steps are not read yet. */
export const NOW_NOT_READ_LINE = 'The list opens once they are.'

/** The step desk's press, which goes up to the card. */
export const NOW_GO_PRESS = 'Go to what to do now'

/** The chip on a move in the step desk's whole list: on the card at the top, or not. */
export const NOW_ON_LIST = 'on the list'
export const NOW_NOT_ON_LIST = 'not on it'

/** The line under the step desk's list: how many the card shows. Empty when the card shows them all. */
export function nowDeskFoot(total: number, shown: number): string {
  if (total <= shown) return ''
  return `The list at the top shows the first ${shown === 2 ? 'two' : 'three'}.`
}
