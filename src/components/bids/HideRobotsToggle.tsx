/**
 * "Hide robots" on the bid picker, just below "Only my bids" on the nine workflow tabs: the
 * list without the ZZ bids (`lib/bids/bidPickerRobots`).
 *
 * It is offered only while "Only my bids" is off, and it is ticked the first time it shows.
 * With "Only my bids" on the switch is not on the page and hides nothing, so no filter works
 * out of sight. The search row says which it is (`setHideRobotsOffered`); the list reads
 * `useHideRobotBids`, true only when the switch is both offered and ticked.
 *
 * The tick is one choice for every tab, kept per browser in a module store synced to
 * localStorage, the same shape as the sort view: unticked once, it stays unticked.
 */
import { useSyncExternalStore } from 'react'
import { normalizeHideRobots } from '../../lib/bids/bidPickerRobots'
import { BidPickerCheckToggle } from './MyBidsToggle'

const STORAGE_KEY = 'bidPickerHideRobots'

function readStored(): boolean {
  try {
    return normalizeHideRobots(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return true
  }
}

let ticked: boolean = typeof window === 'undefined' ? true : readStored()
let offered = false
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setHideRobotBids(hide: boolean) {
  ticked = hide
  try {
    window.localStorage.setItem(STORAGE_KEY, hide ? '1' : '0')
  } catch {
    // Private-mode storage failures just lose persistence, not the session's choice.
  }
  for (const l of listeners) l()
}

/** The search row's word on whether the switch is on the page: it is while "Only my bids" is off. */
export function setHideRobotsOffered(next: boolean) {
  if (offered === next) return
  offered = next
  for (const l of listeners) l()
}

/** What the list does: hide the ZZ bids only while the switch is on the page and ticked. */
export function useHideRobotBids(): boolean {
  return useSyncExternalStore(subscribe, () => offered && ticked, () => false)
}

/** Forget the browser's choice: back to ticked, not offered. */
export function resetHideRobotsForTests() {
  ticked = true
  offered = false
  for (const l of listeners) l()
}

export const HIDE_ROBOTS_TITLE = 'Hide the robots’ bids and the test bids: every bid whose name starts with ZZ. A bid marked by you or for you stays.'

export function HideRobotsToggle() {
  const hide = useSyncExternalStore(subscribe, () => ticked, () => true)
  return <BidPickerCheckToggle compact active={hide} onChange={setHideRobotBids} label="Hide robots" title={HIDE_ROBOTS_TITLE} />
}
