/**
 * Account on the desk, PR D1 (v2.4346): the two ways a duplicate folds into the account you
 * keep, lifted out of the Active Accounts window so the person's desk runs the same steps.
 *
 *  - another login account: the `merge-users` edge function (`merge_user_accounts` RPC), with
 *    a dry run first;
 *  - an external roster person with no login (subcontractor survivors only): the combine-people
 *    engine folds their hours, pay, crew records and sub sheets onto the kept account's roster
 *    identity, or links them as its roster entry when the account has none yet.
 *
 * Eligibility stays in `mergeUserAccounts.ts`; the RPC re-checks everything.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { executeCombinePeople, previewCombinePeople } from '../combinePeople'

type Client = SupabaseClient<Database>

export type MergePreview = { moved: Record<string, number>; warnings: string[] }
export type MergeSurvivor = { id: string; name: string | null; email: string | null }
export type ExternalDuplicate = { id: string; name: string }

async function functionError(e: unknown): Promise<string> {
  if (e instanceof FunctionsHttpError && e.context) {
    try {
      const b = (await e.context.json()) as { error?: string } | null
      if (b?.error) return b.error
    } catch {
      /* fall through */
    }
  }
  return e instanceof Error ? e.message : 'Merge failed'
}

type MergeUsersResponse = { success?: boolean; error?: string; moved?: Record<string, number>; warnings?: string[] }

async function mergeUsers(client: Client, args: { survivorId: string; absorbedId: string; dryRun: boolean }): Promise<MergePreview> {
  let res: MergeUsersResponse | null = null
  try {
    const { data, error } = await client.functions.invoke('merge-users', {
      body: { survivor_user_id: args.survivorId, absorbed_user_id: args.absorbedId, dry_run: args.dryRun },
    })
    if (error) throw error
    res = data as MergeUsersResponse | null
  } catch (e) {
    throw new Error(await functionError(e))
  }
  if (!res?.success) throw new Error(res?.error || 'Merge failed.')
  return { moved: res.moved ?? {}, warnings: res.warnings ?? [] }
}

/** What would move if `absorbedId` folded into `survivorId`, changing nothing. */
export function previewAccountMerge(client: Client, args: { survivorId: string; absorbedId: string }): Promise<MergePreview> {
  return mergeUsers(client, { ...args, dryRun: true })
}

/** Fold `absorbedId` into `survivorId`. Cannot be undone. */
export async function runAccountMerge(client: Client, args: { survivorId: string; absorbedId: string }): Promise<void> {
  await mergeUsers(client, { ...args, dryRun: false })
}

function survivorLabel(s: MergeSurvivor): string {
  return (s.name || s.email || 'the account').trim()
}

/** The kept account's own roster row, oldest first; null when it has none yet. */
async function survivorRosterRow(client: Client, survivorId: string): Promise<{ id: string; name: string; account_user_id: string | null } | null> {
  const { data, error } = await client
    .from('people')
    .select('id, name, account_user_id')
    .eq('account_user_id', survivorId)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw new Error(error.message)
  return (data?.[0] as { id: string; name: string; account_user_id: string | null } | undefined) ?? null
}

/** What folding an external roster person into the account would do, changing nothing. */
export async function previewExternalMerge(client: Client, args: { survivor: MergeSurvivor; person: ExternalDuplicate }): Promise<MergePreview> {
  const name = survivorLabel(args.survivor)
  const existing = await survivorRosterRow(client, args.survivor.id)
  if (!existing) {
    return {
      moved: {},
      warnings: [
        `${name} has no roster person row yet, so "${args.person.name}" will simply be linked to the account as its roster entry. Their hours, pay records, crew records, and sub sheets already belong to that row, so nothing needs to move and nothing is archived.`,
      ],
    }
  }
  const p = await previewCombinePeople(args.person.id, args.person.name)
  const moved: Record<string, number> = {}
  for (const line of p.lines) {
    const n = Math.max(line.nameRows, line.idRows)
    if (n > 0) moved[line.table] = n
  }
  if (p.laborSheets > 0) moved['sub sheets (assigned names)'] = p.laborSheets
  return {
    moved,
    warnings: [
      `"${args.person.name}" is an external roster person (no login) — their hours, pay records, crew records, and sub sheets fold onto ${name}'s roster identity, then the external row is archived. No login-account data moves.`,
    ],
  }
}

/** Fold an external roster person into the account; returns the line to show. */
export async function runExternalMerge(client: Client, args: { survivor: MergeSurvivor; person: ExternalDuplicate }): Promise<string> {
  const name = survivorLabel(args.survivor)
  const existing = await survivorRosterRow(client, args.survivor.id)
  if (!existing) {
    // Link, don't insert: RLS only lets you INSERT people rows you own, but devs can UPDATE any
    // row, and linking is the right meaning anyway (the external row becomes the account's entry).
    const { error } = await client.from('people').update({ account_user_id: args.survivor.id }).eq('id', args.person.id)
    if (error) throw new Error(`link ${args.person.name} to ${name}: ${error.message}`)
    return `Linked ${args.person.name} to ${name}'s account as its roster entry.`
  }
  const result = await executeCombinePeople({
    source: { id: args.person.id, name: args.person.name, account_user_id: null },
    target: { id: existing.id, name: existing.name, account_user_id: existing.account_user_id },
  })
  return `Merged ${args.person.name} into ${name}: ${result.renamedRows} rows renamed, ${result.repointedRows} repointed, ${result.sheetsRewritten} sheets updated. External row archived.`
}
