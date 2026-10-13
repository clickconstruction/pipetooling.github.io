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
 * Messages in the header (residential R2): who opens `/messages`, Follow up for every kind of person with their
 * threads. The GC office team, since the spine's tables open to `gc_office_team()` alone. The field reaches a customer
 * from Job Mode through the tech's door (`canMessageCustomersFromJobMode`), never from this page.
 */
export function canOpenMessages(role: UserRole | null | undefined): boolean {
  return canOpenGcProjects(role)
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
 * GC mode, Owner Billing's O9: who writes the Board's award records, the statement of work first (its **Send to their
 * portal to sign**). A dev until the award door (the owner's call W), since `gc_sows` and `gc_sow_lines` write through
 * `is_dev()` alone. The money team reads them since O9, so a screen shows them the card read only. `access.test.ts`
 * fails when this list and those doors disagree, so the award door changes both.
 */
export const GC_BOARD_WRITE_TEAM: readonly UserRole[] = ['dev']

export function canUseGcBoardWrites(role: UserRole | null | undefined): boolean {
  return role != null && GC_BOARD_WRITE_TEAM.includes(role)
}

/**
 * GC mode, the Board's B2b-v-iii (gc 5): who may open our contract's own file, from the private bucket
 * `gc-owner-contracts`. The client's copy of that bucket's select policy (`gc_owner_contracts_select`, `is_dev()` since
 * 20261010090000): a dev today, the money team once award's door opens the bucket. `access.test.ts` fails when the
 * policy and this list disagree, so the door changes both.
 */
export const GC_OWNER_CONTRACT_FILE_TEAM: readonly UserRole[] = ['dev']

export function canOpenOwnerContractFile(role: UserRole | null | undefined): boolean {
  return role != null && GC_OWNER_CONTRACT_FILE_TEAM.includes(role)
}

/**
 * Messages, cut 4c (v2.5247): who edits a contract clause and who approves one (the owner, 2026-10-12: anyone in the
 * office edits, a controller or a dev approves). An office edit waits as a proposal; a dev's or a controller's own edit
 * publishes at once (`src/lib/contracts/approval.ts`). Nobody else edits, so a superintendent reads the papers and never
 * changes them. The database's copies: gc_office_team() edits and gc_clause_approve_team() approves
 * (`20261012150000_contract_clauses.sql`); `access.test.ts` fails when the approvers differ.
 */
export const GC_CLAUSE_EDIT_TEAM: readonly UserRole[] = GC_OFFICE_TEAM

export const GC_CLAUSE_APPROVE_TEAM: readonly UserRole[] = ['dev', 'controller']

export function canEditClause(role: UserRole | null | undefined): boolean {
  return role != null && GC_CLAUSE_EDIT_TEAM.includes(role)
}

/**
 * Who edits the flows in Settings → Flows (Messages, cut 4): the office team, the client copy of the flows tables'
 * `gc_office_team()` policies and `flow_save`'s own check (`20261012120000`, `20261013020000`).
 */
export const GC_FLOWS_EDIT_TEAM: readonly UserRole[] = GC_OFFICE_TEAM

export function canEditFlows(role: UserRole | null | undefined): boolean {
  return role != null && GC_FLOWS_EDIT_TEAM.includes(role)
}

export function canApproveClause(role: UserRole | null | undefined): boolean {
  return role != null && GC_CLAUSE_APPROVE_TEAM.includes(role)
}

/**
 * Messages, R5 (v2.5419): the field roles that message a customer from Job Mode, primary and helpers (`roleLabels.ts`);
 * a subcontractor stays out until R8 · 12. The client's copy of the database's `messages_tech_team()`
 * (`20261013190000_messages_tech_door.sql`), which with `messages_tech_can_read()` opens a customer's thread to a tech
 * dispatched to or clocked on one of its jobs this week or last. `access.test.ts` fails when the two lists differ.
 */
export const MESSAGES_TECH_TEAM: readonly UserRole[] = ['primary', 'helpers']

export function canMessageCustomersFromJobMode(role: UserRole | null | undefined): boolean {
  return role != null && MESSAGES_TECH_TEAM.includes(role)
}

/**
 * Messages, cut 10: who reads a Pipeline job's calls, texts and emails in its Job activity. The office team, and since
 * the owner's word of 2026-10-13 the field roles of R5's door. The read runs under the rows' policies, so a tech gets
 * the lines of a customer whose job they worked this week or last, tied to the job, and never an office-only note.
 */
export function canReadJobMessages(role: UserRole | null | undefined): boolean {
  return role != null && (GC_OFFICE_TEAM.includes(role) || MESSAGES_TECH_TEAM.includes(role))
}
