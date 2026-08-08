/**
 * Account Man kernel (v2.1466): the job's designated customer-relationship
 * owner and their communication level. Data lives on jobs_ledger
 * (account_manager_user_id + account_manager_relationship, v2.1465); the
 * "must be a team member" invariant is enforced by the Edit Job picker and a
 * DB trigger that clears the Account Man when they leave the team.
 */

export const ACCOUNT_MAN_RELATIONSHIPS = ['primary', 'preferred', 'only'] as const
export type AccountManRelationship = (typeof ACCOUNT_MAN_RELATIONSHIPS)[number]

/** Full labels for the Edit Job select. */
export const ACCOUNT_MAN_RELATIONSHIP_LABELS: Record<AccountManRelationship, string> = {
  primary: 'Primary communicator',
  preferred: 'Preferred communicator',
  only: 'Only communicator',
}

/** Short suffix for the compact Pipeline chip ("Malachi · preferred"). */
export const ACCOUNT_MAN_RELATIONSHIP_SHORT: Record<AccountManRelationship, string> = {
  primary: 'primary',
  preferred: 'preferred',
  only: 'only',
}

export function parseAccountManRelationship(value: string | null | undefined): AccountManRelationship | null {
  return (ACCOUNT_MAN_RELATIONSHIPS as readonly string[]).includes(value ?? '')
    ? (value as AccountManRelationship)
    : null
}

export type AccountManDisplay = {
  name: string
  relationship: AccountManRelationship
  /** 'quiet' = primary line, 'preferred' = amber outline chip, 'only' = red chip + cell stripes. */
  variant: 'quiet' | 'preferred' | 'only'
}

/** Null when the job has no (visible) Account Man — callers render nothing. */
export function buildAccountManDisplay(job: {
  account_manager_user_id?: string | null
  account_manager_relationship?: string | null
  account_manager?: { name: string | null } | null
}): AccountManDisplay | null {
  if (!job.account_manager_user_id) return null
  const name = job.account_manager?.name?.trim() || ''
  if (!name) return null
  const relationship = parseAccountManRelationship(job.account_manager_relationship) ?? 'primary'
  return {
    name,
    relationship,
    variant: relationship === 'only' ? 'only' : relationship === 'preferred' ? 'preferred' : 'quiet',
  }
}
