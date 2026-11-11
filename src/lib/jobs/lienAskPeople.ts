import { lienHelpAskWords, type LienHelpAskPerson } from './lienHelpSheet'

/**
 * Who a lien help sheet says to ask (punch list #314, change 9): the lien leader on the job, or the dev (the owner,
 * 2026-11-11: *they should call the leader or the dev*). Pure. The leader is the job's master; the dev is the app's
 * dev account, the first by name that has a phone, else the first by name.
 */
export type LienAskUser = { id: string; name: string | null; phone?: string | null; role?: string | null }

const person = (u: LienAskUser | undefined): LienHelpAskPerson | null => ((u?.name ?? '').trim() ? { name: (u?.name ?? '').trim(), phone: (u?.phone ?? '').trim() || null } : null)

/** The dev a sheet names: one person, so the line stays one line however many dev accounts there are. */
export function lienAskDev(users: ReadonlyArray<LienAskUser>): LienHelpAskPerson | null {
  const devs = users.filter((u) => u.role === 'dev' && (u.name ?? '').trim()).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  return person(devs.find((u) => (u.phone ?? '').trim()) ?? devs[0])
}

/** The line for one job: *Not sure? Ask Pat Sample, 555-0100, or Robin Sample.* '' when the app knows neither. */
export function lienAskFor(users: ReadonlyArray<LienAskUser>, masterUserId: string | null | undefined): string {
  const leader = masterUserId ? person(users.find((u) => u.id === masterUserId)) : null
  return lienHelpAskWords(leader, lienAskDev(users))
}
