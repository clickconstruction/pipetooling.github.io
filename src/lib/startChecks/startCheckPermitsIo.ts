/**
 * Before we start (punch list #382, PR 8): the city's permits at each job's address, as the bid form's site panel
 * reads them, for a bullet of ours that reads the permit. It stands apart from `startCheckReadersIo.ts` because it
 * needs the permit rules (the city list, each city's feed, the names that are ours), which no first screen uses:
 * the readers fetch this file when a bullet asks for a permit, and never import it by name. The seat's right to read
 * permits is checked there, before the fetch.
 */
import { readBidAddress, permitsOnSite } from '../research/bidSite'
import { loadPermitsByHouseNumber } from '../research/bidSiteIo'
import { isOurName, ourNameKeys } from '../research/ourNames'
import { loadOurNames } from '../research/ourNamesIo'
import { RESEARCH_CITIES } from '../research/permitResearch'
import type { PermitsRead } from './startCheckReaders'
import type { ReaderJob } from './startCheckReadersIo'

export async function readPermitsOnSites(jobs: readonly ReaderJob[]): Promise<Map<string, PermitsRead>> {
  const out = new Map<string, PermitsRead>()
  const keys = ourNameKeys(await loadOurNames())
  for (const j of jobs) {
    const site = readBidAddress(j.address, RESEARCH_CITIES)
    if (site.kind !== 'site') {
      out.set(j.id, { state: 'no_records' })
      continue
    }
    const rows = await loadPermitsByHouseNumber(site.city, [site.number])
    if (rows == null) {
      out.set(j.id, { state: 'no_records' })
      continue
    }
    const ours = permitsOnSite(site, rows).filter((p) => p.kind === 'plumbing' && isOurName(p.contact, keys))
    out.set(j.id, { state: 'read', permits: ours.map((p) => ({ number: (p.permit_number ?? '').trim() || 'on file', issued: p.stage === 'issued', issuedOn: p.stage === 'issued' ? p.issued_on : null })) })
  }
  return out
}
