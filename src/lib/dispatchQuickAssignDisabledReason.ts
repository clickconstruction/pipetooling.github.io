/**
 * Why the Quick Assign "Schedule" button is disabled, in words (v2.1486).
 * A disabled button swallows taps silently; the sheet keeps the button
 * tappable and toasts this reason instead, so nobody stares at a gray
 * "Pick people and a time" wondering what's missing.
 */
export function quickAssignDisabledReason(state: {
  hasJob: boolean
  peopleCount: number
  hasWindow: boolean
  saving: boolean
}): string | null {
  if (state.saving) return 'Hang on — still scheduling.'
  if (!state.hasJob) return 'Pick a job first — tap Change job.'
  const missingPeople = state.peopleCount === 0
  const missingWindow = !state.hasWindow
  if (missingPeople && missingWindow) return 'Pick at least one person, then choose a time window.'
  if (missingPeople) return 'Pick at least one person for this crew.'
  if (missingWindow) return 'Choose a time window — tap a suggested window or set a Custom time.'
  return null
}
