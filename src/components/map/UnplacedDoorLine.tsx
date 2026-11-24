import type { CSSProperties } from 'react'
import { Link, useInRouterContext } from 'react-router-dom'
import { useOptionalAuth } from '../../hooks/useAuth'
import { isPathAllowedForRole } from '../../lib/layoutRouteAccess'
import { UNPLACED_DOOR_PATH, UNPLACED_DOOR_TITLE } from '../../lib/map/unplacedMemory'

const DOOR: CSSProperties = { color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }
/** On a phone the line is the only way in, so it takes a finger. */
const FINGER: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44 }

/**
 * A map card's count line, *N jobs have no map location yet*, as a press (punch list #408, step 3).
 * For a viewer who may open the Map page it is a link to that page with its list open: each record,
 * why it could not be placed, the day it was checked, and **Try again**. For everyone else, and
 * outside a router or a sign-in (a render smoke), it is the plain words it always was, since the
 * Map page would bounce them.
 */
export function UnplacedDoorLine({ line, finger = false }: { line: string; finger?: boolean }) {
  // `/map` is on the estimator's list with or without prospects access, so `false` is safe here.
  const mayOpenMap = isPathAllowedForRole(useOptionalAuth()?.role ?? null, '/map', false)
  const inRouter = useInRouterContext()
  if (!mayOpenMap || !inRouter) return <>{line}</>
  return (
    <Link to={UNPLACED_DOOR_PATH} data-unplaced-door title={UNPLACED_DOOR_TITLE} style={finger ? { ...DOOR, ...FINGER } : DOOR}>
      {line}
    </Link>
  )
}
