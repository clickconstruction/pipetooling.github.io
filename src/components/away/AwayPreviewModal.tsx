import { useCallback, useEffect, useRef, useState } from 'react'
import { AWAY_PREVIEW_WORDS, awayPreviewNote, awayPreviewTitle, awayPreviewWhoWords } from '../../lib/people/awayPreview'
import type { MyAwayNote } from '../../lib/people/awayNote'
import { loadAwayNote, loadAwayOffice } from '../../lib/people/awayNoteIo'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import type { OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { BTN, DESK_EDITOR_Z } from '../personDesk/personDeskShared'
import { AwayPageView } from './AwayPageView'

/**
 * See what they see (v2.6846): the window an Away row opens to show the office the page a teammate who is away
 * meets at sign-in. It reads the note and the office settings as the office (two reads the Leave a note window
 * already makes), shapes them through `awayPreviewNote` into what `my_away_note()` answers, and draws them on
 * `AwayPageView`, the page the sealed sign-in draws. It is a look: nobody is signed in as the person, nothing is
 * written, and every press on the page is drawn and does nothing. The amber bar above the page is the window's
 * own and says whose screen this is. On a phone the window fills the screen, so the page under the bar is the
 * width the person will hold.
 */

const NARROW = '(max-width: 520px)'
const MINUTE = 60_000

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(NARROW).matches : false))
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(NARROW)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return narrow
}

export function AwayPreviewModal({
  userId,
  displayName,
  loginName,
  leftYmd,
  hasLogin,
  onClose,
}: {
  userId: string
  displayName: string
  /** The login's own name; the page greets its first word. */
  loginName: string | null
  /** The day they left, for the countdown's bar. */
  leftYmd: string | null
  /** A login stands behind the account; with none, nothing opens yet and the bar says so. */
  hasLogin: boolean
  onClose: () => void
}) {
  const narrow = useNarrow()
  const [note, setNote] = useState<MyAwayNote | null | undefined>(undefined)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [onTheDay, setOnTheDay] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const closeRef = useRef<HTMLButtonElement | null>(null)

  const load = useCallback(async () => {
    setFailure(null)
    try {
      // Both reads or neither: a page drawn without the office would not be the page they get.
      const [read, office] = await Promise.all([loadAwayNote(userId), loadAwayOffice()])
      setNote(awayPreviewNote({ loginName, leftYmd, row: read.row, office }))
    } catch (e) {
      setFailure(recoveryFailureFromError(e, AWAY_PREVIEW_WORDS.loadFailed))
    }
  }, [userId, loginName, leftYmd])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), MINUTE)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const title = awayPreviewTitle(displayName)
  const hasCountdown = note?.draft.countdownYmd != null

  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: DESK_EDITOR_Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', width: narrow ? '100%' : 'min(430px, 96vw)', height: narrow ? '100%' : 'min(860px, 94%)', borderRadius: narrow ? 0 : 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }}>
        <div data-away-preview-bar style={{ background: 'var(--bg-amber-tint)', borderBottom: '1px solid #f59e0b', padding: '8px 12px', display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
              <b style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.6875rem', marginRight: 6 }}>{AWAY_PREVIEW_WORDS.tag}</b>
              {awayPreviewWhoWords(displayName, hasLogin)}
            </div>
            <button ref={closeRef} type="button" onClick={onClose} style={BTN}>
              {AWAY_PREVIEW_WORDS.close}
            </button>
          </div>
          <span role="group" aria-label={AWAY_PREVIEW_WORDS.dayGroup} style={{ display: 'inline-flex', justifySelf: 'start', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
            {(
              [
                [false, AWAY_PREVIEW_WORDS.today],
                [true, AWAY_PREVIEW_WORDS.onTheDay],
              ] as const
            ).map(([v, label]) => (
              <button key={label} type="button" aria-pressed={onTheDay === v} disabled={v && !hasCountdown} title={v && !hasCountdown ? 'The note has no day back, so there is no day to show.' : undefined} onClick={() => setOnTheDay(v)} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 700, border: 'none', padding: '4px 10px', cursor: v && !hasCountdown ? 'default' : 'pointer', whiteSpace: 'nowrap', background: onTheDay === v ? 'var(--text-strong)' : 'transparent', color: onTheDay === v ? 'var(--surface)' : 'var(--text-muted)' }}>
                {label}
              </button>
            ))}
          </span>
        </div>
        <div data-away-preview-frame style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--bg-subtle)' }}>
          <AwayPageView note={note} now={now} failure={failure} onRetry={load} preview onTheDay={onTheDay} />
        </div>
        <div style={{ fontSize: '0.71875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '6px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>{AWAY_PREVIEW_WORDS.inert}</div>
      </div>
    </div>
  )
}
