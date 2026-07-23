import type { CSSProperties, ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDispatchInbox } from '../../hooks/useDispatchInbox'
import { useEstimatorInbox } from '../../hooks/useEstimatorInbox'
import { useOnScreenKeyboardOpen } from '../../hooks/useOnScreenKeyboardOpen'

export const DISPATCH_MODE_FOOTER_HEIGHT_PX = 60

type TabKey = 'dashboard' | 'schedule' | 'inbox' | 'customers' | 'po'

type TabDef = {
  key: TabKey
  label: string
  to: string
  icon: ReactNode
}

function svg(path: string): ReactNode {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

const DISPATCH_TABS: TabDef[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    to: '/dispatch-mode',
    // gauge
    icon: svg(
      'M320 96C178.6 96 64 210.6 64 352C64 402.7 78.8 450 104.2 489.7C110.9 500.1 122.7 506 135.1 506L504.9 506C517.3 506 529.1 500.1 535.8 489.7C561.2 450 576 402.7 576 352C576 210.6 461.4 96 320 96zM320 160C333.3 160 344 170.7 344 184C344 197.3 333.3 208 320 208C306.7 208 296 197.3 296 184C296 170.7 306.7 160 320 160zM160 376C146.7 376 136 365.3 136 352C136 338.7 146.7 328 160 328C173.3 328 184 338.7 184 352C184 365.3 173.3 376 160 376zM206.1 261.9C196.7 271.3 181.5 271.3 172.2 261.9C162.8 252.5 162.8 237.3 172.2 228C181.6 218.7 196.8 218.6 206.1 228C215.4 237.4 215.5 252.6 206.1 261.9zM368.7 330.6C381.3 348.4 379.7 373.2 363.7 389.2C345.7 407.2 316.5 407.2 298.5 389.2C282.5 373.2 280.8 348.4 293.5 330.6L347 255.6C350.3 251 355.6 248.3 361.2 248.3C370.9 248.3 378.7 256.1 378.7 265.8L378.7 330.6L368.7 330.6zM467.8 261.9C458.4 271.3 443.2 271.3 433.9 261.9C424.5 252.5 424.5 237.3 433.9 228C443.3 218.7 458.5 218.6 467.8 228C477.1 237.4 477.2 252.6 467.8 261.9zM480 376C466.7 376 456 365.3 456 352C456 338.7 466.7 328 480 328C493.3 328 504 338.7 504 352C504 365.3 493.3 376 480 376z',
    ),
  },
  {
    key: 'schedule',
    label: 'Schedule',
    to: '/dispatch-mode/schedule',
    // calendar
    icon: svg(
      'M224 64C206.3 64 192 78.3 192 96L192 128L160 128C124.7 128 96 156.7 96 192L96 240L544 240L544 192C544 156.7 515.3 128 480 128L448 128L448 96C448 78.3 433.7 64 416 64C398.3 64 384 78.3 384 96L384 128L256 128L256 96C256 78.3 241.7 64 224 64zM96 288L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 288L96 288z',
    ),
  },
  {
    key: 'inbox',
    label: 'Inbox',
    to: '/dispatch-mode/inbox',
    // inbox tray
    icon: svg(
      'M128 96C92.7 96 64 124.7 64 160L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 160C576 124.7 547.3 96 512 96L128 96zM128 160L512 160L512 352L432 352C418.7 352 408.4 362.9 403 375C393.9 395.7 373.2 416 320 416C266.8 416 246.1 395.7 237 375C231.6 362.9 221.3 352 208 352L128 352L128 160z',
    ),
  },
  {
    key: 'customers',
    label: 'Customers',
    to: '/dispatch-mode/customers',
    // person
    icon: svg(
      'M320 320C390.7 320 448 262.7 448 192C448 121.3 390.7 64 320 64C249.3 64 192 121.3 192 192C192 262.7 249.3 320 320 320zM290.3 368C191.8 368 112 447.8 112 546.3C112 562.7 125.3 576 141.7 576L498.3 576C514.7 576 528 562.7 528 546.3C528 447.8 448.2 368 349.7 368L290.3 368z',
    ),
  },
]

/** Gear-menu opt-in (Dispatch Mode only): mint material PO codes on the fly. Slots last. */
const PO_TAB: TabDef = {
  key: 'po',
  label: 'PO',
  to: '/dispatch-mode/po',
  // receipt
  icon: svg(
    'M168 64C137.1 64 112 89.1 112 120L112 552C112 561.1 117.1 569.4 125.3 573.5C133.5 577.6 143.2 576.6 150.4 571.2L197.4 536L262.6 571.2C270.7 577.6 282.2 577.6 290.3 571.2L342.6 536L400.6 571.2C408.7 577.6 420.2 577.6 428.3 571.2L475.3 536L489.6 571.2C496.8 576.6 506.5 577.6 514.7 573.5C522.9 569.4 528 561.1 528 552L528 120C528 89.1 502.9 64 472 64L168 64zM192 160L448 160C461.3 160 472 170.7 472 184C472 197.3 461.3 208 448 208L192 208C178.7 208 168 197.3 168 184C168 170.7 178.7 160 192 160zM192 256L448 256C461.3 256 472 266.7 472 280C472 293.3 461.3 304 448 304L192 304C178.7 304 168 293.3 168 280C168 266.7 178.7 256 192 256zM192 352L352 352C365.3 352 376 362.7 376 376C376 389.3 365.3 400 352 400L192 400C178.7 400 168 389.3 168 376C168 362.7 178.7 352 192 352z',
  ),
}

/** Job Mode: the tech's own four tabs — Dashboard is the Job Mode card on /dashboard. */
const JOB_TABS: TabDef[] = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: DISPATCH_TABS[0]!.icon },
  { key: 'schedule', label: 'Schedule', to: '/job-mode/schedule', icon: DISPATCH_TABS[1]!.icon },
  { key: 'inbox', label: 'Inbox', to: '/job-mode/inbox', icon: DISPATCH_TABS[2]!.icon },
  { key: 'customers', label: 'Customers', to: '/job-mode/customers', icon: DISPATCH_TABS[3]!.icon },
]

export type ModeFooterVariant = 'dispatch' | 'job'

function activeTabForPath(pathname: string, variant: ModeFooterVariant): TabKey | null {
  if (variant === 'dispatch' && pathname.startsWith('/dispatch-mode/po')) return 'po'
  if (variant === 'job') {
    if (pathname === '/dashboard') return 'dashboard'
    if (pathname.startsWith('/job-mode/schedule')) return 'schedule'
    if (pathname.startsWith('/job-mode/inbox')) return 'inbox'
    if (pathname.startsWith('/job-mode/customers')) return 'customers'
    return null
  }
  if (pathname === '/dispatch-mode') return 'dashboard'
  if (pathname.startsWith('/dispatch-mode/schedule')) return 'schedule'
  if (pathname.startsWith('/dispatch-mode/inbox')) return 'inbox'
  if (pathname.startsWith('/dispatch-mode/customers')) return 'customers'
  // No More tab (v2.964): outside the dispatch tabs nothing is active — the top nav covers the rest of the app.
  return null
}

const tabBtnBase: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  padding: '0.4rem 0.15rem',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '0.6875rem',
  fontWeight: 600,
  lineHeight: 1,
}

/**
 * The Dispatch Mode bottom tab bar. Rendered by Layout on every page while the
 * mode is on; on routes outside the /dispatch-mode tabs no tab is active — the
 * regular top nav keeps the whole app reachable with the bar present.
 */
export function DispatchModeFooter({
  inboxBadgeCount = 0,
  variant = 'dispatch',
  showPoTab = false,
}: {
  inboxBadgeCount?: number
  variant?: ModeFooterVariant
  /** Gear-menu opt-in: adds the PO tab (dispatch variant only). */
  showPoTab?: boolean
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const keyboardOpen = useOnScreenKeyboardOpen()
  const active = activeTabForPath(location.pathname, variant)
  const TABS =
    variant === 'job'
      ? JOB_TABS
      : showPoTab
        ? [...DISPATCH_TABS, PO_TAB]
        : DISPATCH_TABS

  return (
    <nav
      aria-label={variant === 'job' ? 'Job Mode tabs' : 'Dispatch Mode tabs'}
      aria-hidden={keyboardOpen || undefined}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'stretch',
        minHeight: DISPATCH_MODE_FOOTER_HEIGHT_PX,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--chrome-bg)',
        borderTop: '1px solid var(--chrome-border)',
        // Slide out of view while the mobile keyboard is up: position: fixed
        // anchors to the layout viewport, so the bar would otherwise float
        // mid-screen (iOS pans) or ride on top of the keyboard (Android).
        transform: keyboardOpen ? 'translateY(calc(100% + 1px))' : undefined,
        transition: 'transform 0.15s ease',
        pointerEvents: keyboardOpen ? 'none' : undefined,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => navigate(tab.to)}
            style={{
              ...tabBtnBase,
              color: isActive ? 'var(--text-link)' : 'var(--text-muted)',
            }}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              {tab.icon}
              {tab.key === 'inbox' && inboxBadgeCount > 0 ? (
                <span
                  aria-label={`${inboxBadgeCount} unread`}
                  style={{
                    position: 'absolute',
                    top: -5,
                    right: -9,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: '#dc2626',
                    color: '#fff',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  {inboxBadgeCount > 99 ? '99+' : inboxBadgeCount}
                </span>
              ) : null}
            </span>
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

/**
 * Footer + live Inbox badge (open dispatch + estimator requests). Mounted only
 * while Dispatch Mode is on, so the inbox engines don't run for everyone.
 */
export function DispatchModeFooterLive({ showPoTab = false }: { showPoTab?: boolean }) {
  const dispatchInbox = useDispatchInbox()
  const estimatorInbox = useEstimatorInbox()
  const count =
    (dispatchInbox.dispatchInboxEligible ? dispatchInbox.dispatchRequests.length : 0) +
    (estimatorInbox.estimatorInboxEligible ? estimatorInbox.estimatorRequests.length : 0)
  return <DispatchModeFooter inboxBadgeCount={count} showPoTab={showPoTab} />
}
