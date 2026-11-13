/**
 * The Bridge's links (link PR 2): the five stages and the three resources a step can be throttled by, their names,
 * and the keys of the moves a step asks for.
 *
 * Until punch list #334 this file also read the week's calls from `bridge_calls`: which call stood for a week, the
 * streak, the scorecard, the verdict and Friday's ask, with the three client calls that loaded, recorded and
 * answered one. No call was ever kept. The owner took the call off the page (PR 7) and off the Monday email
 * (PR 11), and all of that went with it. The table `bridge_calls` is still in the database, and nothing reads it.
 * Pure.
 */
import { STAGE_META, STAGE_ORDER, type StageId } from './stageFlow'

export type CallLink = StageId | 'decision' | 'capital' | 'talent'

export const CALL_LINK_NAMES: Record<CallLink, string> = {
  market: 'Market',
  sales: 'Sales',
  build: 'Build',
  bill: 'Bill',
  collect: 'Collect',
  decision: 'Decision',
  capital: 'Capital',
  talent: 'Talent',
}

export function isStageLink(link: CallLink): link is StageId {
  return (STAGE_ORDER as ReadonlyArray<string>).includes(link)
}

/** The numbers behind a move, by kind: dollars for bill and chase, hours for approve, counts for price and pct. */
export type MoveKey = 'bill' | 'chase' | 'approve' | 'price' | 'pct' | 'other'

export const shortUsd = (n: number): string => `$${Math.abs(n) >= 100_000 ? `${Math.round(Math.abs(n) / 1000)}k` : Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(Math.abs(n))}`}`

/** What the step's desk says of the pressed link: the page's own reading, a resource, or not the link today. */
export function deskStatus(input: { link: CallLink; linkId: StageId | null }): string {
  if (input.linkId === input.link) return 'nominated by the page: the most weeks to clear what is already waiting'
  if (!isStageLink(input.link)) return 'a resource; it throttles a link or shows its symptom'
  return 'not the link today, by the page’s reading'
}

export const stageKindOf = (link: CallLink): string => (isStageLink(link) ? STAGE_META[link].kind : link === 'decision' ? 'bottlenecks at the leadership level' : link === 'capital' ? 'not enough money' : 'not enough people')
