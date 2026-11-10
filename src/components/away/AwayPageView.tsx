import { AWAY_NO_NOTE_WORDS, AWAY_WORDS, buildAwayScreen, type AwayMiles, type MyAwayNote } from '../../lib/people/awayNote'
import { AwayScreen } from './AwayScreen'
import OfflineRetryPanel from '../OfflineRetryPanel'
import type { OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * The Away page as it is drawn (v2.6846): the header with Sign out, then the note over `buildAwayScreen`, the
 * resting words when there is no note, or the failed read. The sealed sign-in's page (`pages/Away.tsx`) reads the
 * note and hands it here. The office's See what they see window hands the same `MyAwayNote` here with `preview`,
 * so the office looks at the page the person gets and not at a copy of it. With `preview` every press is drawn
 * and does nothing, and the page fills its frame in place of the window. Reads nothing itself.
 */

export type AwayPageViewProps = {
  /** Undefined while the note is being read; null when there is none. */
  note: MyAwayNote | null | undefined
  now: Date
  failure?: OfflineRecoveryLastError | null
  onRetry?: () => void | Promise<void>
  onSignOut?: () => void
  /** The office's look at the page: the presses are drawn and do nothing. */
  preview?: boolean
  /** The preview's On the day switch: draw the day-of screen whatever the clock says. */
  onTheDay?: boolean
  miles?: AwayMiles | null
  locating?: boolean
  locateError?: string | null
  onLocate?: () => void
}

export function AwayPageView({ note, now, failure = null, onRetry, onSignOut, preview = false, onTheDay = false, miles = null, locating = false, locateError = null, onLocate }: AwayPageViewProps) {
  const screen = note ? buildAwayScreen({ draft: note.draft, firstName: note.firstName, now, leftYmd: note.leftYmd, updatedYmd: note.updatedYmd, todayYmd: todayYmdInAppTz(now), office: note.office, onTheDay: onTheDay && note.draft.countdownYmd != null }) : null
  return (
    <div data-away-page data-page-scroll={preview ? undefined : 'allow'} style={{ minHeight: preview ? '100%' : '100vh', background: 'var(--bg-subtle)', color: 'var(--text-strong)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800 }}>
        <span>ClickTooling</span>
        <button type="button" onClick={preview ? undefined : onSignOut} disabled={preview} tabIndex={preview ? -1 : undefined} style={{ font: 'inherit', fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: preview ? 'default' : 'pointer' }}>
          {AWAY_WORDS.signOut}
        </button>
      </header>
      <main style={{ maxWidth: 420, margin: '0 auto', padding: '16px 14px 24px' }}>
        {failure && onRetry ? <OfflineRetryPanel failure={failure} onRetry={onRetry} surface={preview ? 'away-note-preview' : 'away-note'} idempotent /> : null}
        {note === undefined && !failure ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p> : null}
        {note === null ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 800 }}>{AWAY_NO_NOTE_WORDS.title}</div>
            <div style={{ marginTop: 4, color: 'var(--text-base)' }}>{AWAY_NO_NOTE_WORDS.sub}</div>
          </div>
        ) : null}
        {screen ? <AwayScreen screen={screen} preview={preview} miles={miles} locating={locating} locateError={locateError} onLocate={onLocate} /> : null}
      </main>
    </div>
  )
}
