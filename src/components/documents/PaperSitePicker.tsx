import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { addressesOnFile, onFileMatches, type AddressOnFile } from '../../lib/addresses/addressesOnFile'
import { PAPER_SITE_WORDS, paperSiteOfEntry, paperSiteRowNote, type PaperSite } from '../../lib/addresses/paperSite'
import { readAddresses } from '../../hooks/useAddressesOnFile'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'

/**
 * Send a paper: **Which site is it for?** (punch list #439, piece 3). A paper can name one place, an address the
 * company has on file. This window finds it: the addresses on every job and bid, as the job form's box lists them,
 * each with what is there. **It is not for a site** takes a site off. Nothing is written here: the site goes on the
 * paper's row when the email is sent.
 *
 * A site is an address already on file, never a new one typed here, so a paper's site is always a place a job or a
 * bid is at.
 */

const ROWS = 8
const row: CSSProperties = { display: 'block', width: '100%', minHeight: 44, padding: '0.5rem 0.6rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', textAlign: 'left', color: 'var(--text-strong)', boxSizing: 'border-box', overflowWrap: 'anywhere' }
const rowNote: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.1rem' }
const choice: CSSProperties = { display: 'block', width: '100%', minHeight: 44, padding: '0.55rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, textAlign: 'left', boxSizing: 'border-box' }
const closeX: CSSProperties = { minWidth: 44, minHeight: 44, margin: '-0.6rem -0.6rem 0 0', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1, color: 'var(--text-muted)', flexShrink: 0 }
const hint: CSSProperties = { margin: '0.4rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }

export function PaperSitePicker({
  busy,
  onPick,
  onClose,
}: {
  /** True while a pick is being checked against the papers the company holds: the rows wait. */
  busy: boolean
  /** A site, or null for **It is not for a site**. */
  onPick: (site: PaperSite | null) => void
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const [list, setList] = useState<AddressOnFile[] | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Every address on file, read when the window opens. A read that fails says so and offers to read again.
  useEffect(() => {
    let live = true
    setFailure(null)
    readAddresses().then(
      (read) => {
        if (live) setList(addressesOnFile(read.rows, read.developments))
      },
      (e: unknown) => {
        if (live) setFailure(recoveryFailureFromError(e, 'Couldn’t read the addresses on file'))
      },
    )
    return () => {
      live = false
    }
  }, [attempt])

  const typedEnough = typed.trim().replace(/\s/g, '').length >= 3
  const rows = useMemo(() => (list ? onFileMatches(list, typed, ROWS).filter((m) => paperSiteOfEntry(m) != null) : []), [list, typed])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 715, paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={PAPER_SITE_WORDS.title}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '1rem 1.1rem', width: 'min(92vw, 460px)', maxHeight: 'min(80vh, 100%)', overflow: 'auto', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', lineHeight: 1.35 }}>{PAPER_SITE_WORDS.title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={closeX}>
            ×
          </button>
        </div>
        <p style={{ margin: '0.25rem 0 0.6rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{PAPER_SITE_WORDS.lead}</p>
        <button type="button" style={choice} disabled={busy} onClick={() => onPick(null)}>
          {PAPER_SITE_WORDS.notForASite}
          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400, marginTop: '0.15rem' }}>{PAPER_SITE_WORDS.notForASiteHint}</span>
        </button>
        <input
          type="search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={PAPER_SITE_WORDS.find}
          aria-label={PAPER_SITE_WORDS.find}
          autoFocus
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-strong)', margin: '0.6rem 0 0.2rem' }}
        />
        {failure ? <OfflineRetryPanel failure={failure} onRetry={() => setAttempt((n) => n + 1)} surface="paper-site-picker" idempotent /> : null}
        {!failure && list == null ? <p style={hint}>Reading the addresses on file…</p> : null}
        {list != null && !typedEnough ? (
          <p style={hint} data-testid="paper-site-hint">
            {PAPER_SITE_WORDS.typeMore}
          </p>
        ) : null}
        {list != null && typedEnough && rows.length === 0 ? (
          <>
            <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'addresses on file', query: typed }), { onPress: () => setTyped('') })} />
            <p style={hint} data-testid="paper-site-hint">
              {PAPER_SITE_WORDS.onFileOnly}
            </p>
          </>
        ) : null}
        <div>
          {rows.map((m) => (
            <button
              key={m.key}
              type="button"
              style={{ ...row, ...(busy ? { cursor: 'wait' } : {}) }}
              disabled={busy}
              data-testid="paper-site-row"
              onClick={() => {
                const site = paperSiteOfEntry(m)
                if (site) onPick(site)
              }}
            >
              {m.address}
              <span style={rowNote}>{paperSiteRowNote(m)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PaperSitePicker
