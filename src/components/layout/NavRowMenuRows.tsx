/**
 * The gear menu's rows for the presses the phone's header had no room for (`lib/navRowFit.ts`, the owner's ask
 * of 2026-11-18: the header is one line, and what does not fit goes into the gear menu). Each row does what its
 * press did: Tell the dev opens the same box, People and Customers open the same pages.
 */
import type { CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import CustomerContactCardIcon from '../icons/CustomerContactCardIcon'
import { useUnreadDevAnswers } from '../../hooks/useUnreadDevAnswers'
import { requestTellTheDev } from '../../lib/tellTheDev/openBox'
import type { NavRowPress } from '../../lib/navRowFit'

/** The people press's mark, on the row and in the menu. */
export function PeopleNavIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M320 80C377.4 80 424 126.6 424 184C424 241.4 377.4 288 320 288C262.6 288 216 241.4 216 184C216 126.6 262.6 80 320 80zM96 152C135.8 152 168 184.2 168 224C168 263.8 135.8 296 96 296C56.2 296 24 263.8 24 224C24 184.2 56.2 152 96 152zM0 480C0 409.3 57.3 352 128 352C140.8 352 153.2 353.9 164.9 357.4C132 394.2 112 442.8 112 496L112 512C112 523.4 114.4 534.2 118.7 544L32 544C14.3 544 0 529.7 0 512L0 480zM521.3 544C525.6 534.2 528 523.4 528 512L528 496C528 442.8 508 394.2 475.1 357.4C486.8 353.9 499.2 352 512 352C582.7 352 640 409.3 640 480L640 512C640 529.7 625.7 544 608 544L521.3 544zM472 224C472 184.2 504.2 152 544 152C583.8 152 616 184.2 616 224C616 263.8 583.8 296 544 296C504.2 296 472 263.8 472 224zM160 496C160 407.6 231.6 336 320 336C408.4 336 480 407.6 480 496L480 512C480 529.7 465.7 544 448 544L192 544C174.3 544 160 529.7 160 512L160 496z" />
    </svg>
  )
}

const ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.5rem 1rem',
  textDecoration: 'none',
  color: 'inherit',
  borderBottom: '1px solid var(--chrome-border)',
  boxSizing: 'border-box',
}

/** The green dot of an unread answer, as the wrench wears it. */
function AnswerMark({ style }: { style?: CSSProperties }) {
  return <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: '#22c55e', flexShrink: 0, ...style }} />
}

/**
 * The wrench as the gear menu's first row. The box reads the page inside the press, so the row asks before the
 * menu closes. The door is the header's, as the press on the row was.
 */
export function TellTheDevMenuRow({ inMenu, onClose }: { inMenu: readonly NavRowPress[]; onClose: () => void }) {
  const unread = useUnreadDevAnswers()
  if (!inMenu.includes('wrench')) return null
  return (
    <button
      type="button"
      title={unread > 0 ? 'The dev answered your note' : 'Tell the dev about this page'}
      aria-label={unread > 0 ? 'Tell the dev. An answer is waiting.' : 'Tell the dev'}
      aria-haspopup="dialog"
      onClick={() => {
        requestTellTheDev({ door: 'header' })
        onClose()
      }}
      // `border` first: a key keeps its first place in a style object, so the row's own line would be reset after it.
      style={{ border: 'none', ...ROW, width: '100%', textAlign: 'left', background: 'none', cursor: 'pointer', fontSize: 'inherit' }}
    >
      <Wrench size={20} strokeWidth={2.25} aria-hidden />
      Tell the dev
      {unread > 0 ? <AnswerMark style={{ marginLeft: 'auto' }} /> : null}
    </button>
  )
}

/** The gear wears the answer's dot while the wrench is one of its rows, as it wears the Checklist's count. */
export function GearAnswerDot({ inMenu }: { inMenu: readonly NavRowPress[] }) {
  const unread = useUnreadDevAnswers()
  if (!inMenu.includes('wrench') || unread <= 0) return null
  return <AnswerMark style={{ position: 'absolute', top: 3, left: 3, border: '2px solid var(--chrome-bg)', boxSizing: 'border-box', pointerEvents: 'none' }} />
}

/** The icon links that left the row, in the row's own order: Customers, then People. */
export function NavRowLinkMenuRows({ inMenu, onClose }: { inMenu: readonly NavRowPress[]; onClose: () => void }) {
  const style = ({ isActive }: { isActive: boolean }): CSSProperties => ({ ...ROW, ...(isActive && { fontWeight: 600 }) })
  return (
    <>
      {inMenu.includes('customers') && (
        <NavLink to="/customers" onClick={onClose} style={style} title="Customers" aria-label="Customers">
          <CustomerContactCardIcon size={20} />
          Customers
        </NavLink>
      )}
      {inMenu.includes('people') && (
        <NavLink to="/people" onClick={onClose} style={style} title="People" aria-label="People">
          <PeopleNavIcon />
          People
        </NavLink>
      )}
    </>
  )
}
