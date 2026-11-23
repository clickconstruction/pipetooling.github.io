/**
 * The rows at the top of the gear menu under the new phone layout (`lib/phoneLayout/phoneBar.ts`): the presses
 * the phone's one-row top bar no longer draws as icons. Each is the old press with its name beside its mark, in
 * the old row's order, and each does what its press did: Tell the dev opens the same box, Task Dispatch, Ask
 * estimating and Task open the same windows, Statement, Customers and People open the same pages.
 *
 * The rows are the menu's own children, before its first label, where the wrench's row has always sat.
 */
import type { CSSProperties, ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import CustomerContactCardIcon from '../icons/CustomerContactCardIcon'
import { PartnerStatementNavLink } from '../partner/PartnerStatementNavLink'
import { PeopleNavIcon } from './NavRowMenuRows'
import { useUnreadDevAnswers } from '../../hooks/useUnreadDevAnswers'
import { HEADER_ASK_ESTIMATING_LABEL } from '../../lib/headerTaskDispatchEstimatorEligible'
import { DESK_MARKS } from '../../lib/messages/deskMarks'
import { PHONE_BAR_PRESS_NAMES, PHONE_BAR_PRESS_PX, type PhoneBarPress } from '../../lib/phoneLayout/phoneBar'
import { requestTellTheDev } from '../../lib/tellTheDev/openBox'

const ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  minHeight: PHONE_BAR_PRESS_PX,
  padding: '0.4rem 1rem',
  textDecoration: 'none',
  color: 'inherit',
  borderBottom: '1px solid var(--chrome-border)',
  boxSizing: 'border-box',
  whiteSpace: 'nowrap',
}

// `border` first: a key keeps its first place in a style object, so the row's own line would be reset after it.
const ROW_BUTTON: CSSProperties = { border: 'none', ...ROW, textAlign: 'left', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }

/** The mark a coloured press wore in the row, kept on its fill so the row still reads as that press. */
function Mark({ fill, ink, children }: { fill: string; ink: string; children: ReactNode }) {
  return (
    <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 5, background: fill, color: ink, flexShrink: 0 }}>
      {children}
    </span>
  )
}

/** A plain mark's box, so the names of plain rows and coloured rows start on one line. */
function Plain({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0 }}>
      {children}
    </span>
  )
}

const TASK_CHECK_PATH =
  'M530.8 134.1C545.1 144.5 548.3 164.5 537.9 178.8L281.9 530.8C276.4 538.4 267.9 543.1 258.5 543.9C249.1 544.7 240 541.2 233.4 534.6L105.4 406.6C92.9 394.1 92.9 373.8 105.4 361.3C117.9 348.8 138.2 348.8 150.7 361.3L252.2 462.8L486.2 141.1C496.6 126.8 516.6 123.6 530.9 134z'

type Props = {
  /** The presses that left the top bar, in the old row's order (`phoneBarPlan().gearRows`). */
  rows: readonly PhoneBarPress[]
  /** Closes the gear menu. Every row closes it, as a row of the menu does. */
  onClose: () => void
  onTaskDispatch: () => void
  onAskEstimating: () => void
  onTask: () => void
}

export function PhoneBarGearRows({ rows, onClose, onTaskDispatch, onAskEstimating, onTask }: Props) {
  const unread = useUnreadDevAnswers()
  const linkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({ ...ROW, ...(isActive && { fontWeight: 600 }) })

  const draw = (press: PhoneBarPress): ReactNode => {
    switch (press) {
      case 'statement':
        return <PartnerStatementNavLink key={press} variant="row" style={linkStyle} onClick={onClose} />
      case 'tell-the-dev':
        return (
          <button
            key={press}
            type="button"
            data-phone-bar-row={press}
            title={unread > 0 ? 'The dev answered your note' : 'Tell the dev about this page'}
            aria-label={unread > 0 ? 'Tell the dev. An answer is waiting.' : 'Tell the dev'}
            aria-haspopup="dialog"
            // The box reads the page inside the press, so the row asks before the menu closes.
            onClick={() => {
              requestTellTheDev({ door: 'header' })
              onClose()
            }}
            style={ROW_BUTTON}
          >
            <Plain>
              <Wrench size={20} strokeWidth={2.25} aria-hidden />
            </Plain>
            {PHONE_BAR_PRESS_NAMES[press]}
            {unread > 0 ? <span aria-hidden style={{ marginLeft: 'auto', width: 10, height: 10, borderRadius: 999, background: '#22c55e', flexShrink: 0 }} /> : null}
          </button>
        )
      case 'task-dispatch':
        return (
          <button key={press} type="button" data-phone-bar-row={press} title="Task Dispatch" aria-label="Task Dispatch" onClick={() => { onTaskDispatch(); onClose() }} style={ROW_BUTTON}>
            <Mark fill={DESK_MARKS.dispatch.fill} ink={DESK_MARKS.dispatch.ink}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox={DESK_MARKS.dispatch.icon.viewBox} width={17} height={17} fill="currentColor" aria-hidden="true">
                <path d={DESK_MARKS.dispatch.icon.path} />
              </svg>
            </Mark>
            {PHONE_BAR_PRESS_NAMES[press]}
          </button>
        )
      case 'ask-estimating':
        return (
          <button key={press} type="button" data-phone-bar-row={press} title={HEADER_ASK_ESTIMATING_LABEL} aria-label={HEADER_ASK_ESTIMATING_LABEL} onClick={() => { onAskEstimating(); onClose() }} style={ROW_BUTTON}>
            <Mark fill={DESK_MARKS.estimating.fill} ink={DESK_MARKS.estimating.ink}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox={DESK_MARKS.estimating.icon.viewBox} width={17} height={17} fill="currentColor" aria-hidden="true">
                <path d={DESK_MARKS.estimating.icon.path} />
              </svg>
            </Mark>
            {HEADER_ASK_ESTIMATING_LABEL}
          </button>
        )
      case 'task':
        return (
          <button key={press} type="button" data-phone-bar-row={press} title="Task" aria-label="Task" onClick={() => { onTask(); onClose() }} style={ROW_BUTTON}>
            <Mark fill="#2563eb" ink="white">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={17} height={17} fill="currentColor" aria-hidden="true">
                <path d={TASK_CHECK_PATH} />
              </svg>
            </Mark>
            {PHONE_BAR_PRESS_NAMES[press]}
          </button>
        )
      case 'customers':
        return (
          <NavLink key={press} to="/customers" data-phone-bar-row={press} onClick={onClose} style={linkStyle} title="Customers" aria-label="Customers">
            <Plain>
              <CustomerContactCardIcon size={20} />
            </Plain>
            {PHONE_BAR_PRESS_NAMES[press]}
          </NavLink>
        )
      case 'people':
        return (
          <NavLink key={press} to="/people" data-phone-bar-row={press} onClick={onClose} style={linkStyle} title="People" aria-label="People">
            <Plain>
              <PeopleNavIcon />
            </Plain>
            {PHONE_BAR_PRESS_NAMES[press]}
          </NavLink>
        )
      default:
        // The menu, home, Search, the phone, Bid and the gear never leave the bar for the menu.
        return null
    }
  }

  return <>{rows.map(draw)}</>
}
