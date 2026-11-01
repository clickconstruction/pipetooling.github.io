/**
 * Messages → My email (punch list #230 PR 3): the tab on `/messages`, kept in the URL as the kind pills keep theirs
 * (`messages/kindPills.ts`). `?tab=my-email` opens **My email**, the person's own Inbox and Sent; **Follow up** is the
 * page with no param, as it always was. The tab's view lives in `?view=` (To tag, the default, takes the param away)
 * and its search in the page's own `?q=` (`messages/searchLines.ts`), read as Gmail's search while My email is open. A
 * press on the other tab starts it clean: the view and the words go, so Follow up's words never run as a Gmail search
 * and a Gmail search never lands on Follow up's lines.
 *
 * The doors the tab names: Gmail's own page for a conversation (`gmailThreadHref`, signed in as the person's own
 * address, for the reply the tab never makes), the card on Settings → Your account, and the guide. Pure.
 */
import { QUERY_PARAM } from '../messages/searchLines'
import type { MyMailView } from './contract'

/** The two tabs of `/messages`: Follow up, the page as it was, and My email, the person's own mail. */
export type MessagesTab = 'followUp' | 'myMail'

export const TAB_PARAM = 'tab'

/** What `?tab=` reads for My email. */
export const MY_MAIL_TAB = 'my-email'

/** The tabs after the bar's title, in their order, with their words. */
export const MESSAGES_TABS: ReadonlyArray<{ key: MessagesTab; label: string }> = [
  { key: 'followUp', label: 'Follow up' },
  { key: 'myMail', label: 'My email' },
]

/** The tab a URL asks for: My email for `?tab=my-email` alone, else Follow up. */
export function tabOf(search: URLSearchParams): MessagesTab {
  return search.get(TAB_PARAM)?.trim() === MY_MAIL_TAB ? 'myMail' : 'followUp'
}

export const VIEW_PARAM = 'view'

/** The three views, in the chips' order. */
export const MY_MAIL_VIEWS: readonly MyMailView[] = ['toTag', 'tagged', 'all']

const PARAM_OF_VIEW: Readonly<Record<MyMailView, string>> = { toTag: 'to-tag', tagged: 'tagged', all: 'all' }
const VIEW_OF_PARAM: ReadonlyMap<string, MyMailView> = new Map(MY_MAIL_VIEWS.map((v) => [PARAM_OF_VIEW[v], v]))

/** The view a URL asks for: To tag when it asks for none, or for one there is no view for. */
export function viewOf(search: URLSearchParams): MyMailView {
  return VIEW_OF_PARAM.get(search.get(VIEW_PARAM)?.trim() ?? '') ?? 'toTag'
}

/** The search with a view picked, every other param kept. To tag takes the param away. */
export function withView(search: URLSearchParams, view: MyMailView): URLSearchParams {
  const next = new URLSearchParams(search)
  if (view === 'toTag') next.delete(VIEW_PARAM)
  else next.set(VIEW_PARAM, PARAM_OF_VIEW[view])
  return next
}

/**
 * The search with a tab picked. Follow up takes the param away. A press on the other tab starts it clean, its view
 * and its words gone; a press on the open tab changes nothing. Every other param stays: the kind pill, an open thread.
 */
export function withTab(search: URLSearchParams, tab: MessagesTab): URLSearchParams {
  const next = new URLSearchParams(search)
  if (tab === tabOf(search)) return next
  next.delete(VIEW_PARAM)
  next.delete(QUERY_PARAM)
  if (tab === 'followUp') next.delete(TAB_PARAM)
  else next.set(TAB_PARAM, MY_MAIL_TAB)
  return next
}

/** What the door to Gmail reads: the reply, and anything else, is made in Gmail. */
export const REPLY_IN_GMAIL = 'Reply in Gmail'

/**
 * A conversation on Gmail's own page, in the person's own box: `authuser` picks the signed-in account that is theirs,
 * and with no address Gmail opens it in the account signed in first.
 */
export function gmailThreadHref(address: string, threadId: string): string {
  const who = address.trim()
  return `https://mail.google.com/mail/${who ? `?authuser=${encodeURIComponent(who)}` : ''}#all/${encodeURIComponent(threadId.trim())}`
}

/** The card on Settings → Your account that holds the switch and the labels left out (`MyMailCard`). */
export const MY_MAIL_SETTINGS_ANCHOR = 'settings-my-mail'
export const MY_MAIL_SETTINGS_HREF = `/settings?tab=settings-account#${MY_MAIL_SETTINGS_ANCHOR}`

/** The guide for the tab (`src/content/help/`), and its heading the tab's words line opens. */
export const MY_MAIL_GUIDE = 'tag-an-email-onto-a-job-from-your-own-mail'
export const MY_MAIL_GUIDE_READS = 'What the tab reads and keeps'
