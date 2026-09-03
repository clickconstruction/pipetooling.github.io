import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePersonDeskContext } from '../../contexts/PersonDeskContext'
import { parsePersonDeskParam } from '../../lib/people/personKey'

const PARAM = 'person'

/**
 * Opens the Person Desk when the URL carries `?person=u:<users.id>` or
 * `?person=p:<people.id>`, on any route, then strips the param so the link is
 * reusable (the `?userReview=` precedent). Mounted globally from Layout.
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
    if (parsed) desk.open(parsed)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(PARAM)
        return next
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams, desk])

  return null
}
