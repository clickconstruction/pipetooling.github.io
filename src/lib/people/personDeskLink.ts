import { parsePersonDeskParam } from './personKey'
import { parseDeskSectionParam, type PersonDeskSectionId } from './personDeskSections'

/**
 * The Person Desk's deep link: `?person=u:<users.id>` or `?person=p:<people.id>` on any route
 * opens the desk, and the handler (mounted from Layout) takes `person`, `section` and `flow`
 * off the address so the link is reusable.
 *
 * The desk claims only a value it can read. A bare `person=` belongs to the page that wrote it:
 * People → HR keeps a roster id there (`/people?tab=hr&person=<people.id>`) and the pay Ledger
 * a name key. The handler used to strip every `person=`, so a link to one HR file landed on the
 * whole roster with the person gone from the address. Pure.
 */
export type PersonDeskLinkClaim = {
  open: { userId?: string; personId?: string; section: PersonDeskSectionId | null; flow: 'bring_back' | null }
  /** The address without the desk's params. */
  next: URLSearchParams
}

export const PERSON_DESK_LINK_PARAMS = ['person', 'section', 'flow'] as const

export function claimPersonDeskLink(params: URLSearchParams): PersonDeskLinkClaim | null {
  const parsed = parsePersonDeskParam(params.get('person'))
  if (!parsed) return null
  const section = parseDeskSectionParam(params.get('section'))
  const flow = params.get('flow') === 'bring_back' ? 'bring_back' : null
  const next = new URLSearchParams(params)
  for (const name of PERSON_DESK_LINK_PARAMS) next.delete(name)
  return { open: { ...parsed, section, flow }, next }
}
