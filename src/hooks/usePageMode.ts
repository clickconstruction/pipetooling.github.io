import { useCallback, useMemo } from 'react'
import type { UserRole } from './useAuth'
import { useDispatchModeEnabled } from './useDispatchModeEnabled'
import { useJobModeEnabled } from './useJobModeEnabled'
import { useTaskModeEnabled } from './useTaskModeEnabled'
import type { JobModeSource } from '../lib/jobModeToggle'
import {
  dispatchModeDefaultForRole,
  dispatchModeEligibleForRole,
  pageModeTicks,
  pageModeWrites,
  resolvePageMode,
  type PageMode,
  type PageModeKey,
  type PageModeWants,
} from '../lib/pageMode'

export interface PageModeState {
  /** The one mode the page is drawn in. */
  mode: PageMode
  /** What each menu row's tick reads: on only for the mode drawn. */
  ticks: Record<PageModeKey, boolean>
  /** Switch a mode on or off. `source` is the door that turned Job Mode on (the gear menu unless said). */
  set: (key: PageModeKey, on: boolean, source?: Exclude<JobModeSource, 'default'>) => void
}

/**
 * The page mode this person is in on this device, and the one door that changes it.
 *
 * It holds the three toggles (Task Mode, Job Mode, Dispatch Mode) to `pageMode.ts`'s rule: one mode
 * drawn, the tick is the page, a press switches to that mode and switching it off goes back to the
 * mode underneath. Each toggle keeps its own storage, its own event and, for Dispatch Mode, its row
 * on the server, so every screen that listens for one of them still follows.
 *
 * Every door that switches a mode goes through `set`: the gear menu, the phone bar's Modes rows,
 * the Task Mode strip's Exit and the mode row above the header (`ModeRow`).
 */
export function usePageMode(userId: string | null | undefined, role: UserRole | string | null | undefined): PageModeState {
  const [taskOn, setTask] = useTaskModeEnabled(userId)
  const [jobOn, setJob] = useJobModeEnabled(userId, role)
  const [dispatchOn, setDispatch] = useDispatchModeEnabled(userId, dispatchModeDefaultForRole(role))
  const signedIn = !!userId
  const dispatchEligible = dispatchModeEligibleForRole(role)

  const wants = useMemo<PageModeWants>(
    () => ({ task: signedIn && taskOn, job: signedIn && jobOn, dispatch: signedIn && dispatchOn && dispatchEligible }),
    [signedIn, taskOn, jobOn, dispatchOn, dispatchEligible],
  )
  const mode = resolvePageMode(wants)
  const ticks = useMemo(() => pageModeTicks(wants), [wants])

  const set = useCallback(
    (key: PageModeKey, on: boolean, source: Exclude<JobModeSource, 'default'> = 'gear') => {
      for (const write of pageModeWrites(role, wants, key, on)) {
        if (write.key === 'task') setTask(write.on)
        else if (write.key === 'job') setJob(write.on, source)
        else setDispatch(write.on)
      }
    },
    [role, wants, setTask, setJob, setDispatch],
  )

  return { mode, ticks, set }
}
