import type { CSSProperties } from 'react'
import { DashboardViewPicker } from '../../dashboard/DashboardViewPicker'
import type { DashboardViewIo } from '../../../lib/dashboard/dashboardViewIo'
import { canHaveShortDashboard, canSetDashboardView, canSetDashboardViewFor, DASHBOARD_VIEW_PICKER_WORDS } from '../../../lib/dashboard/shortDashboard'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { DeskRow, DeskSection } from '../personDeskShared'

/**
 * The People desk's **Dashboard view** section: the office sets a person's Dashboard to Short or Full
 * (`users.dashboard_view` through `set_dashboard_view`), so a person who will not open Settings still gets the
 * short page. Drawn only on the desk of a person whose role takes a view: the leader, a dev and, since punch
 * list #384, a superintendent. The leader, a dev and the assistant press, and a person presses his own row; the
 * controller and a training account read. `canSetDashboardView` is the rule, the same one the function holds.
 */

const HINT: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }

export function PersonDeskDashboardViewSection({ userId, displayName, personRole, viewer, viewerUserId, changeKey, io }: { userId: string | null; displayName: string; personRole: string | null; viewer: PersonDeskViewer; viewerUserId?: string | null; changeKey: number; io?: DashboardViewIo }) {
  if (!userId || !canHaveShortDashboard(personRole)) return null
  const mayPress = canSetDashboardView({ viewerRole: viewer.role, viewerUserId, targetUserId: userId, targetRole: personRole })
  if (!mayPress && viewer.role !== 'controller') return null
  const editable = mayPress && !viewer.readOnly
  const office = canSetDashboardViewFor(viewer.role)
  const first = displayName.trim().split(/\s+/)[0] || 'this person'

  return (
    <DeskSection title={DASHBOARD_VIEW_PICKER_WORDS.label} id="dashboard_view" who={!editable ? 'read only' : office ? 'the office picks' : 'you pick'}>
      <DeskRow label="View">
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={HINT}>{DASHBOARD_VIEW_PICKER_WORDS.hintFor(first)}</span>
          <DashboardViewPicker userId={userId} self={viewerUserId === userId} editable={editable} changeKey={changeKey} io={io} />
        </div>
      </DeskRow>
    </DeskSection>
  )
}
