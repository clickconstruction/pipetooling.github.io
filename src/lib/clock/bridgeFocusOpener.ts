/**
 * Which modal the UpdateFocusOpenerBridge should open when a caller asks for
 * "update focus" (v2.3190). Job Mode's card sends every "pick a job" tap down
 * this one door — Clock In when nothing is running, Choose Next Job when
 * something is — so the answer depends on the session, not the caller.
 *
 * Before this the opener only knew Update Focus and returned early without a
 * session, which is exactly the state that shows the card's **Clock In** button:
 * the tap did nothing.
 */
export type BridgeFocusTarget = 'clock-in' | 'update-focus' | 'none'

export function resolveBridgeFocusTarget(input: { hasOpenSession: boolean; userId: string | null | undefined; userName: string | null | undefined }): BridgeFocusTarget {
  if (!input.userId || !input.userName?.trim()) return 'none'
  return input.hasOpenSession ? 'update-focus' : 'clock-in'
}
