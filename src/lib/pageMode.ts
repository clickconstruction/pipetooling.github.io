/**
 * One page mode at a time (the owner's walk, 2026-11-20).
 *
 * Task Mode, Job Mode and Dispatch Mode each change what the whole app shows, so a person is in one
 * of them or in none (`full`, the app as it is with no mode on). Until this kernel the three were
 * stacked: each kept its own stored value, the menu ticked every stored value, and the page drew
 * whichever won. So the gear menu could show Job Mode and Task Mode ticked together while the page
 * was Task Mode, and a master technician could hold the Dispatch Mode bar under a Job Mode Dashboard.
 *
 * The rule now, in one place:
 *
 * - **One mode is drawn**, by this order: Task Mode, then Job Mode, then Dispatch Mode. Task Mode is
 *   a lens put over the day. Job Mode is this device's own pick, and nobody who can hold Dispatch
 *   Mode has Job Mode on unless they switched it on here, or are a master technician on a phone
 *   with the new phone layout on, whose phone starts in Job Mode (`jobModeToggle.ts`). Dispatch Mode
 *   follows the person to every device and is on for some roles before they ever choose, so it
 *   gives way to the other two.
 * - **The tick is the page.** A row is ticked only when its mode is the one drawn (`pageModeTicks`),
 *   so two rows are never ticked together.
 * - **A press switches to that mode.** It switches off whatever would be drawn over it and leaves
 *   what sits under it alone (`pageModeWrites`).
 * - **Switching a mode off goes back to the mode the person had.** The stored value underneath was
 *   never cleared, so a field hand who drops into Task Mode for a task comes back to Job Mode, and a
 *   role whose Job Mode is on with nothing stored is not left on the full Dashboard.
 *
 * Nothing stored is rewritten on load: a device holding two or three values from before this rule
 * reads by the same order, with no migration.
 *
 * The pin bar's switch, Tell the dev's switch and Dark Mode are not page modes and stay independent.
 */

import type { UserRole } from '../hooks/useAuth'
import { canLeaveJobFieldReport } from './canLeaveJobFieldReport'
import { isAssistantLike } from './subcontractorLikeRole'

/** The mode the page is drawn in. `full` is no mode: the whole app. */
export type PageMode = 'task' | 'job' | 'dispatch' | 'full'

/** A mode a person can switch on. */
export type PageModeKey = Exclude<PageMode, 'full'>

/** Highest first: the first of these that is on is the one drawn. */
export const PAGE_MODE_ORDER: readonly PageModeKey[] = ['task', 'job', 'dispatch']

/**
 * What each mode's own toggle answers for this person on this device, before the three are held
 * to one: Task Mode's stored value, Job Mode's stored value or its role default, Dispatch Mode's
 * stored value or its role default. Each is already false for a role that cannot hold the mode.
 */
export type PageModeWants = Record<PageModeKey, boolean>

/** One stored value to change. */
export interface PageModeWrite {
  key: PageModeKey
  on: boolean
}

type Role = UserRole | string | null | undefined

/** Staff only: every /dispatch-mode tab is outside the other roles' allowlists. */
export function dispatchModeEligibleForRole(role: Role): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

/** Assistants, controllers and master technicians have Dispatch Mode on until they choose. */
export function dispatchModeDefaultForRole(role: Role): boolean {
  return isAssistantLike(role) || role === 'master_technician'
}

/** Can this role switch the mode on at all? Task Mode is open to every role. */
export function pageModeEligibleForRole(role: Role, key: PageModeKey): boolean {
  if (key === 'job') return canLeaveJobFieldReport(role)
  if (key === 'dispatch') return dispatchModeEligibleForRole(role)
  return true
}

/** The one mode the page is drawn in. */
export function resolvePageMode(wants: PageModeWants): PageMode {
  for (const key of PAGE_MODE_ORDER) if (wants[key]) return key
  return 'full'
}

/** What each menu row's tick reads: on only for the mode drawn, so never two together. */
export function pageModeTicks(wants: PageModeWants): Record<PageModeKey, boolean> {
  const mode = resolvePageMode(wants)
  return { task: mode === 'task', job: mode === 'job', dispatch: mode === 'dispatch' }
}

/**
 * What a press stores.
 *
 * Switching a mode ON makes it the mode drawn: its own value goes on unless it already is, and every
 * mode above it in the order goes off. The modes under it keep their values.
 *
 * Switching a mode OFF clears that one value and nothing else, so the page falls to whatever is on
 * under it.
 *
 * A value that would not change is not written, and a role that cannot hold the mode writes nothing.
 */
export function pageModeWrites(role: Role, wants: PageModeWants, key: PageModeKey, on: boolean): PageModeWrite[] {
  if (!on) return wants[key] ? [{ key, on: false }] : []
  if (!pageModeEligibleForRole(role, key)) return []
  const writes: PageModeWrite[] = []
  if (!wants[key]) writes.push({ key, on: true })
  for (const above of PAGE_MODE_ORDER) {
    if (above === key) break
    if (wants[above]) writes.push({ key: above, on: false })
  }
  return writes
}

/** What the three toggles answer once the writes have landed. */
export function applyPageModeWrites(wants: PageModeWants, writes: readonly PageModeWrite[]): PageModeWants {
  const next = { ...wants }
  for (const w of writes) next[w.key] = w.on
  return next
}
