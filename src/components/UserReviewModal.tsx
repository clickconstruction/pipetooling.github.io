import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useUserReviewModal } from '../contexts/UserReviewModalContext'
import {
  companyWeekStartSundayContaining,
  denverCalendarDayKey,
  getDefaultWeekRange,
  ymdAddDays,
} from '../utils/dateUtils'
import { UserDayScheduleSection } from './userReview/UserDayScheduleSection'
import { UserWeekScheduleSection } from './userReview/UserWeekScheduleSection'
import { UserMonthScheduleSection } from './userReview/UserMonthScheduleSection'
import { UserMercuryWindowSection } from './userReview/UserMercuryWindowSection'
import { UserReviewSwitchUserModal } from './userReview/UserReviewSwitchUserModal'
import { useUserReviewRoster } from '../hooks/useUserReviewRoster'
import { buildSwitchUserOptions } from '../lib/userReviewSwitchOptions'

const MODAL_Z = 1200
const TITLE_ID = 'user-review-modal-title'
const RANGE_STORAGE_KEY = 'user_review_modal_range_v1'
const PRINT_BODY_CLASS = 'printing-user-review'
const PRINT_SCOPE_CLASS = 'user-review-modal-print-scope'
const PRINT_STYLE_ID = 'user-review-modal-print-style'

const BANKING_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])
const SWITCH_SUBJECT_ROLES = new Set([
  'dev',
  'master_technician',
  'assistant',
  'superintendent',
  'controller',
])

const PRINT_STYLE_CSS = `
@media print {
  body.${PRINT_BODY_CLASS} > *:not(.${PRINT_SCOPE_CLASS}) { display: none !important; }
  body.${PRINT_BODY_CLASS} .${PRINT_SCOPE_CLASS} {
    position: static !important;
    inset: auto !important;
    z-index: auto !important;
    background: none !important;
    padding: 0 !important;
    display: block !important;
  }
  body.${PRINT_BODY_CLASS} .${PRINT_SCOPE_CLASS} > div {
    max-width: none !important;
    max-height: none !important;
    width: 100% !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
  body.${PRINT_BODY_CLASS} .user-review-modal-print-hide { display: none !important; }
}
`.trim()

type RangeMode = 'day' | 'week' | 'month'

const MONTH_WINDOW_DAYS = 30

function readRangeFromStorage(): RangeMode {
  if (typeof window === 'undefined') return 'day'
  try {
    const v = window.localStorage.getItem(RANGE_STORAGE_KEY)
    if (v === 'week') return 'week'
    if (v === 'month') return 'month'
    return 'day'
  } catch {
    return 'day'
  }
}

function writeRangeToStorage(mode: RangeMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RANGE_STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}

const toggleButtonStyle = (active: boolean): CSSProperties => ({
  padding: '0.2rem 0.55rem',
  fontSize: '0.75rem',
  border: '1px solid var(--border-strong)',
  background: active ? '#1d4ed8' : 'var(--surface)',
  color: active ? '#fff' : 'var(--text-700)',
  cursor: 'pointer',
  fontWeight: active ? 600 : 500,
})

const RANGE_TOGGLE_BUTTONS: ReadonlyArray<{ mode: RangeMode; label: string }> = [
  { mode: 'day', label: 'Day' },
  { mode: 'week', label: 'Week' },
  { mode: 'month', label: 'Month' },
]

function RangeToggle({ value, onChange }: { value: RangeMode; onChange: (v: RangeMode) => void }) {
  return (
    <div
      role="group"
      aria-label="Range mode"
      style={{
        display: 'inline-flex',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {RANGE_TOGGLE_BUTTONS.map((btn, i) => {
        const isFirst = i === 0
        const isLast = i === RANGE_TOGGLE_BUTTONS.length - 1
        const active = value === btn.mode
        return (
          <button
            key={btn.mode}
            type="button"
            onClick={() => onChange(btn.mode)}
            aria-pressed={active}
            style={{
              ...toggleButtonStyle(active),
              borderTopLeftRadius: isFirst ? 4 : 0,
              borderBottomLeftRadius: isFirst ? 4 : 0,
              borderTopRightRadius: isLast ? 4 : 0,
              borderBottomRightRadius: isLast ? 4 : 0,
              borderRight: isLast ? '1px solid var(--border-strong)' : 'none',
            }}
          >
            {btn.label}
          </button>
        )
      })}
    </div>
  )
}

export default function UserReviewModal() {
  const modal = useUserReviewModal()
  const { role } = useAuth()
  const payload = modal?.payload ?? null
  const isOpen = payload != null

  const [workDateYmd, setWorkDateYmd] = useState(() => denverCalendarDayKey(Date.now()))
  const [rangeMode, setRangeMode] = useState<RangeMode>(() => readRangeFromStorage())

  useEffect(() => {
    if (!payload) return
    setWorkDateYmd(payload.workDateYmd?.trim() || denverCalendarDayKey(Date.now()))
  }, [payload])

  const setRangeModePersisted = useCallback((mode: RangeMode) => {
    setRangeMode(mode)
    writeRangeToStorage(mode)
  }, [])

  const handleClose = useCallback(() => {
    modal?.close()
  }, [modal])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, handleClose])

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [isOpen])

  // Inject the print stylesheet once.
  useEffect(() => {
    if (!isOpen) return
    if (document.getElementById(PRINT_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = PRINT_STYLE_ID
    style.appendChild(document.createTextNode(PRINT_STYLE_CSS))
    document.head.appendChild(style)
  }, [isOpen])

  const printPendingRef = useRef(false)
  const handlePrint = useCallback(() => {
    if (printPendingRef.current) return
    printPendingRef.current = true
    document.body.classList.add(PRINT_BODY_CLASS)
    const onAfterPrint = () => {
      document.body.classList.remove(PRINT_BODY_CLASS)
      printPendingRef.current = false
      window.removeEventListener('afterprint', onAfterPrint)
    }
    window.addEventListener('afterprint', onAfterPrint)
    window.print()
  }, [])

  useEffect(() => {
    if (!isOpen) {
      // Defensive: if the modal closes mid-print, drop the body class.
      document.body.classList.remove(PRINT_BODY_CLASS)
    }
  }, [isOpen])

  const showTransactionsSection = role != null && BANKING_ROLES.has(role)
  const canSwitchUser = role != null && SWITCH_SUBJECT_ROLES.has(role)

  const [switchOpen, setSwitchOpen] = useState(false)

  // Always reset the switcher when the parent modal closes or the subject
  // changes (re-opening it after picking a user) so a stale dialog doesn't
  // linger over the new subject.
  useEffect(() => {
    if (!isOpen) setSwitchOpen(false)
  }, [isOpen])
  useEffect(() => {
    setSwitchOpen(false)
  }, [payload?.userId])

  const { roster: switchRoster, loading: switchLoading, error: switchError } =
    useUserReviewRoster({
      enabled: switchOpen && canSwitchUser,
      currentUserId: payload?.userId ?? '',
      currentDisplayName: payload?.displayName ?? '',
    })
  const switchOptions = useMemo(
    () => buildSwitchUserOptions(switchRoster, payload?.userId ?? ''),
    [switchRoster, payload?.userId],
  )

  const handleOpenSwitchUser = useCallback(() => {
    if (!canSwitchUser) return
    setSwitchOpen(true)
  }, [canSwitchUser])
  const handleCloseSwitchUser = useCallback(() => setSwitchOpen(false), [])
  const handlePickSwitchUser = useCallback(
    ({ userId, displayName }: { userId: string; displayName: string }) => {
      setSwitchOpen(false)
      // Re-open the parent modal for the new subject while preserving the
      // current anchor day. RangeMode is local state and is intentionally
      // not threaded through `open` so toggling Day/Week/Month survives.
      modal?.open({ userId, displayName, workDateYmd })
    },
    [modal, workDateYmd],
  )

  const switchUserHandler = canSwitchUser ? handleOpenSwitchUser : undefined

  // Week mode anchor: the company-week Sunday containing workDateYmd.
  const weekStartYmd = useMemo(
    () => companyWeekStartSundayContaining(workDateYmd) ?? getDefaultWeekRange().start,
    [workDateYmd],
  )
  const weekEndYmd = useMemo(() => ymdAddDays(weekStartYmd, 6), [weekStartYmd])

  // Month mode anchor: rolling MONTH_WINDOW_DAYS-day window ending on workDateYmd.
  const monthEndYmd = workDateYmd
  const monthStartYmd = useMemo(
    () => ymdAddDays(workDateYmd, -(MONTH_WINDOW_DAYS - 1)),
    [workDateYmd],
  )

  // Snap workDateYmd to a day inside the new week when chevroning weeks, so toggling back
  // to Day mode lands the user on the right week.
  const handleWeekStartYmdChange = useCallback((nextWeekStart: string) => {
    setWorkDateYmd(nextWeekStart)
  }, [])

  const txStartYmd =
    rangeMode === 'day'
      ? workDateYmd
      : rangeMode === 'week'
        ? weekStartYmd
        : monthStartYmd
  const txEndYmd =
    rangeMode === 'day'
      ? workDateYmd
      : rangeMode === 'week'
        ? weekEndYmd
        : monthEndYmd

  const transactionsSlot = useMemo(() => {
    if (!isOpen || !payload || !showTransactionsSection) return null
    return (
      <UserMercuryWindowSection
        userId={payload.userId}
        displayName={payload.displayName}
        startYmd={txStartYmd}
        endYmd={txEndYmd}
      />
    )
  }, [isOpen, payload, showTransactionsSection, txStartYmd, txEndYmd])

  const rangeToggleNode = (
    <div
      className="user-review-modal-print-hide"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}
    >
      <RangeToggle value={rangeMode} onChange={setRangeModePersisted} />
      <button
        type="button"
        onClick={handlePrint}
        title="Print this view"
        aria-label="Print"
        style={{
          padding: '0.2rem 0.55rem',
          fontSize: '0.75rem',
          border: '1px solid var(--border-strong)',
          borderRadius: 4,
          background: 'var(--surface)',
          color: 'var(--text-700)',
          cursor: 'pointer',
        }}
      >
        Print
      </button>
    </div>
  )

  if (!isOpen || !modal || !payload) return null

  return (
    <div
      className={PRINT_SCOPE_CLASS}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: MODAL_Z,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 'min(100%, 48rem)',
          width: '100%',
          maxHeight: 'min(90vh, 800px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {rangeMode === 'day' ? (
          <UserDayScheduleSection
            userId={payload.userId}
            displayName={payload.displayName}
            workDateYmd={workDateYmd}
            onWorkDateYmdChange={setWorkDateYmd}
            onClose={handleClose}
            titleId={TITLE_ID}
            headerExtras={rangeToggleNode}
            belowScheduleSlot={transactionsSlot}
            onOpenSwitchUser={switchUserHandler}
            canSwitchUser={canSwitchUser}
          />
        ) : rangeMode === 'week' ? (
          <UserWeekScheduleSection
            userId={payload.userId}
            displayName={payload.displayName}
            weekStartYmd={weekStartYmd}
            onWeekStartYmdChange={handleWeekStartYmdChange}
            onClose={handleClose}
            titleId={TITLE_ID}
            headerExtras={rangeToggleNode}
            belowScheduleSlot={transactionsSlot}
            onOpenSwitchUser={switchUserHandler}
            canSwitchUser={canSwitchUser}
          />
        ) : (
          <UserMonthScheduleSection
            userId={payload.userId}
            displayName={payload.displayName}
            anchorYmd={workDateYmd}
            onAnchorYmdChange={setWorkDateYmd}
            onClose={handleClose}
            titleId={TITLE_ID}
            headerExtras={rangeToggleNode}
            belowScheduleSlot={transactionsSlot}
            onOpenSwitchUser={switchUserHandler}
            canSwitchUser={canSwitchUser}
          />
        )}
      </div>

      <UserReviewSwitchUserModal
        open={switchOpen}
        onClose={handleCloseSwitchUser}
        currentDisplayName={payload.displayName}
        options={switchOptions}
        loading={switchLoading}
        error={switchError}
        onPick={handlePickSwitchUser}
      />
    </div>
  )
}
