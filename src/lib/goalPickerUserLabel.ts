/** Goal/team-hours picker user row + display-label helper, shared between Settings.tsx,
 * the extracted Settings tab components, and the People → Users Team leads modal. */
export type GoalPickerUserRow = { id: string; name: string | null; email: string | null }

/** Display label for the Team Hours Sharing table (name → email → raw id fallback). */
export function displayLabelForGoalPickerUser(userId: string, users: GoalPickerUserRow[]): string {
  const u = users.find((x) => x.id === userId)
  return u?.name?.trim() || u?.email || userId
}
