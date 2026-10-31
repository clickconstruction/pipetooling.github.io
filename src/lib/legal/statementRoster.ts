import { humanRoleLabel } from '../roleLabels'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'

/**
 * The roster as the affidavit window reads it (punch list #220, v2.6210): who may swear a statement as one of our
 * team, in what order, and the role line the paper gives them. Pure, beside `affidavitPaper.ts`.
 */
export type RosterUser = { id: string; name: string | null; role?: string | null; title?: string | null }

/** The role line the roster fills in for one of our team: the RMP's as the paper names it, else the person's title or role. */
export function rosterRoleLine(u: Pick<RosterUser, 'role' | 'title'>, company = PORTAL_COMPANY.name): string {
  if (u.role === 'master_technician') return `Responsible Master Plumber of record for ${company}`
  const t = (u.title ?? '').trim()
  return `${t || humanRoleLabel(u.role ?? null)} at ${company}`
}

/** The roster as the pick lists it: the RMPs first, then everyone else by name; a row with no name is left out. */
export function rosterForPick(roster: ReadonlyArray<RosterUser>): RosterUser[] {
  return [...roster]
    .filter((u) => (u.name ?? '').trim())
    .sort((a, b) => Number(b.role === 'master_technician') - Number(a.role === 'master_technician') || (a.name ?? '').localeCompare(b.name ?? ''))
}
