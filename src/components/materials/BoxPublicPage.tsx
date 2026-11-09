/**
 * The box page (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in. The stencil and the
 * place, the newest photo, the lines with their counts and the day of the last count: the laminated manifest with today's
 * numbers, and nothing about the job. One press, **Sign in to change a count**, writes the box's path into the app's
 * one-shot return key and goes to the sign-in, which lands back on `/b/<code>` with a session, where the route opens the
 * box's screen on the On site tab. Light, on the portal's paper, as `/pay` and `/e` are; the `box-read` function answers.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { POST_LOGIN_REDIRECT_KEY } from '../../lib/iosPwa'
import { publicFunctionHeaders } from '../../lib/customerSampleMode'
import { BOX_PAGE_FIND_MAX, boxPageCodeWords, boxPageDayWords, boxPageFindView, boxPageFoundWords, boxPageNoun, boxPagePath, boxPageView, type BoxPageFindView, type BoxPageView } from '../../lib/materials/boxPage'
import { rememberLastBox } from '../../lib/materials/boxPageMemory'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER, PORTAL_FONT } from '../../lib/portal/portalTheme'
import { portalFailure } from '../../lib/portal/portalFailure'
import { PortalFailureNote } from '../portal/PortalFailureNote'
import { EmptyState } from '../EmptyState'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../../lib/publicViewCounting'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

const SIGN_IN_TO_CHANGE_WORDS = 'Sign in to change a count'
const FIND_WORDS = 'Find a part on this site'

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
  // Find a part on this site (PR 3, v2.6799): `?find=1` opens the page on the search, as the Scan a label page does.
  const [params, setParams] = useSearchParams()
  const finding = params.get('find') != null
  const [query, setQuery] = useState('')
  const [findView, setFindView] = useState<BoxPageFindView>({ kind: 'idle' })
  const setFinding = (on: boolean) => {
    const next = new URLSearchParams(params)
    if (on) next.set('find', '1')
    else next.delete('find')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (!code) return
    let live = true
    ;(async () => {
      try {
        const preview = isPreviewFlag(new URLSearchParams(window.location.search).get(PUBLIC_PREVIEW_PARAM))
        const res = await fetch(`${supabaseUrl}/functions/v1/box-read?code=${encodeURIComponent(code)}${preview ? '&preview=1' : ''}`, { headers: await publicFunctionHeaders(null) })
        const body: unknown = await res.json().catch(() => null)
        if (!live) return
        const next = boxPageView(res.status, body)
        setView(next)
        if (next.kind === 'box') rememberLastBox({ code, stencil: next.payload.box.stencil, kind: next.payload.box.kind })
      } catch {
        if (live) setView({ kind: 'error', failure: 'network' })
      }
    })()
    return () => {
      live = false
    }
  }, [code, reloadKey])

  const runFind = async (e?: FormEvent) => {
    e?.preventDefault()
    const q = query.trim()
    if (!q) return
    setFindView({ kind: 'loading' })
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/box-read?code=${encodeURIComponent(code)}&find=${encodeURIComponent(q)}`, { headers: await publicFunctionHeaders(null) })
      const body: unknown = await res.json().catch(() => null)
      setFindView(boxPageFindView(res.status, body))
    } catch {
      setFindView({ kind: 'error', failure: 'network' })
    }
  }

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

        {view.kind === 'loading' && !finding ? <div style={{ color: MUTED, fontSize: 15 }}>Finding box {words}…</div> : null}

        {finding && view.kind !== 'not_found' && view.kind !== 'locked' ? (
          <section data-testid="box-page-find">
            <button type="button" onClick={() => setFinding(false)} style={{ ...link, padding: 0 }} data-testid="box-page-find-back">
              ‹ {payload ? `${boxPageNoun(payload.box.kind)} ${payload.box.stencil}` : `Box ${words}`}
            </button>
            <h1 style={{ ...h1, marginTop: 6 }}>{FIND_WORDS}</h1>
            <p style={para}>The cages and boxes on the same site{payload ? ` as ${payload.box.stencil}` : ''}.</p>
            <form onSubmit={runFind} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="A part, a maker or a stencil" aria-label="What to find" inputMode="search" autoFocus style={{ flex: 1, minHeight: 48, border: `1px solid ${HAIR}`, borderRadius: 12, padding: '0 14px', fontSize: 17, font: 'inherit', background: '#fff', color: INK, minWidth: 0 }} data-testid="box-page-find-input" />
              <button type="submit" style={{ ...press, width: 'auto', minWidth: 72, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }} data-testid="box-page-find-go">Find</button>
            </form>
            {findView.kind === 'loading' ? <div style={{ ...para, marginTop: 12 }}>Looking…</div> : null}
            {findView.kind === 'found' ? (
              findView.payload.find.boxes.length === 0 ? (
                <div style={{ marginTop: 14, border: `1px dashed ${HAIR}`, borderRadius: 12 }} data-testid="box-page-find-empty">
                  <EmptyState main={`Nothing on this site matches ${findView.payload.find.words.join(' ')}. Try a shorter word.`} next={{ label: 'Sign in', onPress: signIn }} tail="and press Short on a box's line to ask the office for it." />
                </div>
              ) : (
                <>
                  <p style={{ ...para, marginTop: 12 }} data-testid="box-page-find-count">{boxPageFoundWords(findView.payload.find.total, BOX_PAGE_FIND_MAX)}</p>
                  <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                    {findView.payload.find.boxes.map((b) => (
                      <article key={b.code} style={{ background: CARD, border: `1px solid ${HAIR}`, borderRadius: 12, overflow: 'hidden' }} data-testid="box-page-find-hit">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '10px 12px 6px' }}>
                          <b style={{ fontSize: 17 }}>
                            {boxPageNoun(b.kind)} {b.stencil}
                            {b.thisBox ? <span style={{ color: '#1f7a3a', fontSize: 13, fontWeight: 600 }}> · this {boxPageNoun(b.kind, false)}</span> : null}
                          </b>
                          <span style={{ color: MUTED, fontSize: 13, textAlign: 'right' }}>{[b.place, b.where].filter(Boolean).join(' · ')}</span>
                        </div>
                        {b.lines.map((l) => (
                          <div key={`${l.partName}|${l.manufacturer ?? ''}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 12px', borderTop: `1px solid ${HAIR}` }}>
                            <span>
                              {l.partName}
                              {l.manufacturer ? <span style={{ display: 'block', color: MUTED, fontSize: 13 }}>{l.manufacturer}</span> : null}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{l.onHand}</span>
                          </div>
                        ))}
                        {b.thisBox ? null : (
                          <Link to={boxPagePath(b.code)} style={{ ...link, display: 'block', padding: '10px 12px', borderTop: `1px solid ${HAIR}` }} data-testid="box-page-find-open">
                            Open {boxPageNoun(b.kind)} {b.stencil} ›
                          </Link>
                        )}
                      </article>
                    ))}
                  </div>
                </>
              )
            ) : null}
            {findView.kind === 'error' ? (
              <div style={{ marginTop: 12 }}>
                <p style={para}>{portalFailure(findView.failure, 'open', 'en').message}</p>
                <PortalFailureNote failure={{ ...portalFailure(findView.failure, 'open', 'en'), phone: null }} doorsOnly onTryAgain={() => void runFind()} />
              </div>
            ) : null}
            <p style={{ margin: '18px 0 0', color: FAINT, fontSize: 12.5, lineHeight: 1.45 }}>
              Boxes on this site only, as of right now. <button type="button" onClick={signIn} style={{ ...link, padding: 0, fontSize: 12.5 }}>Sign in</button> to search every job.
            </p>
          </section>
        ) : null}

        {payload && !finding ? (
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
            <button type="button" onClick={() => setFinding(true)} style={press} data-testid="box-page-find-open-press">
              {FIND_WORDS}
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

        {view.kind === 'retired' && !finding ? (
          <section data-testid="box-page-retired">
            <h1 style={h1}>This label is from a box that was retired</h1>
            <p style={para}>{view.retiredOn ? `It left the job on ${boxPageDayWords(view.retiredOn)}. ` : ''}Its parts were moved or used before it went.</p>
            <button type="button" onClick={() => setFinding(true)} style={{ ...press, marginTop: 14 }} data-testid="box-page-find-open-press">
              {FIND_WORDS}
            </button>
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
const link: React.CSSProperties = { background: 'none', border: 0, color: '#2563eb', fontWeight: 700, font: 'inherit', fontSize: 15, cursor: 'pointer', textDecoration: 'none', textAlign: 'left' }
const para: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 15, lineHeight: 1.5 }
