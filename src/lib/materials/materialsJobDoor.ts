/**
 * Where a door to one job's materials leads, by who presses it. The office works a job's materials on
 * Jobs → Materials (`boxDeskLink`). That page turns a primary and a superintendent to Reports and an estimator
 * has no Jobs page at all, so three doors that sent every reader there sent those three roles nowhere: the
 * search's box rows, the Procure step's line and the job window's Materials tab. Everyone but the office works a
 * job's boxes on the Tally's On site tab, the screen `onSiteJobHref` already sends them to from Materials → On site.
 *
 * Pure: the role in, the address out.
 */
import { boxDeskLink } from './boxDeskLink'
import { isMaterialsOfficeRole } from './materialsTabs'

/** The Tally's On site tab on one job: the screen for the boxes of everyone but the office. */
export function onSiteTabLink(jobId: string): string {
  return `/tally?tab=on-site&job=${jobId}`
}

/** Whether this reader's door to a job's materials is the office's page. A role not read yet is not the office's. */
export function opensMaterialsDesk(role: string | null | undefined): boolean {
  return isMaterialsOfficeRole(role)
}

/** One job's materials for this reader: the office's page, or the Tally's On site tab. */
export function materialsJobDoorHref(role: string | null | undefined, jobId: string): string {
  return opensMaterialsDesk(role) ? boxDeskLink(jobId) : onSiteTabLink(jobId)
}

/**
 * Whether the search's box rows open the box on the phone screen and nothing else. A field role's search always
 * did. So does every other role that is not the office: the materials page is not theirs to open.
 */
export function boxRowsOpenThePhoneScreen(role: string | null | undefined, fieldLookup: boolean): boolean {
  return fieldLookup || !opensMaterialsDesk(role)
}
