import type { UserRole } from '../../hooks/useAuth'

/**
 * GC mode, door 1 (v2.4832) and door 2: who opens the GC projects page, its windows (New project, a
 * new set of plans, the plans, the questions, the scope book) and the Board (the Project Board,
 * Trade partners, Follow up, the Ask window, the company window), and who sees the door on Bids.
 * The client's copy of the database's `gc_office_team()`, which names its roles since door 2:
 * `access.test.ts` reads the newest migration that defines it and fails when the two lists differ.
 */
export const GC_OFFICE_TEAM: readonly UserRole[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator']

export function canOpenGcProjects(role: UserRole | null | undefined): boolean {
  return role != null && GC_OFFICE_TEAM.includes(role)
}

/**
 * GC mode, B5 (v2.4923): who sees our number, the general conditions, contingency and fee we add on
 * top of the trades. The client's copy of the database's `gc_money_team()`
 * (`20261008130000_gc_our_number.sql`): dev, the leaders and the controller. `access.test.ts` reads
 * the newest migration that defines the function and fails when the two lists differ.
 */
export const GC_MONEY_TEAM: readonly UserRole[] = ['dev', 'master_technician', 'controller']

export function canSeeGcMoney(role: UserRole | null | undefined): boolean {
  return role != null && GC_MONEY_TEAM.includes(role)
}

/**
 * GC mode, P3-a (v2.4936): who may email a trade partner through `gc-trade-email`. A dev until the portal's door, then
 * the office team. The client's copy of the function's `GC_TRADE_EMAIL_ROLES`
 * (`supabase/functions/_shared/gcTradeEmail.ts`); `access.test.ts` fails when the two differ. A screen offers a send only
 * to this team and tells everyone else the emails go out once the portal opens.
 */
export const GC_TRADE_EMAIL_TEAM: readonly UserRole[] = ['dev']

export function canSendGcTradeEmail(role: UserRole | null | undefined): boolean {
  return role != null && GC_TRADE_EMAIL_TEAM.includes(role)
}

/**
 * GC mode, the Building lane (U3a-ii): who opens Building's windows on a job being built, the Daily
 * log first. A dev while Building is built, since every Building table's policy is `is_dev()` until
 * Building's door (`doors.ts`). `access.test.ts` fails when this list and those doors disagree, so the
 * door PR changes both. Every Building window takes this one gate.
 */
export const GC_BUILDING_TEAM: readonly UserRole[] = ['dev']

export function canUseGcBuilding(role: UserRole | null | undefined): boolean {
  return role != null && GC_BUILDING_TEAM.includes(role)
}

/**
 * GC mode, the schedule's PR 10 (v2.5114): who opens the **Schedule** window on a project's card and moves a bar
 * in it (G-133). The client's copy of `gc_on_schedule_team()`'s office arm: the GC office, the same five roles as
 * `GC_OFFICE_TEAM`. The database's helper also lets in the job's project manager, who is not a role, and who
 * cannot open `/gc` from outside the office yet. Building's door adds the superintendent here and in the helper.
 * `access.test.ts` fails when this list and the schedule's doors in `doors.ts` disagree.
 */
export const GC_SCHEDULE_TEAM: readonly UserRole[] = GC_OFFICE_TEAM

export function canUseGcSchedule(role: UserRole | null | undefined): boolean {
  return role != null && GC_SCHEDULE_TEAM.includes(role)
}
