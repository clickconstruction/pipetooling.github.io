import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePersonDeskContext } from '../../contexts/PersonDeskContext'
import { claimPersonDeskLink } from '../../lib/people/personDeskLink'

/**
 * Opens the Person Desk when the URL carries `?person=u:<users.id>` or
 * `?person=p:<people.id>`, on any route, then strips the param so the link is
 * reusable (the `?userReview=` precedent). Mounted globally from Layout.
 * v2.2810: `&section=paperwork` (any id in personDeskSections) opens it scrolled there.
 * A bare `person=` is left to the page that owns it (`claimPersonDeskLink`): People → HR's
 * roster id and the pay Ledger's name key.
 */
export function PersonDeskDeepLinkHandler() {
  const [searchParams, setSearchParams] = useSearchParams()
  const desk = usePersonDeskContext()
  const handledRef = useRef<string | null>(null)

  useEffect(() => {
    const raw = searchParams.get('person')
    if (!raw) return
    if (handledRef.current === raw) return
    const claim = claimPersonDeskLink(searchParams)
    if (!claim) return
    handledRef.current = raw
    desk.open(claim.open)
    setSearchParams((prev) => claimPersonDeskLink(prev)?.next ?? prev, { replace: true })
  }, [searchParams, setSearchParams, desk])

  return null
}
