import type { PayConfigRow } from '../../types/peoplePayConfig'
import type { PersonDeskSectionId } from '../../lib/people/personDeskSections'
import { describeLastSeen } from '../../lib/people/personKey'
import { hasSupervisionSwitch } from '../../lib/people/supervision'
import { humanRoleLabel } from '../../lib/roleLabels'
import type { UsersTabLens } from '../../lib/people/usersTabLens'
import { SalaryWorkScheduleSettings } from '../SalaryWorkScheduleSettings'
import { BTN_RED, DESK_EDITOR_Z } from '../personDesk/personDeskShared'
import { PAY_CELL_WIDTHS, PayConfigCells, payConfigRowOrEmpty, type PayConfigCellsProps } from './PayConfigCells'

/**
 * The Users tab's Account and Pay lens cells (People spine PR 5, v2.3702): the columns
 * Active Accounts and the People pay config modal used to show, now on the roster's own
 * rows. Every switch is the same switch the desk has; the desk stays the editor for what a
 * row cannot hold (password, name, merge, archive — the Account lens's Desk door).
 */

const ACCOUNT_CELL_WIDTHS = { role: 104, signin: 96, training: 72, supervision: 96, desk: 52 } as const

const HEAD: React.CSSProperties = { textAlign: 'center', fontSize: '0.625rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }

/** The column header above the first group — one per lens (contact keeps the needs rail's own). */
export function UsersLensHeader({ lens }: { lens: Exclude<UsersTabLens, 'contact'> }) {
  if (lens === 'pay') {
    return (
      <div aria-hidden style={{ display: 'flex', gap: 6, marginLeft: 'auto', paddingRight: 34 }}>
        <span style={{ ...HEAD, width: PAY_CELL_WIDTHS.wage }}>Hourly $</span>
        <span style={{ ...HEAD, width: PAY_CELL_WIDTHS.office }}>Office $</span>
        <span style={{ ...HEAD, width: PAY_CELL_WIDTHS.salary }}>Salary</span>
        <span style={{ ...HEAD, width: PAY_CELL_WIDTHS.record }}>Rec. hrs</span>
        <span style={{ ...HEAD, width: PAY_CELL_WIDTHS.vehicle }}>Vehicle</span>
        <span style={{ ...HEAD, width: 88 }}>Workday</span>
      </div>
    )
  }
  return (
    <div aria-hidden style={{ display: 'flex', gap: 6, marginLeft: 'auto', paddingRight: 34 }}>
      <span style={{ ...HEAD, width: ACCOUNT_CELL_WIDTHS.role }}>Role</span>
      <span style={{ ...HEAD, width: ACCOUNT_CELL_WIDTHS.signin }}>Sign-in</span>
      <span style={{ ...HEAD, width: ACCOUNT_CELL_WIDTHS.training }}>Training</span>
      <span style={{ ...HEAD, width: ACCOUNT_CELL_WIDTHS.supervision }}>Supervision</span>
      <span style={{ ...HEAD, width: ACCOUNT_CELL_WIDTHS.desk }}>Desk</span>
    </div>
  )
}

const CELL: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', flexShrink: 0, minHeight: 24 }

export function UsersTabAccountCells({
  item,
  isSelf,
  canSetTraining,
  onSetTraining,
  canSetSupervision,
  onSetSupervision,
  openDesk,
}: {
  item: { source: 'user' | 'people'; id: string; name: string; role?: string | null; needs_supervision?: boolean | null; read_only?: boolean | null; last_sign_in_at?: string | null }
  isSelf: boolean
  canSetTraining: boolean
  onSetTraining?: (userId: string, on: boolean) => void
  canSetSupervision: boolean
  onSetSupervision?: (userId: string, needsSupervision: boolean) => void
  openDesk?: (section: PersonDeskSectionId) => void
}) {
  if (item.source !== 'user') {
    return (
      <span style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
        <span style={{ ...CELL, width: ACCOUNT_CELL_WIDTHS.role + ACCOUNT_CELL_WIDTHS.signin + ACCOUNT_CELL_WIDTHS.training + ACCOUNT_CELL_WIDTHS.supervision + 18, color: 'var(--text-muted)', justifyContent: 'flex-end' }} title="A roster row with no app account — the ⋯ menu invites them">
          no login
        </span>
        <span style={{ ...CELL, width: ACCOUNT_CELL_WIDTHS.desk }}>
          {openDesk ? (
            <button type="button" onClick={() => openDesk('access')} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', textDecoration: 'underline' }}>
              Desk
            </button>
          ) : null}
        </span>
      </span>
    )
  }
  const needs = item.needs_supervision !== false
  return (
    <span style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
      <span style={{ ...CELL, width: ACCOUNT_CELL_WIDTHS.role }} title="Changing a role is the dev's, on the desk">
        {humanRoleLabel(item.role ?? '')}
      </span>
      <span style={{ ...CELL, width: ACCOUNT_CELL_WIDTHS.signin, color: 'var(--text-muted)' }}>{describeLastSeen(item.last_sign_in_at ?? null, Date.now())}</span>
      <span style={{ ...CELL, width: ACCOUNT_CELL_WIDTHS.training }}>
        <input
          type="checkbox"
          checked={Boolean(item.read_only)}
          disabled={!canSetTraining || isSelf || !onSetTraining}
          onChange={(e) => onSetTraining?.(item.id, e.target.checked)}
          aria-label={`Training mode (read-only): ${item.name}`}
          title={isSelf ? 'You cannot flag your own account' : canSetTraining ? 'Read-only: every write is blocked for them' : 'A dev, a controller or a pay-approved leader sets this'}
        />
      </span>
      <span style={{ ...CELL, width: ACCOUNT_CELL_WIDTHS.supervision }}>
        {hasSupervisionSwitch(item.role) ? (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: needs ? 'var(--text-amber-800)' : 'var(--text-green-800)' }} title={needs ? 'Needs supervision — not left to run a job alone' : 'Can run a job on their own'}>
            <input type="checkbox" checked={!needs} disabled={!canSetSupervision || isSelf || !onSetSupervision} onChange={(e) => onSetSupervision?.(item.id, !e.target.checked)} aria-label={`Can run a job: ${item.name}`} />
            {needs ? 'needs' : 'can run'}
          </label>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </span>
      <span style={{ ...CELL, width: ACCOUNT_CELL_WIDTHS.desk }}>
        {openDesk ? (
          <button type="button" onClick={() => openDesk('access')} title="Password, name, email, merge, archive — on their desk" style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', textDecoration: 'underline' }}>
            Desk
          </button>
        ) : null}
      </span>
    </span>
  )
}

export function UsersTabPayCells({ cells, userId, onOpenWorkday }: { cells: PayConfigCellsProps; userId: string | null; onOpenWorkday?: (args: { userId: string; payName: string }) => void }) {
  const c = payConfigRowOrEmpty(cells.payConfig, cells.n)
  const canWorkday = c.is_salary && userId && onOpenWorkday
  return (
    <span style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0, alignItems: 'center' }}>
      <PayConfigCells {...cells} />
      <span style={{ ...CELL, width: 88 }}>
        {canWorkday ? (
          <button type="button" onClick={() => onOpenWorkday({ userId, payName: cells.n })} title="The salaried 8-hour day: start time, split, weekends, today's override" style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', borderRadius: 4, padding: '0.1rem 0.45rem' }}>
            Workday…
          </button>
        ) : c.is_salary ? (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }} title="A workday template belongs to a login account">
            no login
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </span>
    </span>
  )
}

/** The salaried workday editor for one person — the desk's own modal, hosted by the Pay lens. */
export function WorkdayScheduleModal({ userId, payName, canEditPastDayOverrides, onClose }: { userId: string; payName: string; canEditPastDayOverrides: boolean; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Workday schedule" style={{ position: 'fixed', inset: 0, zIndex: DESK_EDITOR_Z, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(720px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: '1rem 1.1rem', boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{payName} · workday schedule</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }}>
            ×
          </button>
        </div>
        <SalaryWorkScheduleSettings userId={userId} userPayName={payName} canEditPastDayOverrides={canEditPastDayOverrides} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
          <button type="button" style={BTN_RED} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export type { PayConfigRow }
