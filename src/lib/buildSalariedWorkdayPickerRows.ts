import type { PayConfigRow } from '../types/peoplePayConfig'

export type SalariedWorkdayPickerRow = { personName: string; userId: string | null }

/**
 * Salaried people from pay config with optional login user id when `users[].name` matches `personName` (trimmed).
 */
export function buildSalariedWorkdayPickerRows(
  payConfig: Record<string, PayConfigRow>,
  users: Array<{ id: string; name?: string | null }>,
): SalariedWorkdayPickerRow[] {
  const out: SalariedWorkdayPickerRow[] = []
  for (const [personName, cfg] of Object.entries(payConfig)) {
    if (!cfg?.is_salary) continue
    const userId = users.find((u) => u.name?.trim() === personName.trim())?.id ?? null
    out.push({ personName, userId })
  }
  out.sort((a, b) => a.personName.localeCompare(b.personName, undefined, { sensitivity: 'base' }))
  return out
}
