/**
 * Who `messages-notify`'s push for a reply reads as the office and as a tech (residential R5). Dependency-free, so the
 * app's tests import it straight from here. The client's copies are `GC_OFFICE_TEAM` (the five office roles,
 * `gc_office_team()`) and `MESSAGES_TECH_TEAM` (`messages_tech_team()`) in `src/lib/gc/access.ts`; `access.test.ts`
 * holds each pair to the other.
 */
export const MESSAGES_OFFICE_ROLES: readonly string[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator']

export const MESSAGES_TECH_ROLES: readonly string[] = ['primary', 'helpers']

/**
 * Who `messages-notify` tells when a clause change waits for approval: the database's `gc_clause_approve_team()` and
 * the client's `GC_CLAUSE_APPROVE_TEAM`, the owner beside the dev and the controller since punch list #188 row 30
 * (v2.6762). `access.test.ts` holds this copy to the client's, which it holds to the migration's.
 */
export const CLAUSE_APPROVER_ROLES: readonly string[] = ['dev', 'master_technician', 'controller']
