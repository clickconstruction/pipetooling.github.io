/**
 * "Hide robots" on the bid picker (the nine workflow tabs): the list without the ZZ bids.
 * It is offered only while "Only my bids" is off, and it starts on: the first look at
 * everyone's bids is the people's bids. With "Only my bids" on, nothing is hidden by it.
 *
 * The ZZ convention marks a bid that is not a real pursuit: the estimator twins' "ZZ Twin …"
 * and "ZZ Shadow …" bids, and the office's own "ZZ Test …" bids. The picker reads the name
 * alone, so the rule needs no list of twin users (the Bid Board's scope, `bidBoardScope`,
 * reads the estimator and the creator instead).
 *
 * A bid marked by you or for you is never hidden: a mark is how someone hands you a robot's
 * bid to look at, and "Only my bids" keeps it for the same reason.
 */

/** A project name that starts with the word "ZZ", whatever its case: "ZZ Shadow …", "zz test". Not "ZZZ Corp". */
export const isZzBidName = (projectName: string | null | undefined): boolean => /^\s*ZZ\b/i.test(projectName ?? '')

export function splitRobotBids<T extends { id: string; project_name?: string | null }>(
  bids: ReadonlyArray<T>,
  hide: boolean,
  keep: (bidId: string) => boolean,
): { shown: T[]; hidden: number } {
  if (!hide) return { shown: bids as T[], hidden: 0 }
  const shown = bids.filter((b) => !isZzBidName(b.project_name) || keep(b.id))
  return { shown, hidden: bids.length - shown.length }
}

/** The quiet line under the list: "3 ZZ bids hidden." / "1 ZZ bid hidden." / "" */
export function hiddenRobotsWords(hidden: number): string {
  if (hidden <= 0) return ''
  return hidden === 1 ? '1 ZZ bid hidden.' : `${hidden} ZZ bids hidden.`
}

/** The stored choice: on unless the person turned it off, so a first look at everyone's bids starts without the ZZ ones. */
export const normalizeHideRobots = (raw: string | null | undefined): boolean => raw !== '0'
