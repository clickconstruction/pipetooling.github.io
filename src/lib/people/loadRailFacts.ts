import { supabase } from '../supabase'
import { buildApprovalsQueue } from './approvalsQueue'
import { fetchAllPendingClockSessions } from './fetchAllPendingClockSessions'
import type { RailFacts } from './deskRailAttention'

export type RailFactsAccess = {
  canAccessHours: boolean
  canAccessPay: boolean
  canAccessContracts: boolean
  canAccessLicenses: boolean
}

/**
 * The attention facts behind the Person tab rail and the Users tab row chips
 * (v2.2762): sessions waiting per account, unsent / expiring / expired
 * paperwork and licenses per pay name, and which subs have a live portal.
 * Every query is one the tabs already run; a table the viewer cannot read
 * simply contributes nothing.
 */
export async function loadRailFacts(access: RailFactsAccess, todayYmd: string): Promise<RailFacts> {
  const soon = new Date(Date.parse(`${todayYmd}T12:00:00Z`) + 30 * 86_400_000).toISOString().slice(0, 10)
  const [pending, docsRes, licRes, portalRes] = await Promise.all([
    access.canAccessHours || access.canAccessPay ? fetchAllPendingClockSessions().catch(() => []) : Promise.resolve([]),
    access.canAccessContracts
      ? supabase.from('person_contract_documents').select('person_name, status, expires_at').or(`status.eq.unsent,expires_at.lte.${soon}`)
      : Promise.resolve({ data: [] }),
    access.canAccessLicenses ? supabase.from('person_licenses').select('person_name, date_of_expiry').lte('date_of_expiry', soon) : Promise.resolve({ data: [] }),
    supabase.from('sub_portal_links').select('person_id').is('revoked_at', null),
  ])
  const pendingByUserId: RailFacts['pendingByUserId'] = {}
  const q = buildApprovalsQueue(pending, { todayYmd })
  for (const person of q.people) pendingByUserId[person.userId] = { count: person.count, hours: person.hours }
  const unsentDocsByName: Record<string, number> = {}
  const expiringByName: Record<string, number> = {}
  const expiredByName: Record<string, number> = {}
  for (const d of (((docsRes as { data: unknown[] | null }).data) ?? []) as Array<{ person_name: string | null; status: string; expires_at: string | null }>) {
    const n = (d.person_name ?? '').trim()
    if (!n) continue
    if (d.status === 'unsent') unsentDocsByName[n] = (unsentDocsByName[n] ?? 0) + 1
    if (d.expires_at) {
      if (d.expires_at < todayYmd) expiredByName[n] = (expiredByName[n] ?? 0) + 1
      else expiringByName[n] = (expiringByName[n] ?? 0) + 1
    }
  }
  for (const l of (((licRes as { data: unknown[] | null }).data) ?? []) as Array<{ person_name: string; date_of_expiry: string | null }>) {
    const n = l.person_name.trim()
    if (!l.date_of_expiry) continue
    if (l.date_of_expiry < todayYmd) expiredByName[n] = (expiredByName[n] ?? 0) + 1
    else expiringByName[n] = (expiringByName[n] ?? 0) + 1
  }
  const portalOnPersonIds = new Set<string>()
  for (const r of (((portalRes as { data: unknown[] | null }).data) ?? []) as Array<{ person_id: string }>) portalOnPersonIds.add(r.person_id)
  return { pendingByUserId, unsentDocsByName, expiringByName, expiredByName, portalOnPersonIds }
}
