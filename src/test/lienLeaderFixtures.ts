import type { LienDeskEntry, LienDeskItemRow, LienDeskMonth } from '../lib/jobs/lienDesk'
import type { LienLeaderSignInput } from '../lib/jobs/lienLeaderSignCard'

/**
 * Made-up notices on the Awaiting approval pile, for the leader's card (v2.7435): the kernel's tests and the card's
 * render smoke read the same fixtures. Every name is a ZZ Test name.
 */
export const LEADER_TODAY = '2026-11-16'

/** Whole days from LEADER_TODAY to a day, as the desk's month rows carry it. */
function daysTo(ymd: string): number {
  return Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${LEADER_TODAY}T00:00:00Z`)) / 86_400_000)
}

export const leaderMonth = (key: string, deadline: string, over: Partial<LienDeskMonth> = {}): LienDeskMonth => ({ key, approvedHours: 10, deadline, daysLeft: daysTo(deadline), noticed: false, fromCreation: false, ...over })

const item = (months: string[], submitted: string | null, fields: unknown = { notice: { claimAmount: '100.00' } }): LienDeskItemRow =>
  ({ id: `item-${months.join('-')}`, kind: 'notice_53_056', status: 'awaiting_approval', months, submitted_at: submitted, voided_at: null, fields }) as unknown as LienDeskItemRow

export function leaderEntry(jobId: string, over: Partial<LienDeskEntry> & { itemMonths?: string[]; submitted?: string | null; fields?: unknown } = {}): LienDeskEntry {
  const { itemMonths, submitted, fields, ...rest } = over
  const months = rest.months ?? []
  return {
    jobId,
    customerId: null,
    gcCustomerId: `gc-${jobId}`,
    openBalance: 1000,
    hasOwner: true,
    propertyKind: 'non_residential',
    months,
    datedFromCreation: false,
    dueMonths: months.filter((m) => !m.noticed && m.daysLeft >= 0).map((m) => m.key),
    missedMonths: months.filter((m) => !m.noticed && m.daysLeft < 0).map((m) => m.key),
    missedUnrecorded: [],
    affidavitDay: null,
    affidavitDaysLeft: null,
    earliestDeadline: null,
    daysLeft: null,
    severity: 'quiet',
    item: item(itemMonths ?? months.map((m) => m.key), submitted === undefined ? '2026-10-07T21:13:06.755+00:00' : submitted, fields),
    policy: 'ask',
    pile: 'awaiting',
    ...rest,
  }
}

const NAMES: Record<string, [string, string]> = {
  j891: ['891', 'ZZ Test Car Wash'],
  j804: ['804', 'ZZ Test Auto Parts'],
  j922: ['922', 'ZZ Test House'],
  j372: ['372', 'ZZ Test Duplex'],
}

export const leaderInput = (awaiting: LienDeskEntry[], over: Partial<LienLeaderSignInput> = {}): LienLeaderSignInput => ({
  todayYmd: LEADER_TODAY,
  awaiting,
  jobNumber: (id) => NAMES[id]?.[0] ?? id,
  jobName: (id) => NAMES[id]?.[1] ?? '',
  gcName: (id) => `ZZ Test GC ${id.replace('gc-j', '')}`,
  ...over,
})

/** The desk as it stood on 2026-11-16, with made-up names: one window closes today, two notices the desk holds no window for. */
export const leaderTonight = (): LienDeskEntry[] => [
  leaderEntry('j804', { openBalance: 3553.4, itemMonths: ['2026-07', '2026-08', '2026-09'] }),
  leaderEntry('j922', { openBalance: 0, itemMonths: ['2026-09'] }),
  leaderEntry('j891', { openBalance: 2976.34, months: [leaderMonth('2026-07', '2026-10-15'), leaderMonth('2026-08', '2026-11-16')] }),
]

/** Nine waiting: two close today, the rest on Dec 15. */
export const leaderNine = (): LienDeskEntry[] =>
  Array.from({ length: 9 }, (_, i) => leaderEntry(`j${i}`, { openBalance: 100 * (i + 1), months: [leaderMonth('2026-09', i < 2 ? '2026-11-16' : '2026-12-15')] }))
