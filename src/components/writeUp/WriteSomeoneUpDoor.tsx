import { lazy, Suspense, useCallback, useEffect, useState, type CSSProperties } from 'react'
import { canWriteSomeoneUp, draftFromKept, draftToKeep, keptDraftKey, WRITE_UP_WORDS, type WriteUpDraft } from '../../lib/people/writeUp'
import { recordNavClick } from '../../lib/navClickTelemetry'

const WriteUpSheet = lazy(() => import('./WriteUpSheet').then((m) => ({ default: m.WriteUpSheet })))

/**
 * Write someone up (punch list #410): the one press. A named line, the same words and the same look wherever a leader
 * or a superintendent lands: the full Dashboard, the short Dashboard and Job Mode. It opens the sheet and saves
 * nothing. A draft the writer left stays here while the sheet is closed, and the line says one is not finished. The tab
 * keeps the draft's words too, so a reload in the middle of one (the app offers *Reload* when a new version is ready)
 * brings it back, without its photos. Draws nothing for any other role.
 */

/** The tab's own store, which a private window may refuse: every read and write is tried, never trusted. */
function readKept(userId: string): WriteUpDraft | null {
  try {
    return draftFromKept(window.sessionStorage.getItem(keptDraftKey(userId)))
  } catch {
    return null
  }
}
function writeKept(userId: string, draft: WriteUpDraft | null): void {
  try {
    if (draft) window.sessionStorage.setItem(keptDraftKey(userId), draftToKeep(draft))
    else window.sessionStorage.removeItem(keptDraftKey(userId))
  } catch {
    // the draft still lives in the page
  }
}

export function WriteSomeoneUpDoor({ userId, role, surface, style }: { userId: string | null | undefined; role: string | null | undefined; /** Where the press sits, for the press record. */ surface: string; style?: CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraftState] = useState<WriteUpDraft | null>(null)
  const allowed = Boolean(userId) && canWriteSomeoneUp(role)
  // A draft the tab kept from before a reload comes back once the person is known.
  useEffect(() => {
    if (!userId || !allowed) return
    const kept = readKept(userId)
    if (kept) setDraftState((now) => now ?? kept)
  }, [userId, allowed])
  const setDraft = useCallback(
    (next: WriteUpDraft | null) => {
      setDraftState(next)
      if (userId) writeKept(userId, next)
    },
    [userId],
  )
  if (!userId || !allowed) return null
  return (
    <>
      <button
        type="button"
        data-write-someone-up
        onClick={() => {
          recordNavClick(userId, role ?? null, 'write-someone-up', `#${surface}`)
          setOpen(true)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          width: '100%',
          minHeight: 52,
          padding: '0 0.9rem',
          borderRadius: 10,
          border: '1.5px solid var(--border-strong)',
          background: 'var(--surface)',
          color: 'var(--text-base)',
          fontFamily: 'inherit',
          fontSize: '1rem',
          fontWeight: 700,
          textAlign: 'left',
          cursor: 'pointer',
          ...style,
        }}
      >
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5 1.2 0 2.3.25 3.3.75" />
          <path d="M15 20l.6-2.8 5-5 2.2 2.2-5 5z" />
        </svg>
        <span style={{ flex: 1, minWidth: 0 }}>
          {WRITE_UP_WORDS.door}
          {draft ? <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }}>1 not finished</span> : null}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '1.25rem', fontWeight: 400 }}>
          ›
        </span>
      </button>
      {open ? (
        <Suspense fallback={null}>
          <WriteUpSheet userId={userId} initialDraft={draft} onDraft={setDraft} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )
}
