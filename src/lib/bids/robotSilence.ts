/**
 * Silence on the Dashboard (Robot rounds PR 4, punch list #142, decision 4): two facts with two
 * owners. A Mac that has made no round for fifteen minutes is asleep, and the owner hears, with the
 * fix in the sentence. A robot blocked on a bid's plans is the estimator's, with the door. Pure.
 */
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { ROBOT_ASLEEP_MS } from './robotAgents'

/** A fleet whose newest call is older than this has no rounds to miss: nothing is said. */
export const ROBOT_ROUNDS_WINDOW_MS = 7 * 24 * 60 * 60_000

export type RobotSilence = {
  lastSeenAt: string | null
  /** True when a key called within the window and none has called for ROBOT_ASLEEP_MS. */
  asleep: boolean
}

export function robotSilence(lastSeenAt: string | null | undefined, nowMs: number): RobotSilence {
  if (!lastSeenAt) return { lastSeenAt: null, asleep: false }
  const t = Date.parse(lastSeenAt)
  if (!Number.isFinite(t)) return { lastSeenAt: null, asleep: false }
  const ago = nowMs - t
  return { lastSeenAt, asleep: ago > ROBOT_ASLEEP_MS && ago <= ROBOT_ROUNDS_WINDOW_MS }
}

/** "2:35 PM" today, "Fri 5:12 PM" another day, in the company's time zone. */
export function clockWords(iso: string, nowMs: number): string {
  const d = new Date(iso)
  const sameDay = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, dateStyle: 'short' }).format(d) === new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, dateStyle: 'short' }).format(new Date(nowMs))
  const time = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' }).format(d)
  if (sameDay) return time
  const day = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short' }).format(d)
  return `${day} ${time}`
}

export function robotAsleepWords(lastSeenAt: string, nowMs: number): { title: string; detail: string } {
  return {
    title: `The robots have not made a round since ${clockWords(lastSeenAt, nowMs)}`,
    detail: 'The Mac is asleep, or its rounds were never set up. Wake it. The rounds start again on their own. If they stay quiet, press Set up on this Mac on the Console with the rounds ticked.',
  }
}

export type RobotBlockedBid = { bidId: string; bidNumber: string | null; project: string | null }
export type RobotBlocked = { count: number; first: RobotBlockedBid | null }

export function robotBlockedWords(b: RobotBlocked): { title: string; detail: string } {
  const first = b.first
  const name = first ? `b${first.bidNumber ?? '?'}${first.project ? ` ${first.project}` : ''}` : 'a bid'
  return {
    title: b.count === 1 ? `The robot is blocked on ${name}` : `The robot is blocked on ${b.count} bids`,
    detail: `It cannot open the plans. Share the folder with the robots' account, or attach the PDF. It reruns on the next round.${b.count > 1 && first ? ` First: ${name}.` : ''}`,
  }
}
