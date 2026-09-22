/**
 * Born linked (People spine PR 3, v2.3701): the roster row (`people`) that every human account
 * owns, written by `invite-user` and `create-user` right after the `users` upsert — so "two
 * identities until linked" is no longer a state a person can be in. Fail-soft: a roster-row
 * problem never fails the invite; the caller reports `person_id: null` and the desk header's
 * "Create roster row" fix still exists.
 *
 * Fixture accounts get no roster row: samples (`is_sample`), digital twins, and anything on the
 * `*.pipetooling.local` domain both use. The Hiring board's Try-out door keeps its own path.
 */

// deno-lint-ignore no-explicit-any
type AdminClient = any

/** users.role → people.kind; null = no roster row for this role (devs). */
export function rosterKindForRole(role: string): string | null {
  switch (role) {
    case 'helpers':
      return 'helper'
    case 'subcontractor':
      return 'sub'
    case 'dev':
      return null
    case 'master_technician':
    case 'assistant':
    case 'controller':
    case 'estimator':
    case 'primary':
    case 'superintendent':
      return role
    default:
      return null
  }
}

export function isFixtureEmail(email: string): boolean {
  return /@[a-z0-9.-]*pipetooling\.local$/i.test(email.trim())
}

function isYmd(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export async function ensureLinkedRosterRow(
  admin: AdminClient,
  args: { userId: string; email: string; name: string | null; role: string; masterUserId: string; startDate?: unknown; skip?: boolean },
): Promise<{ personId: string | null; linked: 'existing' | 'by_email' | 'by_name' | 'created' | 'skipped'; error: string | null }> {
  const kind = rosterKindForRole(args.role)
  if (args.skip || !kind || isFixtureEmail(args.email)) return { personId: null, linked: 'skipped', error: null }
  const name = (args.name ?? '').trim()
  const email = args.email.trim().toLowerCase()
  const startDate = isYmd(args.startDate) ? args.startDate : null
  try {
    // 1. Already linked.
    const { data: linked } = await admin.from('people').select('id, start_date').eq('account_user_id', args.userId).limit(1)
    const have = (linked ?? [])[0] as { id: string; start_date: string | null } | undefined
    if (have) {
      if (startDate && !have.start_date) await admin.from('people').update({ start_date: startDate }).eq('id', have.id)
      return { personId: have.id, linked: 'existing', error: null }
    }
    // 2. An unlinked, unarchived roster row with the same email — link it (the `unlinked_email_match` gap).
    const { data: byEmail } = await admin.from('people').select('id').is('account_user_id', null).is('archived_at', null).ilike('email', email).limit(2)
    const emailRows = (byEmail ?? []) as Array<{ id: string }>
    if (emailRows.length === 1) {
      const patch: Record<string, unknown> = { account_user_id: args.userId }
      if (startDate) patch.start_date = startDate
      await admin.from('people').update(patch).eq('id', emailRows[0].id)
      return { personId: emailRows[0].id, linked: 'by_email', error: null }
    }
    // 3. One unlinked, unarchived roster row with exactly this name — link it.
    if (name) {
      const { data: byName } = await admin.from('people').select('id').is('account_user_id', null).is('archived_at', null).eq('name', name).limit(2)
      const nameRows = (byName ?? []) as Array<{ id: string }>
      if (nameRows.length === 1) {
        const patch: Record<string, unknown> = { account_user_id: args.userId, email }
        if (startDate) patch.start_date = startDate
        await admin.from('people').update(patch).eq('id', nameRows[0].id)
        return { personId: nameRows[0].id, linked: 'by_name', error: null }
      }
    }
    // 4. New person.
    const { data: created, error } = await admin
      .from('people')
      .insert({ master_user_id: args.masterUserId, kind, name: name || email, email, account_user_id: args.userId, start_date: startDate })
      .select('id')
      .single()
    if (error) return { personId: null, linked: 'created', error: error.message }
    return { personId: (created as { id: string }).id, linked: 'created', error: null }
  } catch (e) {
    return { personId: null, linked: 'created', error: e instanceof Error ? e.message : String(e) }
  }
}
