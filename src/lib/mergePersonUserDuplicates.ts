import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { cascadePersonNameInPayTables } from './cascadePersonName'

export type PersonForMerge = { id: string; name: string; email: string | null }
export type UserRowForMerge = { id: string; name: string; email: string | null }
export type PayConfigRowForMerge = {
  person_name: string
  hourly_wage: number | null
  is_salary: boolean
  show_in_hours: boolean
  show_in_cost_matrix: boolean
  record_hours_but_salary: boolean
}

export type PersonUserDuplicate = {
  personName: string
  userDisplayName: string
  email: string
}

/**
 * Find person/user duplicates: person_name in pay_config where a roster person
 * and a user share the same email but have different names. Checks both directions:
 * person_name matches person (roster) or person_name matches user.
 */
export function findPersonUserDuplicates(
  people: PersonForMerge[],
  users: UserRowForMerge[],
  payConfig: Record<string, PayConfigRowForMerge>
): PersonUserDuplicate[] {
  const userByEmail = new Map<string, UserRowForMerge>()
  const personByEmail = new Map<string, PersonForMerge>()
  for (const u of users) {
    if (u.email?.trim()) {
      userByEmail.set(u.email.trim().toLowerCase(), u)
    }
  }
  for (const p of people) {
    if (p.email?.trim()) {
      personByEmail.set(p.email.trim().toLowerCase(), p)
    }
  }
  const seen = new Set<string>()
  const duplicates: PersonUserDuplicate[] = []
  for (const personName of Object.keys(payConfig)) {
    const trimmed = personName.trim()
    const person = people.find((p) => p.name?.trim() === trimmed)
    const user = users.find((u) => u.name?.trim() === trimmed)
    let personRoster: PersonForMerge | undefined
    let userMatch: UserRowForMerge | undefined
    if (person?.email?.trim()) {
      userMatch = userByEmail.get(person.email.trim().toLowerCase())
      if (userMatch) {
        const userDisplayName = userMatch.name?.trim() ?? ''
        if (userDisplayName && trimmed !== userDisplayName) {
          personRoster = person
        }
      }
    }
    if (!personRoster && user?.email?.trim()) {
      personRoster = personByEmail.get(user.email.trim().toLowerCase())
      userMatch = user
      if (personRoster && personRoster.name?.trim() === trimmed) {
        personRoster = undefined
      }
    }
    if (!personRoster || !userMatch) continue
    const pName = personRoster.name?.trim() ?? ''
    const uName = userMatch.name?.trim() ?? ''
    if (!pName || !uName || pName === uName) continue
    const key = `${pName}|${uName}`
    if (seen.has(key)) continue
    seen.add(key)
    duplicates.push({
      personName: pName,
      userDisplayName: uName,
      email: personRoster.email?.trim() ?? '',
    })
  }
  return duplicates
}

const ROLE_SUFFIX = /\s*\((Assistant|Master|Primary|Subcontractor|Estimator)\)\s*$/i

function baseName(name: string): string {
  return name.replace(ROLE_SUFFIX, '').trim()
}

/**
 * Find name-similar duplicates in pay_config: pairs like "Paige" and "Paige (Assistant)"
 * where one name equals the other with a role suffix stripped. No email required.
 */
export function findNameSimilarDuplicates(
  payConfig: Record<string, PayConfigRowForMerge>
): PersonUserDuplicate[] {
  const names = Object.keys(payConfig).map((n) => n.trim()).filter(Boolean)
  const seen = new Set<string>()
  const duplicates: PersonUserDuplicate[] = []
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i]!
      const b = names[j]!
      if (a === b) continue
      if (baseName(a) !== baseName(b)) continue
      const personName = a.length <= b.length ? a : b
      const userDisplayName = a.length <= b.length ? b : a
      if (personName === userDisplayName) continue
      const key = `${personName}|${userDisplayName}`
      if (seen.has(key)) continue
      seen.add(key)
      duplicates.push({
        personName,
        userDisplayName,
        email: '',
      })
    }
  }
  return duplicates
}

/**
 * Merge person's pay config into user's, delete person's row, and cascade name change.
 * When userId is provided, also updates users.name to userDisplayName to keep Settings in sync.
 */
export async function mergePersonIntoUser(
  personName: string,
  userDisplayName: string,
  payConfig: Record<string, PayConfigRowForMerge>,
  userId?: string
): Promise<void> {
  const trimmedPerson = personName.trim()
  const trimmedUser = userDisplayName.trim()
  if (!trimmedPerson || !trimmedUser || trimmedPerson === trimmedUser) return

  const personConfig = payConfig[trimmedPerson]
  const userConfig = payConfig[trimmedUser]

  const merged: PayConfigRowForMerge = {
    person_name: trimmedUser,
    hourly_wage: userConfig?.hourly_wage ?? personConfig?.hourly_wage ?? null,
    is_salary: userConfig?.is_salary ?? personConfig?.is_salary ?? false,
    show_in_hours: userConfig?.show_in_hours ?? personConfig?.show_in_hours ?? false,
    show_in_cost_matrix: userConfig?.show_in_cost_matrix ?? personConfig?.show_in_cost_matrix ?? false,
    record_hours_but_salary: userConfig?.record_hours_but_salary ?? personConfig?.record_hours_but_salary ?? false,
  }

  await withSupabaseRetry(
    async () => {
      const result = await supabase.from('people_pay_config').upsert(merged, { onConflict: 'person_name' })
      return result
    },
    'upsert merged pay config'
  )

  await withSupabaseRetry(
    async () => {
      const result = await supabase.from('people_pay_config').delete().eq('person_name', trimmedPerson)
      return result
    },
    'delete person pay config'
  )

  await cascadePersonNameInPayTables(trimmedPerson, trimmedUser)

  if (userId) {
    await withSupabaseRetry(
      async () => supabase.from('users').update({ name: trimmedUser }).eq('id', userId),
      'update user name after merge'
    )
  }
}
