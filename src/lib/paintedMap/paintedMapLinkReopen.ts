/**
 * Reopening an ended painted map link (punch list #443, row 14): the take-back of **End this link now** on a map's
 * Share sheet.
 *
 * Ending a link sets `ended_at` on every open link of the map and keeps the rows, so the address already sent is dead
 * and the same code cannot be asked for again. The table lets a client only read, and the function that ends a link
 * had no action that clears `ended_at`, so a link a walk ended on a ZZ test map stayed ended for good. `desk.reopen`
 * on `painted-map-link` is the one door, for a developer, on a test map's ended link that is not past its day. This
 * is the rule for the press that calls it, said in words before the call; the function holds the same rule and refuses
 * in the same words. Pure: the call is `paintedMapLinkIo.ts` (`reopenPaintedMapLink`), the press sits on the Share
 * sheet (`components/paintedMap/PaintedMapShareSheet.tsx`).
 *
 * - The press is drawn for a dev and for nobody else. View as a sample account is that account, so it draws nothing.
 * - Only a test map's link goes back: the map's name starts with ZZ (`isZzTestName`), the one mark a map carries.
 * - Only an ended link that is not past its day (`paintedMapLinkReopenable`): a day ahead needs a new link.
 */
import { isZzTestName } from '../../../supabase/functions/_shared/zzTestJob'
import { PAINTED_MAP_LINK_WORDS, linkDayWords, linkMadeDayWords, paintedMapLinkReopenable, type PaintedMapLinkRow } from './paintedMapLink'

/** Who is offered the reopen: a dev. Every other role sees nothing new. */
export function paintedMapLinkReopenDrawn(role: string | null | undefined): boolean {
  return role === 'dev'
}

/** The ended links a dev may read under the sheet: ended, not past their day, newest ended first. */
export function paintedMapLinksToReopen(links: ReadonlyArray<PaintedMapLinkRow>, nowIso: string): PaintedMapLinkRow[] {
  return links.filter((l) => paintedMapLinkReopenable(l, nowIso)).sort((a, b) => (b.ended_at ?? '').localeCompare(a.ended_at ?? ''))
}

/** Why this link cannot be reopened from here; '' when it can, subject to the function's own checks. */
export function paintedMapLinkReopenProblem(link: Pick<PaintedMapLinkRow, 'expires_at' | 'ended_at'>, mapName: string | null | undefined, nowIso: string): string {
  if (!link.ended_at) return PAINTED_MAP_LINK_WORDS.reopenNotEnded
  if (!paintedMapLinkReopenable(link, nowIso)) return PAINTED_MAP_LINK_WORDS.reopenPastDay
  if (!isZzTestName(mapName)) return PAINTED_MAP_LINK_WORDS.reopenNotTest
  return ''
}

/** The confirm window's words. The button names the act. */
export function paintedMapLinkReopenConfirm(link: Pick<PaintedMapLinkRow, 'expires_at'>, mapName: string): { title: string; message: string; confirmLabel: string } {
  return {
    title: `Reopen this ended link of ${mapName}?`,
    message: `The same address opens the map again, until ${linkMadeDayWords(link.expires_at) ?? 'its day'}. Anyone who holds the old link can open it.`,
    confirmLabel: 'Reopen the link',
  }
}

/** One ended link's line under the sheet: the day it was ended and the day it would end on, on the company's calendar. */
export function paintedMapLinkEndedWords(link: Pick<PaintedMapLinkRow, 'ended_at' | 'expires_at'>): string {
  const ended = linkMadeDayWords(link.ended_at)
  const ends = linkMadeDayWords(link.expires_at)
  return `${ended ? `Ended ${ended}.` : 'Ended.'}${ends ? ` Would end on ${ends}.` : ''}`
}

/** The press's word on an ended link's line. */
export const PAINTED_MAP_LINK_REOPEN_PRESS = 'Reopen…'
/** The fold's caption over the ended links. */
export const PAINTED_MAP_LINKS_ENDED_HEAD = 'Ended links'
/** What the sheet says once a link is open again. */
export function paintedMapLinkReopenedWords(endsOn: string | null): string {
  return endsOn ? `The link is open again until ${linkDayWords(endsOn)}. Anyone who holds it can open the map.` : 'The link is open again. Anyone who holds it can open the map.'
}
