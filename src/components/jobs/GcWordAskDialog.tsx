import type { CSSProperties } from 'react'
import { wordAskStatusLine, type GcWordAskRow } from '../../lib/jobs/gcWordAskState'

type Props = {
  ownerName: string
  /** He has an address on file — the app can email him the link. */
  ownerHasEmail: boolean
  /** The GCs the link would ask about: the ones with no word in this week. */
  gcNames: readonly string[]
  /** This week's live link for him, when there is one. */
  ask: GcWordAskRow | null
  /** The link itself, once made. */
  url: string | null
  busy: boolean
  error: string | null
  notice: string | null
  onMake: () => void
  onCopyLink: () => void
  onCopyText: () => void
  onEmail: () => void
  onNewLink: () => void
  onTurnOff: () => void
  onClose: () => void
}

const btn: CSSProperties = { font: 'inherit', fontSize: '0.78rem', padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }
const primary: CSSProperties = { ...btn, fontWeight: 700, border: 'none', background: '#2563eb', color: '#ffffff' }
const quiet: CSSProperties = { font: 'inherit', fontSize: '0.75rem', border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer' }

/**
 * Ask by link (punch list #49, step 7): send the account man a no-login link
 * instead of phoning him. The link names the GCs with no word in this week;
 * his answers come back to the group's header for the office to read and
 * save. Presentational — GC Review owns the link and the writes.
 */
export default function GcWordAskDialog({ ownerName, ownerHasEmail, gcNames, ask, url, busy, error, notice, onMake, onCopyLink, onCopyText, onEmail, onNewLink, onTurnOff, onClose }: Props) {
  const first = ownerName.trim().split(/\s+/)[0] || 'him'
  const preview = gcNames.slice(0, 4).join(', ')
  const more = gcNames.length > 4 ? ` +${gcNames.length - 4} more` : ''
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ask ${ownerName} by link`}
      onClick={() => (busy ? undefined : onClose())}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 64 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, padding: '1rem 1.2rem', width: 'min(520px, 92vw)', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, flex: 1, minWidth: 0 }}>Ask {first} by link</span>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
            ✕
          </button>
        </div>
        <p style={{ margin: '0.15rem 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          No call. {first} opens a link on his phone — no sign-in — and says where each GC stands. His answers come back here for you to read before anything is saved.
        </p>

        <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.5rem 0.65rem', fontSize: '0.8125rem', marginBottom: '0.6rem' }}>
          {gcNames.length > 0 ? (
            <>
              <b>
                {gcNames.length} GC{gcNames.length === 1 ? '' : 's'} with no word this week
              </b>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {preview}
                {more}
              </div>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Every one of {first}’s GCs has a word in for this week — nothing to ask.</span>
          )}
        </div>

        {ask && url ? (
          <>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{wordAskStatusLine(ask, Date.now())}</div>
            <div
              style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem', padding: '0.4rem 0.55rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.6rem' }}
              title={url}
            >
              {url.replace(/^https?:\/\//, '')}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={onCopyText} disabled={busy} style={primary} title={`Copies a short message with the link — paste it into a text to ${first}`}>
                Copy a text for {first}
              </button>
              <button type="button" onClick={onCopyLink} disabled={busy} style={btn}>
                Copy link
              </button>
              <button
                type="button"
                onClick={onEmail}
                disabled={busy || !ownerHasEmail}
                style={{ ...btn, opacity: ownerHasEmail ? 1 : 0.55, cursor: ownerHasEmail ? 'pointer' : 'not-allowed' }}
                title={ownerHasEmail ? `Email ${first} the link from the app` : `${first} has no email on file — text him the link instead`}
              >
                {ask.emailed_at ? 'Email it again' : `Email it to ${first}`}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.9rem', marginTop: '0.6rem' }}>
              <button type="button" onClick={onNewLink} disabled={busy} style={quiet} title="Turns this link off and makes a new one — use it if the link went to the wrong person">
                new link
              </button>
              <button type="button" onClick={onTurnOff} disabled={busy} style={quiet} title="Turns the link off. Answers he already gave stay here for you to read.">
                turn the link off
              </button>
            </div>
            <p style={{ margin: '0.55rem 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              The link shows what these GCs owe, so it is for {first} only. It stops working on {new Date(ask.expires_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.
            </p>
          </>
        ) : (
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            <button type="button" onClick={onMake} disabled={busy || gcNames.length === 0} style={{ ...primary, opacity: busy || gcNames.length === 0 ? 0.55 : 1 }}>
              {busy ? 'Making the link…' : 'Make the link'}
            </button>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Nothing is sent until you text or email it.</span>
          </div>
        )}
        {notice ? <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--text-green-800)' }}>{notice}</p> : null}
        {error ? <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--text-red-700)' }}>{error}</p> : null}
      </div>
    </div>
  )
}
