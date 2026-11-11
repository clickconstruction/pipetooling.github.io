/**
 * Cards and footers (punch list #313) — a teammate's card and footer, opened by the office.
 *
 * People → Users, a person's row menu, *Card and footer…*. It is the same card a person has on
 * Settings → Your account (`YourCardCard`), with that teammate's facts and photo: the office may
 * add their photo, set the name on their card and their title, and take their footer and card.
 */
import ResponsiveModalShell from '../ResponsiveModalShell'
import { DESK_EDITOR_Z } from '../personDesk/personDeskShared'
import { YourCardCard } from '../settings/YourCardCard'
import type { UserRole } from '../../hooks/useAuth'

export function CardAndFooterWindow({ userId, name, role, onClose }: { userId: string; name: string; role: UserRole | null; onClose: () => void }) {
  return (
    <ResponsiveModalShell title="Card and footer" onRequestClose={onClose} maxWidthDesktop={1080} zIndex={DESK_EDITOR_Z} fullScreenKey="card-and-footer">
      <div data-card-and-footer-window style={{ padding: '0.25rem 0 0' }}>
        <YourCardCard role={role} userId={userId} teammate={name} sheetZIndex={DESK_EDITOR_Z + 200} />
      </div>
    </ResponsiveModalShell>
  )
}
