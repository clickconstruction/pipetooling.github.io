import { isAssistantLike } from '../subcontractorLikeRole'

/**
 * Which roles Checklist draws Review and Manage for: a dev, the owner and the assistant-like roles. Everyone else has
 * Today and History alone.
 */
export function hasOfficeChecklistTabs(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

/**
 * The address names Review or Manage and this role is drawn neither, so the page would be empty under its two tabs.
 * Such a landing goes to Today. A dev who uses View as from Review lands this way as a crew person (punch list #381).
 * A role that is not read yet answers false, since the page waits for it.
 */
export function officeTabLandsOnToday(tab: string | null | undefined, role: string | null | undefined): boolean {
  return (tab === 'review' || tab === 'manage') && role != null && !hasOfficeChecklistTabs(role)
}
