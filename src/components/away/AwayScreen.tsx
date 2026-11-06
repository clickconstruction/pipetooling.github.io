import type { CSSProperties } from 'react'
import type { AwayMiles, AwayScreen as AwayScreenModel } from '../../lib/people/awayNote'

/**
 * The one screen a teammate who left sees (punch list #256 PR 8, v2.6587), drawn from `buildAwayScreen`'s model and
 * nothing else: the hello, the note signed by the team, the countdown with its thin bar, where the office is with the
 * location press, the call and text presses, or the day-of words. The office's Leave a note window draws the same
 * component as its live preview with `preview`, so what the office sees is what the person sees; the preview's presses
 * do nothing (the mock-up's foot: *The buttons in the preview do nothing. Theirs do.*). Reads nothing itself.
 */

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }
const MUTED: CSSProperties = { color: 'var(--text-muted)' }
const PRESS: CSSProperties = { font: 'inherit', fontWeight: 700, fontSize: '0.875rem', borderRadius: 8, padding: '10px 12px', width: '100%', cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'block', boxSizing: 'border-box' }
const BLUE: CSSProperties = { ...PRESS, background: '#2563eb', border: '1px solid #2563eb', color: '#fff' }
const GREEN: CSSProperties = { ...PRESS, background: '#16a34a', border: '1px solid #16a34a', color: '#fff' }
const QUIET: CSSProperties = { ...PRESS, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-strong)' }

export type AwayScreenProps = {
  screen: AwayScreenModel
  /** The office's preview: the presses are drawn and do nothing. */
  preview?: boolean
  /** The miles worked out on the phone after Use my location, or the reason it could not be. */
  miles?: AwayMiles | null
  locating?: boolean
  locateError?: string | null
  onLocate?: () => void
}

export function AwayScreen({ screen, preview = false, miles = null, locating = false, locateError = null, onLocate }: AwayScreenProps) {
  const inert = preview
  return (
    <div data-away-screen style={{ display: 'grid', gap: 12, fontSize: '0.875rem', color: 'var(--text-strong)' }} aria-live={preview ? 'polite' : undefined}>
      {screen.done ? (
        <div style={{ background: 'var(--bg-green-tint)', border: '1.5px solid var(--border-green)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-green-800)' }}>{screen.done.title}</div>
          <div style={{ marginTop: 4, color: 'var(--text-base)' }}>{screen.done.sub}</div>
        </div>
      ) : null}
      {screen.hello ? <div style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.2 }}>{screen.hello}</div> : null}
      {screen.letter ? (
        <div style={{ ...CARD, color: 'var(--text-base)', whiteSpace: 'pre-wrap' }}>
          {screen.letter.words}
          <div style={{ ...MUTED, marginTop: 8, fontSize: '0.8125rem' }}>{screen.letter.from}</div>
        </div>
      ) : null}
      {screen.countdown ? (
        <div style={{ ...CARD, textAlign: 'center' }} role="group" aria-label={screen.countdown.line}>
          <div style={{ ...MUTED, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{screen.countdown.head}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 6 }} aria-hidden="true">
            {[
              [screen.countdown.days, 'days'],
              [screen.countdown.hours, 'hours'],
              [screen.countdown.minutes, 'min'],
            ].map(([n, unit]) => (
              <div key={unit} style={{ minWidth: 54 }}>
                <b style={{ display: 'block', fontSize: '1.75rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{Number(n).toLocaleString('en-US')}</b>
                <span style={{ ...MUTED, fontSize: '0.71875rem' }}>{unit}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-subtle)', overflow: 'hidden', marginTop: 8 }}>
            <i style={{ display: 'block', height: '100%', width: `${screen.countdown.barPercent}%`, background: '#16a34a' }} data-away-bar={screen.countdown.barPercent} />
          </div>
          <div style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--text-base)' }}>{screen.countdown.backOn}</div>
        </div>
      ) : null}
      {screen.where ? (
        <div style={CARD}>
          <div style={{ fontSize: '1rem', fontWeight: 800 }}>{screen.where.words}</div>
          {miles ? (
            <>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, marginTop: 8 }}>{miles.line}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-base)', marginTop: 2 }}>{miles.tail}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-base)', marginTop: 2 }}>{screen.where.ask}</div>
              <div style={{ marginTop: 10 }}>
                <button type="button" style={{ ...BLUE, opacity: locating ? 0.7 : 1 }} disabled={inert || locating || !screen.where.office} tabIndex={inert ? -1 : undefined} onClick={inert ? undefined : onLocate} title={!screen.where.office && !inert ? 'The office has no map pin yet.' : undefined}>
                  {locating ? 'Finding you…' : screen.where.locate}
                </button>
              </div>
              {locateError ? (
                <div role="alert" style={{ marginTop: 6, fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
                  {locateError}
                </div>
              ) : null}
            </>
          )}
          <div style={{ ...MUTED, fontSize: '0.71875rem', marginTop: 6 }}>{screen.where.privacy}</div>
        </div>
      ) : null}
      {screen.call ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {inert || !screen.call.href ? (
            <button type="button" style={GREEN} disabled={inert || !screen.call.href} tabIndex={inert ? -1 : undefined} title={!screen.call.href && !inert ? 'The office line is not set yet.' : undefined}>
              {screen.call.label}
            </button>
          ) : (
            <a href={screen.call.href} style={GREEN}>
              {screen.call.label}
            </a>
          )}
          {!screen.done ? (
            inert || !screen.call.textHref ? (
              <button type="button" style={QUIET} disabled={inert || !screen.call.textHref} tabIndex={inert ? -1 : undefined}>
                {screen.call.textLabel}
              </button>
            ) : (
              <a href={screen.call.textHref} style={QUIET}>
                {screen.call.textLabel}
              </a>
            )
          ) : null}
        </div>
      ) : null}
      {screen.empty ? <div style={{ ...CARD, ...MUTED }}>{screen.empty}</div> : null}
    </div>
  )
}
