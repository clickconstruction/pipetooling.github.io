/**
 * A page's own rows of tabs under the new phone layout (`newPhoneLayout.ts`): Jobs and People.
 *
 * Before the switch the Jobs page's tabs were a row 1,024 px wide in a 306 px window, with the page's title
 * taking the right of the same row. Nothing said the row went on, and the open tab could sit half past the
 * edge. People had the same row, then seven pills folded onto two rows.
 *
 * With the switch on each row is one line that scrolls sideways (`ScrollableTabStrip`, the app's own row):
 * an edge that has more past it fades and carries a small arrow, and the open tab is brought whole into view
 * with the start of the next tab showing beside it. Every tab and pill keeps its words, its order, its press
 * and its place in the keyboard order. Nothing is dropped.
 *
 * The page's title is the one thing that leaves the row, and only while the app's top bar is saying the same
 * word (`phoneBar.ts`). The role dock's bar names no page, so there the title stays where it was.
 */

/**
 * How much of the next tab stays in view beside the open one, in pixels. A page tab has 24 px of padding
 * before its words, so less than this shows no letter of it. This shows its first letters, cut by the edge.
 */
export const PHONE_TAB_PEEK_PX = 56
/** The same for a row of pills, whose padding is 13 px. */
export const PHONE_PILL_PEEK_PX = 44
/**
 * A fade and its arrow are drawn only once more than this hides past an edge: a page tab's padding. At 375 px
 * the Jobs row moves 10 px to show the tab after Pipeline, which hides no letter of the first tab. An arrow
 * there would point at nothing.
 */
export const PHONE_TAB_FADE_SLACK_PX = 24
/** The same for a row of pills, whose padding is 13 px. */
export const PHONE_PILL_FADE_SLACK_PX = 12
/** A pill of the one-line row is pressed anywhere in this height, as a press of the top bar is (`PHONE_BAR_PRESS_PX`). */
export const PHONE_PILL_PRESS_PX = 44

export type PhoneTabRows = {
  /** The rows of tabs are drawn as one scrolling line each. */
  oneLine: boolean
  /** The page draws its own title. False only while the top bar names the page. */
  titleDrawn: boolean
}

export function phoneTabRows(input: {
  /** `useNewPhoneLayout().on`: the switch is ticked and the screen is a phone's width. */
  phoneLayoutOn: boolean
  /** The top bar is naming the page in words (`usePhoneBarNamesPage`). */
  barNamesPage: boolean
}): PhoneTabRows {
  return {
    oneLine: input.phoneLayoutOn,
    titleDrawn: !(input.phoneLayoutOn && input.barNamesPage),
  }
}
