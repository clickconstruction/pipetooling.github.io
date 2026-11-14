import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks } from 'lucide-react'
import type { UserRole } from '../../hooks/useAuth'
import { canOpenPunchList, PUNCH_LIST_PATH } from '../../lib/todos/punchListAccess'

/** The header's quiet press, as the page's own Refresh draws it: an outline on the surface. */
const press: CSSProperties = {
  display: 'inline-block',
  font: 'inherit',
  fontSize: '0.8rem',
  padding: '0.25rem 0.7rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

/**
 * The Bridge's door to the Punch list (v2.7147): the last press of the header's top row, so it
 * sits in the page's top right corner and wraps under the name on a phone.
 *
 * It is a link, so a modified click opens the board in a new tab. `canOpenPunchList` decides who
 * sees it, the same line that gates the page: today that is everyone who can open the Bridge.
 */
export function BridgePunchListLink({ role }: { role: UserRole | null | undefined }) {
  if (!canOpenPunchList(role)) return null
  return (
    <Link to={PUNCH_LIST_PATH} style={press} title="Open the Punch list, the board of to-do cards" data-testid="bridge-punch-list">
      <ListChecks size={14} aria-hidden="true" style={{ verticalAlign: '-0.15em', marginRight: '0.35rem' }} />
      Punch list
    </Link>
  )
}
