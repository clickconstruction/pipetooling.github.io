/**
 * Messages' one-row header (punch list #151 PR 2, v2.5801): the words and the per-browser memory of the bar at the top
 * of `/messages` — the title, the kind picker (`kindPills.ts`'s pills behind one button), Show (`showLens.ts`), the
 * search glass that opens the box (`searchLines.ts`), the jump strip (`jumpStrip.ts`) and **7 days**, which opens The
 * last 7 days under the bar and stays as you left it on this browser, as Show does. Since punch list #230 PR 3 two
 * tabs follow the title, **Follow up · My email** (`myMail/tab.ts`), the second drawn while the person's own switch is
 * on; on My email the bar keeps the title, the tabs and the ?, the rest being Follow up's. Pure.
 */
import { KIND_PILLS, type KindPill } from './kindPills'

export const TOP_BAR_WORDS = {
  title: 'Messages',
  /** The picker's words while All is on; any other pill reads its own label. */
  allKinds: 'All kinds',
  pickerTip: 'Which people to show',
  search: 'Open the search',
  searchClose: 'Close the search',
  week: '7 days',
  weekTip: 'Opens The last 7 days under the bar. It stays open on this browser until you close it.',
  weekCloseTip: 'Closes The last 7 days.',
  /** The two tabs after the title (punch list #230 PR 3). */
  tabs: 'Follow up or your own mail',
  followUpTip: 'Everyone waiting on us, and what went out.',
  myMailTip: 'Your own Inbox and Sent, to tag a conversation onto a job.',
} as const

/** What the picker's button reads: All kinds, or the pill's own label. */
export function pickerLabel(pill: KindPill): string {
  if (pill === 'all') return TOP_BAR_WORDS.allKinds
  return KIND_PILLS.find((p) => p.key === pill)?.label ?? TOP_BAR_WORDS.allKinds
}

export const WEEK_STORAGE_KEY = 'messages_week_open'

/** Whether The last 7 days is open on this browser; closed when nothing is kept, or when the browser keeps nothing. */
export function readWeekOpen(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): boolean {
  try {
    return storage?.getItem(WEEK_STORAGE_KEY) === 'open'
  } catch {
    return false
  }
}

export function keepWeekOpen(open: boolean, storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    storage?.setItem(WEEK_STORAGE_KEY, open ? 'open' : 'closed')
  } catch {
    // A browser that keeps nothing starts closed next time.
  }
}
