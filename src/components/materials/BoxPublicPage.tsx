/**
 * The box page (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in. The stencil and the
 * place, the newest photo, the lines with their counts and the day of the last count: the laminated manifest with today's
 * numbers, and nothing about the job. One press, **Sign in to change a count**, writes the box's path into the app's
 * one-shot return key and goes to the sign-in, which lands back on `/b/<code>` with a session, where the route opens the
 * box's screen on the On site tab. Light, on the portal's paper, as `/pay` and `/e` are; the `box-read` function answers.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { POST_LOGIN_REDIRECT_KEY } from '../../lib/iosPwa'
import { publicFunctionHeaders } from '../../lib/customerSampleMode'
import { boxPageCodeWords, boxPageDayWords, boxPageNoun, boxPagePath, boxPageView, type BoxPageView } from '../../lib/materials/boxPage'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER, PORTAL_FONT } from '../../lib/portal/portalTheme'
import { portalFailure } from '../../lib/portal/portalFailure'
import { PortalFailureNote } from '../portal/PortalFailureNote'
import { EmptyState } from '../EmptyState'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../../lib/publicViewCounting'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

const SIGN_IN_TO_CHANGE_WORDS = 'Sign in to change a count'

/** The sign-in press's work, apart from the page: remember the box, then go to the sign-in. */
function rememberBoxForSignIn(code: string): void {
  try {
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, boxPagePath(code))
  } catch {
    /* the sign-in still works; the person opens the box from On site */
  }
}

export function BoxPublicPage({ code }: { code: string }) {
  const navigate = useNavigate()
  const [view, setView] = useState<BoxPageView>(code ? { kind: 'loading' } : { kind: 'not_found' })
  const [reloadKey, setReloadKey] = useState(0)
  const words = boxPageCodeWords(code)

  useEffect(() => {
    if (!code) return
    let live = true
    ;(async () => {
      try {
        const preview = isPreviewFlag(new URLSearchParams(window.location.search).get(PUBLIC_PREVIEW_PARAM))
        const res = await fetch(`${supabaseUrl}/functions/v1/box-read?code=${encodeURIComponent(code)}${preview ? '&preview=1' : ''}`, { headers: await publicFunctionHeaders(null) })
        const body: unknown = await res.json().catch(() => null)
        if (live) setView(boxPageView(res.status, body))
      } catch {
        if (live) setView({ kind: 'error', failure: 'network' })
      }
    })()
    return () => {
      live = false
    }
  }, [code, reloadKey])

  const payload = view.kind === 'box' ? view.payload : null
  useEffect(() => {
    document.title = payload ? `${boxPageNoun(payload.box.kind)} ${payload.box.stencil} · Click Plumbing & Electrical` : 'Box label · Click Plumbing & Electrical'
  }, [payload])

  const signIn = () => {
    rememberBoxForSignIn(code)
    navigate('/sign-in')
  }

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: PORTAL_FONT, padding: '1.25rem 1rem 3rem', display: 'grid', justifyItems: 'center', alignContent: 'start' }}>
      <main aria-live="polite" style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '0.9rem' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: COPPER }}>Click Plumbing &amp; Electrical</div>

        {view.kind === 'loading' ? <div style={{ color: MUTED, fontSize: 15 }}>Finding box {words}…</div> : null}

        {payload ? (
          <>
            <header>
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.01em' }} data-testid="box-page-title">{boxPageNoun(payload.box.kind)} {payload.box.stencil}</h1>
              {payload.box.place || payload.box.where ? <div style={{ marginTop: 4, color: MUTED, fontSize: 15 }} data-testid="box-page-place">{[payload.box.place, payload.box.where].filter(Boolean).join(' · ')}</div> : null}
            </header>
            {payload.box.photo ? (
              <figure style={{ margin: 0, border: `1px solid ${HAIR}`, borderRadius: 12, overflow: 'hidden', background: CARD }}>
                <img src={payload.box.photo.url} alt={`${boxPageNoun(payload.box.kind)} ${payload.box.stencil}`} style={{ display: 'block', width: '100%', maxHeight: 320, objectFit: 'cover' }} data-testid="box-page-photo" />
                <figcaption style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 12px', fontSize: 13, color: MUTED }}>
                  <span>Newest photo</span>
                  <b style={{ color: INK, fontWeight: 600 }}>{boxPageDayWords(payload.box.photo.takenOn)}</b>
                </figcaption>
              </figure>
            ) : null}
            <section>
              <h2 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>What is in it</h2>
              {payload.box.lines.length === 0 ? (
                <div style={{ border: `1px dashed ${HAIR}`, borderRadius: 12 }} data-testid="box-page-empty">
                  <EmptyState main={`Nothing is recorded in this ${boxPageNoun(payload.box.kind, false)} yet.`} next={{ label: 'Sign in', onPress: signIn }} tail="to add a part." />
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', background: CARD, border: `1px solid ${HAIR}`, borderRadius: 12, overflow: 'hidden' }} data-testid="box-page-lines">
                  <tbody>
                    {payload.box.lines.map((l, i) => (
                      <tr key={`${l.partName}|${l.manufacturer ?? ''}`}>
                        <td style={{ padding: '10px 12px', borderTop: i === 0 ? 0 : `1px solid ${HAIR}`, fontSize: 16 }}>
                          {l.partName}
                          {l.manufacturer ? <span style={{ display: 'block', color: MUTED, fontSize: 13 }}>{l.manufacturer}</span> : null}
                        </td>
                        <td style={{ padding: '10px 12px', borderTop: i === 0 ? 0 : `1px solid ${HAIR}`, textAlign: 'right', fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', width: '1%' }}>{l.onHand}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ marginTop: 8, color: MUTED, fontSize: 14 }} data-testid="box-page-counted">
                {payload.box.lastCountedOn ? (
                  <>
                    Last counted <b style={{ color: INK, fontWeight: 600 }}>{boxPageDayWords(payload.box.lastCountedOn)}</b>. Counts are the app's as of right now.
                  </>
                ) : (
                  'Never counted. Counts are the app\'s as of right now.'
                )}
              </div>
            </section>
            <button type="button" onClick={signIn} style={{ ...press, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }} data-testid="box-page-sign-in">
              {SIGN_IN_TO_CHANGE_WORDS}
            </button>
            <p style={{ margin: 0, color: FAINT, fontSize: 12.5, lineHeight: 1.45 }}>This page shows what is in the {boxPageNoun(payload.box.kind, false)}, not whose job it is. To record a part used, moved or counted, sign in. You come back to this {boxPageNoun(payload.box.kind, false)}.</p>
          </>
        ) : null}

        {view.kind === 'not_found' ? (
          <section data-testid="box-page-not-found">
            <h1 style={h1}>{words ? `${words} is not a box on any job` : 'That is not a box code'}</h1>
            <p style={para}>Check the eight characters under the QR code, or scan the label again.</p>
          </section>
        ) : null}

        {view.kind === 'retired' ? (
          <section data-testid="box-page-retired">
            <h1 style={h1}>This label is from a box that was retired</h1>
            <p style={para}>{view.retiredOn ? `It left the job on ${boxPageDayWords(view.retiredOn)}. ` : ''}Its parts were moved or used before it went.</p>
          </section>
        ) : null}

        {view.kind === 'locked' ? (
          <section data-testid="box-page-locked">
            <h1 style={h1}>Too many wrong codes from this connection</h1>
            <p style={para}>Wait an hour and scan the label again. A label's own code still opens from another phone.</p>
          </section>
        ) : null}

        {view.kind === 'error' ? (
          <section data-testid="box-page-error">
            <p style={para}>{portalFailure(view.failure, 'open', 'en').message}</p>
            <PortalFailureNote
              failure={{ ...portalFailure(view.failure, 'open', 'en'), phone: null }}
              doorsOnly
              onTryAgain={() => {
                setView({ kind: 'loading' })
                setReloadKey((n) => n + 1)
              }}
            />
          </section>
        ) : null}
      </main>
    </div>
  )
}

const press: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, width: '100%', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${HAIR}`, background: CARD, color: INK, font: 'inherit', fontWeight: 700, fontSize: 16, padding: '0 14px', cursor: 'pointer' }
const h1: React.CSSProperties = { margin: '8px 0 6px', fontSize: 22, lineHeight: 1.2, fontWeight: 800 }
const para: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 15, lineHeight: 1.5 }
