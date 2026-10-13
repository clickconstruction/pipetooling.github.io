/**
 * Who `messages-notify`'s push for a reply reads as the office and as a tech (residential R5). Dependency-free, so the
 * app's tests import it straight from here. The client's copies are `GC_OFFICE_TEAM` (the five office roles,
 * `gc_office_team()`) and `MESSAGES_TECH_TEAM` (`messages_tech_team()`) in `src/lib/gc/access.ts`; `access.test.ts`
 * holds each pair to the other.
 */
export const MESSAGES_OFFICE_ROLES: readonly string[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator']

export const MESSAGES_TECH_ROLES: readonly string[] = ['primary', 'helpers']
