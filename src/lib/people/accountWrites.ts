/**
 * Account on the desk (PR B): the headless writes the Person desk's Access & account section
 * makes, one function each, so every per-person account control lives on the desk instead of
 * the Active Accounts window. Each write is the one that window already made: the same column,
 * the same edge function, the same guard (`users_guard_privileged_columns`, the functions' own
 * dev checks). Nothing here grants a permission; the gates stay in `personDeskGates.ts`.
 *
 * A write that RLS filters to zero rows throws `NOT_APPLIED`, so the desk never shows a change
 * that did not land.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { cascadePersonNameInPayTables, getPersonNamesForUser } from '../cascadePersonName'

type Client = SupabaseClient<Database>

export const NOT_APPLIED = 'That change did not apply. You may not have permission to change this account.'

export type TradesColumn =
  | 'estimator_service_type_ids'
  | 'primary_service_type_ids'
  | 'superintendent_service_type_ids'
  | 'subcontractor_service_type_ids'
  | 'helpers_service_type_ids'

/** The users column that holds a role's trades; null when the role has none. */
export function tradesColumnForRole(role: string | null | undefined): TradesColumn | null {
  switch (role) {
    case 'estimator':
      return 'estimator_service_type_ids'
    case 'primary':
      return 'primary_service_type_ids'
    case 'superintendent':
      return 'superintendent_service_type_ids'
    case 'subcontractor':
      return 'subcontractor_service_type_ids'
    case 'helpers':
      return 'helpers_service_type_ids'
    default:
      return null
  }
}

/** What the trades limit, in the words the Active Accounts window used. */
export function tradesMeaningForRole(role: string | null | undefined): string | null {
  switch (role) {
    case 'estimator':
      return 'Which materials they see. Leave every box empty to see all of them.'
    case 'subcontractor':
    case 'helpers':
      return 'Which jobs and bids they can clock in to. Leave every box empty for all of them.'
    case 'primary':
    case 'superintendent':
      return 'Which trades they work in. Leave every box empty for all of them.'
    default:
      return null
  }
}

export type ExtraAccessField = 'team_prospects_access' | 'estimator_prospects_access'

/** The extra doors a role can be given, in the order the desk lists them. */
export function extraAccessForRole(role: string | null | undefined): Array<{ field: ExtraAccessField; label: string; title: string }> {
  const out: Array<{ field: ExtraAccessField; label: string; title: string }> = []
  if (role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'estimator') {
    out.push({ field: 'team_prospects_access', label: 'Hiring board', title: 'Prospects → Hiring, the board of people we might hire.' })
  }
  if (role === 'estimator') {
    out.push({ field: 'estimator_prospects_access', label: 'Prospects', title: 'Prospects → Customers, the leads list.' })
  }
  return out
}

/** Trades are stored as a list of ids, or null for "all of them". */
export function tradesValue(ids: readonly string[]): string[] | null {
  const unique = [...new Set(ids)]
  return unique.length > 0 ? unique : null
}

async function updateUser(client: Client, userId: string, patch: Database['public']['Tables']['users']['Update']): Promise<void> {
  const { data, error } = await client.from('users').update(patch).eq('id', userId).select('id')
  if (error) throw new Error(error.message)
  if (!data?.[0]) throw new Error(NOT_APPLIED)
}

/**
 * Is this name taken by someone else? Another account, or a roster row that is not this
 * account's own. Matched without regard to case, read by name only (never a whole-table read).
 */
export async function nameTakenByAnother(client: Client, args: { userId: string; name: string }): Promise<boolean> {
  const wanted = args.name.trim().toLowerCase()
  if (!wanted) return false
  const pattern = args.name.trim().replace(/[\\%_]/g, (c) => `\\${c}`)
  const [users, people] = await Promise.all([
    client.from('users').select('id, name').ilike('name', pattern).limit(10),
    client.from('people').select('id, name, account_user_id').is('archived_at', null).ilike('name', pattern).limit(10),
  ])
  if (users.error) throw new Error(users.error.message)
  if (people.error) throw new Error(people.error.message)
  const sameName = (n: string | null | undefined) => (n ?? '').trim().toLowerCase() === wanted
  const otherUser = (users.data ?? []).some((u) => u.id !== args.userId && sameName(u.name))
  const otherPerson = (people.data ?? []).some((p) => p.account_user_id !== args.userId && sameName(p.name))
  return otherUser || otherPerson
}

/**
 * Rename an account. Refuses an empty name or one someone else has, writes `users.name`, then
 * moves the name-keyed pay and hours rows (every name this account has gone by) to the new one,
 * as the Active Accounts window's Save did.
 */
export async function renameAccount(
  client: Client,
  args: { userId: string; email: string | null; oldName: string | null; newName: string },
  deps: {
    getNames: (userId: string, email: string | null) => Promise<string[]>
    cascade: (oldName: string, newName: string) => Promise<void>
  } = { getNames: getPersonNamesForUser, cascade: cascadePersonNameInPayTables },
): Promise<void> {
  const next = args.newName.trim()
  if (!next) throw new Error('Type a name first.')
  if ((args.oldName ?? '').trim() === next) return
  if (await nameTakenByAnother(client, { userId: args.userId, name: next })) {
    throw new Error(`Someone else is already called "${next}". Names must be unique.`)
  }
  await updateUser(client, args.userId, { name: next })
  const names = new Set<string>()
  if (args.oldName?.trim()) names.add(args.oldName.trim())
  for (const n of await deps.getNames(args.userId, args.email)) if (n.trim()) names.add(n.trim())
  for (const n of names) if (n !== next) await deps.cascade(n, next)
}

export async function setAccountTrades(client: Client, args: { userId: string; role: string | null; ids: readonly string[] }): Promise<void> {
  const column = tradesColumnForRole(args.role)
  if (!column) throw new Error('This role has no trades to pick.')
  await updateUser(client, args.userId, { [column]: tradesValue(args.ids) })
}

export async function setAccountExtraAccess(client: Client, args: { userId: string; field: ExtraAccessField; on: boolean }): Promise<void> {
  await updateUser(client, args.userId, { [args.field]: args.on })
}

/** The supervision switch, phrased the way the desk asks it: can they run a job on their own? */
export async function setCanRunAJob(client: Client, args: { userId: string; canRun: boolean }): Promise<void> {
  await updateUser(client, args.userId, { needs_supervision: !args.canRun })
}

/** Why a typed password cannot be set, or null when it can. */
export function passwordProblem(password: string, again: string): string | null {
  if (password.length < 6) return 'Use at least 6 characters.'
  if (password !== again) return 'The two passwords do not match.'
  return null
}

async function functionError(e: unknown): Promise<string> {
  if (e instanceof FunctionsHttpError && e.context) {
    try {
      const b = (await e.context.json()) as { error?: string } | null
      if (b?.error) return b.error
    } catch {
      /* fall through */
    }
  }
  return e instanceof Error ? e.message : 'That did not save'
}

/** `set-user-password` (dev only, in the function). */
export async function setAccountPassword(client: Client, args: { userId: string; password: string }): Promise<void> {
  try {
    const { data, error } = await client.functions.invoke('set-user-password', { body: { user_id: args.userId, password: args.password } })
    if (error) throw error
    const err = (data as { error?: string } | null)?.error
    if (err) throw new Error(err)
  } catch (e) {
    throw new Error(await functionError(e))
  }
}

/** Create (or find) their CountTooling seat over the bridge, then store the join key. */
export async function createCountToolingSeat(client: Client, args: { userId: string; email: string; name: string | null }): Promise<string> {
  let ctId: string | undefined
  try {
    const { data, error } = await client.functions.invoke('ct-bridge', { body: { verb: 'create', email: args.email, name: args.name ?? undefined } })
    if (error) throw error
    ctId = (data as { ct_user_id?: string } | null)?.ct_user_id
    if (!ctId) throw new Error((data as { error?: string } | null)?.error ?? 'CountTooling sent no seat back.')
  } catch (e) {
    throw new Error(await functionError(e))
  }
  await updateUser(client, args.userId, { counttooling_user_id: ctId })
  return ctId
}

/**
 * Change the email they sign in with (PR C, v2.4344): `change-user-email` moves the login and
 * the app's copy together. Before it, an email edit changed only the copy the app shows.
 */
export async function changeSignInEmail(client: Client, args: { userId: string; email: string }): Promise<{ email: string; unchanged: boolean; rosterRowsUpdated: number }> {
  try {
    const { data, error } = await client.functions.invoke('change-user-email', { body: { user_id: args.userId, email: args.email } })
    if (error) throw error
    const res = (data ?? {}) as { error?: string; email?: string; unchanged?: boolean; rosterRowsUpdated?: number }
    if (res.error) throw new Error(res.error)
    return { email: res.email ?? args.email, unchanged: Boolean(res.unchanged), rosterRowsUpdated: res.rosterRowsUpdated ?? 0 }
  } catch (e) {
    throw new Error(await functionError(e))
  }
}
