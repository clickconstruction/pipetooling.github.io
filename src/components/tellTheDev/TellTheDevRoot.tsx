/**
 * Tell the dev (punch list #380): the wrench and its box, mounted once in the shell.
 *
 * At a desk the wrench floats bottom left, clear of the section dock's stub bottom right, and the
 * box opens above it with the page still in view. On a phone nothing floats, since Job Mode's
 * bars own the bottom and toasts the top right: the header carries the wrench and the box is a
 * sheet. Every door asks through `requestTellTheDev`, and the page is read inside that press,
 * before a menu or a window can close under it.
 *
 * Fix Mode off draws nothing and hears nothing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useIsDigitalTwin } from '../../hooks/useIsDigitalTwin'
import { isImpersonationSessionActive } from '../../lib/impersonationSession'
import { appActivityPageKey, formatAppActivityPageLabel } from '../../lib/appActivityPage'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { formatErrorMessage } from '../../utils/errorHandling'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { buildNoteContext, noteContextLines, notePagePath, type NoteContext, type NoteDoor } from '../../lib/tellTheDev/noteContext'
import { readWrenchOpened, writeWrenchOpened } from '../../lib/tellTheDev/fixMode'
import { TELL_THE_DEV_OPEN_CONTROL, TELL_THE_DEV_OPEN_EVENT, TELL_THE_DEV_SENT_CONTROL, requestTellTheDev, setTellTheDevListening, type TellTheDevOpenRequest } from '../../lib/tellTheDev/openBox'
import { TELL_THE_DEV_MARK, openWindowTitle } from '../../lib/tellTheDev/readPage'
import { sendDevNote } from '../../lib/tellTheDev/sendNote'
import { troubleMemory } from '../../lib/tellTheDev/trouble'
import type { NoteKind } from '../../lib/tellTheDev/starts'
import { TellTheDevBox } from './TellTheDevBox'
import { TellTheDevButton } from './TellTheDevButton'

/** Above every window, so a note can be written about the one that is open; below toasts and the update prompt. */
const WRENCH_Z = 8990

type Snapshot = { pageKey: string; pagePath: string; context: NoteContext }

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function TellTheDevRoot({ isMobile, modes, fixMode }: { isMobile: boolean; modes: readonly string[]; fixMode: boolean }) {
  const { user: authUser, role, profileName, readOnly } = useAuth()
  const isTwin = useIsDigitalTwin()
  const location = useLocation()
  const userId = authUser?.id ?? null

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [kind, setKind] = useState<NoteKind>('want')
  const [typed, setTyped] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [openedOnce, setOpenedOnce] = useState<boolean>(() => readWrenchOpened(localStorageOrNull(), userId))

  const lastUserId = useRef(userId)
  useEffect(() => {
    setOpenedOnce(readWrenchOpened(localStorageOrNull(), userId))
    if (lastUserId.current === userId) return
    lastUserId.current = userId
    // One person's error lines and half-written words never ride on the next person's note.
    troubleMemory.clear()
    setSnapshot(null)
    setTyped('')
  }, [userId])

  // The press reads these, so they are kept where a listener can see the latest.
  const live = useRef({ location, role, readOnly, isTwin, isMobile, modes, appVersion })
  live.current = { location, role, readOnly, isTwin, isMobile, modes, appVersion }

  const open = useCallback(
    (request: TellTheDevOpenRequest) => {
      if (!userId) return
      const now = Date.now()
      const at = live.current
      const pageKey = appActivityPageKey(at.location.pathname, at.location.search)
      const context = buildNoteContext(
        {
          pageLabel: formatAppActivityPageLabel(pageKey),
          windowTitle: openWindowTitle(document),
          role: at.role ?? null,
          training: at.readOnly === true,
          twin: at.isTwin === true,
          viewingAs: isImpersonationSessionActive(),
          isPhone: at.isMobile,
          width: window.innerWidth,
          height: window.innerHeight,
          modes: at.modes,
          appVersion: at.appVersion,
          door: request.door,
          trouble: troubleMemory.recent(now),
        },
        now,
      )
      setSnapshot({ pageKey, pagePath: notePagePath(at.location.pathname, at.location.search), context })
      if (request.kind) setKind(request.kind)
      setSent(false)
      setError(null)
      recordNavClick(userId, at.role ?? null, TELL_THE_DEV_OPEN_CONTROL, `/${request.door}`)
      if (!readWrenchOpened(localStorageOrNull(), userId)) {
        writeWrenchOpened(localStorageOrNull(), userId)
        setOpenedOnce(true)
      }
    },
    [userId],
  )

  useEffect(() => {
    if (!fixMode || !userId) return
    const onRequest = (e: Event) => open((e as CustomEvent<TellTheDevOpenRequest>).detail ?? { door: 'wrench' })
    window.addEventListener(TELL_THE_DEV_OPEN_EVENT, onRequest)
    // The doors drawn outside the shell show only while a box is here to answer them.
    setTellTheDevListening(true)
    return () => {
      setTellTheDevListening(false)
      window.removeEventListener(TELL_THE_DEV_OPEN_EVENT, onRequest)
    }
  }, [fixMode, userId, open])

  // The version is the newest release note's. It is read when the box first opens, never at boot.
  const boxOpen = snapshot != null
  useEffect(() => {
    if (!boxOpen || appVersion) return
    let alive = true
    void import('../../content/releaseNotes')
      .then((m) => {
        if (alive) setAppVersion(m.RELEASE_NOTES[0]?.version ?? null)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [boxOpen, appVersion])

  const context = useMemo(() => (snapshot ? { ...snapshot.context, app_version: snapshot.context.app_version ?? appVersion } : null), [snapshot, appVersion])
  const lines = useMemo(() => (context ? noteContextLines(context, profileName ?? null) : []), [context, profileName])

  const close = useCallback(() => setSnapshot(null), [])

  const send = useCallback(async () => {
    if (!userId || !snapshot || !context || sending) return
    setSending(true)
    setError(null)
    try {
      await sendDevNote({ fromUserId: userId, kind, typed, pageKey: snapshot.pageKey, pagePath: snapshot.pagePath, context })
      recordNavClick(userId, role ?? null, TELL_THE_DEV_SENT_CONTROL, `/${kind}`)
      setTyped('')
      setSent(true)
    } catch (err) {
      setError(formatErrorMessage(err, 'Could not send the note.'))
    } finally {
      setSending(false)
    }
  }, [userId, snapshot, context, sending, kind, typed, role])

  if (!fixMode || !userId) return null

  const box = (
    <TellTheDevBox
      kind={kind}
      onKind={setKind}
      typed={typed}
      onTyped={setTyped}
      lines={lines}
      sending={sending}
      sent={sent}
      onSendAnother={() => {
        setSent(false)
        setError(null)
      }}
      error={error}
      onSend={() => void send()}
    />
  )

  const mark = { [TELL_THE_DEV_MARK]: '' }

  return (
    <>
      <style>{'@media print { [data-tell-the-dev] { display: none !important; } }'}</style>
      {!isMobile && (
        <button
          {...mark}
          type="button"
          title="Tell the dev about this page"
          aria-label="Tell the dev"
          aria-expanded={boxOpen}
          onClick={() => (boxOpen ? close() : requestTellTheDev({ door: 'wrench' }))}
          style={{
            position: 'fixed',
            left: 14,
            bottom: 'calc(var(--app-bottom-chrome, 0px) + 14px)',
            zIndex: WRENCH_Z,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 44,
            minWidth: 44,
            justifyContent: 'center',
            padding: openedOnce ? 0 : '0 16px 0 12px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--text-strong)',
            color: 'var(--surface)',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(20, 30, 50, 0.25)',
          }}
        >
          <Wrench size={20} strokeWidth={2.25} aria-hidden />
          {!openedOnce && <span>Tell the dev</span>}
        </button>
      )}
      {boxOpen && !isMobile && (
        <div
          {...mark}
          role="dialog"
          aria-label="Tell the dev"
          onKeyDown={(e) => {
            // The box takes its own Escape, so a window open under it stays open.
            if (e.key !== 'Escape') return
            e.preventDefault()
            e.stopPropagation()
            close()
          }}
          style={{
            position: 'fixed',
            left: 14,
            bottom: 'calc(var(--app-bottom-chrome, 0px) + 68px)',
            zIndex: WRENCH_Z + 1,
            width: 384,
            maxWidth: 'calc(100vw - 28px)',
            maxHeight: 'calc(100vh - var(--app-bottom-chrome, 0px) - 96px)',
            overflowY: 'auto',
            boxSizing: 'border-box',
            padding: '0.85rem',
            background: 'var(--surface)',
            color: 'var(--text-base)',
            border: '1px solid var(--chrome-border)',
            borderRadius: 12,
            boxShadow: '0 12px 34px rgba(20, 30, 50, 0.22)',
            whiteSpace: 'normal',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Tell the dev</h2>
            <button type="button" onClick={close} aria-label="Close" title="Close" style={{ background: 'none', border: 'none', padding: '0.15rem 0.35rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1 }}>
              ✕
            </button>
          </div>
          {box}
        </div>
      )}
      {boxOpen && isMobile && (
        <div {...mark}>
          <ResponsiveModalShell title="Tell the dev" onRequestClose={close} zIndex={WRENCH_Z + 1} maxWidthDesktop={420} tellTheDevDoor={false}>
            {box}
          </ResponsiveModalShell>
        </div>
      )}
    </>
  )
}

/** The phone's door: a wrench in the header, beside Search. It asks; the root draws the sheet. */
export function TellTheDevHeaderButton({ door = 'header' }: { door?: NoteDoor }) {
  return <TellTheDevButton door={door} />
}
