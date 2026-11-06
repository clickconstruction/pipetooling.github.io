import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePersonDeskContext } from '../../contexts/PersonDeskContext'
import { parsePersonDeskParam } from '../../lib/people/personKey'
import { parseDeskSectionParam } from '../../lib/people/personDeskSections'

const PARAM = 'person'
const SECTION_PARAM = 'section'
/** `&flow=bring_back` opens the desk with the Bring back window already up (punch list #256 PR 9, v2.6590). */
const FLOW_PARAM = 'flow'

/**
 * Opens the Person Desk when the URL carries `?person=u:<users.id>` or
 * `?person=p:<people.id>`, on any route, then strips the param so the link is
 * reusable (the `?userReview=` precedent). Mounted globally from Layout.
 * v2.2810: `&section=paperwork` (any id in personDeskSections) opens it scrolled there.
 */
export function PersonDeskDeepLinkHandler() {
  const [searchParams, setSearchParams] = useSearchParams()
  const desk = usePersonDeskContext()
  const handledRef = useRef<string | null>(null)

  useEffect(() => {
    const raw = searchParams.get(PARAM)
    if (!raw) return
    if (handledRef.current === raw) return
    handledRef.current = raw
    const parsed = parsePersonDeskParam(raw)
    const section = parseDeskSectionParam(searchParams.get(SECTION_PARAM))
    const flow = searchParams.get(FLOW_PARAM) === 'bring_back' ? 'bring_back' : null
    if (parsed) desk.open({ ...parsed, section, flow })
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(PARAM)
        next.delete(SECTION_PARAM)
        next.delete(FLOW_PARAM)
        return next
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams, desk])

  return null
}
