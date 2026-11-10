/**
 * The box page (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in. The stencil and the
 * place, the newest photo, the lines with their counts and the day of the last count: the laminated manifest with today's
 * numbers, and nothing about the job. One press, **Sign in to record a use or a count**, writes the box's path into the
 * app's one-shot return key and goes to the sign-in, which lands back on `/b/<code>` with a session, where the route opens
 * the box's screen on the On site tab. Light, on the portal's paper, as `/pay` and `/e` are; the `box-read` function answers.
 *
 * Redrawn in v2.6868 (the owner's first scan of a tape label): the top reads as the label does, the stencil in a tile with
 * the code under it; the last count is a verdict (*Counted 2 days ago*, *Due a count*, *Never counted*) by the office's
 * own 14-day rule; the photo is a band a tap opens whole; the search is a field on the page and holds the one blue press;
 * the sign-in says who it is for and that it is once per phone. A retired label no longer offers the search, which the
 * function refuses for it, and a code no box carries offers the typed code and the site this phone last scanned.
 *
 * v2.6874, the second half: a line emptied since the box's last count stays as *None left*, a line the crew pressed Can't
 * find on says so, and **Text the office** opens the phone's own Messages to the letterhead's number with the box's name
 * filled in. That press is a link: nothing signed out writes to the app. A retired label names its box.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { POST_LOGIN_REDIRECT_KEY } from '../../lib/iosPwa'
import { publicFunctionHeaders } from '../../lib/customerSampleMode'
import { BOX_PAGE_FIND_MAX, BOX_SCAN_PATH, boxPageCallHref, boxPageCannotFindWords, boxPageCodeWords, boxPageCountVerdict, boxPageDayWords, boxPageFindPath, boxPageFindView, boxPageFoundWords, boxPageNoun, boxPagePartsWords, boxPagePath, boxPageTextHref, boxPageTextWords, boxPageView, type BoxPageFindView, type BoxPageView } from '../../lib/materials/boxPage'
import { readLastBox, rememberLastBox } from '../../lib/materials/boxPageMemory'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER, PAPER_GREEN, PORTAL_FONT } from '../../lib/portal/portalTheme'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { portalFailure } from '../../lib/portal/portalFailure'
import { PortalFailureNote } from '../portal/PortalFailureNote'
import { EmptyState } from '../EmptyState'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../../lib/publicViewCounting'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

const SIGN_IN_TO_RECORD_WORDS = 'Sign in to record a use or a count'
const SIGN_IN_TO_ADD_WORDS = 'Sign in to add a part'
const FIND_WORDS = 'Find a part on this site'
const COMPANY_WORDS = 'Click Plumbing & Electrical'
/** Due a count: amber as words on the paper, 5.6:1 on CARD. The dot beside it is the brighter amber, a mark and not words. */
const DUE_WORDS_AMBER = '#8a5a00'
const DUE_DOT_AMBER = '#d97706'

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
  const [photoWhole, setPhotoWhole] = useState(false)
  // The site this phone scanned in the last day, read before this code is remembered: a wrong code offers its search.
  const last = useMemo(() => readLastBox(), [])
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

  /** The field on the box's own page: it opens the search, and asks at once when words were typed. */
  const openFind = (e: FormEvent) => {
    e.preventDefault()
    setFinding(true)
    if (query.trim()) void runFind()
  }

  const noun = payload ? boxPageNoun(payload.box.kind, false) : 'box'
  const verdict = payload ? boxPageCountVerdict(payload.box.lastCountedOn, todayYmdInAppTz()) : null
  const placeWords = payload ? [payload.box.place, payload.box.where].filter(Boolean).join(' · ') : ''
  // What is on hand first, then what ran out since the last count.
  const rows = payload ? [...payload.box.lines.map((l) => ({ l, gone: false })), ...payload.box.gone.map((l) => ({ l, gone: true }))] : []
  const officePhone = payload?.office?.phone ?? null
  const textHref = payload ? boxPageTextHref(officePhone, boxPageTextWords(payload.box.kind, payload.box.stencil, payload.box.code)) : null
  const retiredName = view.kind === 'retired' && view.stencil ? `${boxPageNoun(view.boxKind ?? 'box')} ${view.stencil}` : null
  const retiredTextHref = view.kind === 'retired' && view.stencil ? boxPageTextHref(view.phone, boxPageTextWords(view.boxKind ?? 'box', view.stencil, code)) : null

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: PORTAL_FONT, padding: '1.25rem 1rem 3rem', display: 'grid', justifyItems: 'center', alignContent: 'start' }}>
      <main aria-live="polite" style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '0.9rem' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: COPPER }}>Click Plumbing &amp; Electrical</div>

        {view.kind === 'loading' && !finding ? <div style={{ color: MUTED, fontSize: 15 }}>Finding box {words}…</div> : null}

        {finding && view.kind !== 'not_found' && view.kind !== 'locked' && view.kind !== 'retired' ? (
          <section data-testid="box-page-find">
            <button type="button" onClick={() => setFinding(false)} style={{ ...link, padding: 0 }} data-testid="box-page-find-back">
              ‹ {payload ? `${boxPageNoun(payload.box.kind)} ${payload.box.stencil}` : `Box ${words}`}
            </button>
            <h1 style={{ ...h1, marginTop: 6 }}>{FIND_WORDS}</h1>
            <p style={para}>The cages and boxes on the same site{payload ? ` as ${payload.box.stencil}` : ''}.</p>
            <form onSubmit={runFind} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="A part, a maker or a stencil" aria-label="What to find" inputMode="search" autoFocus style={{ flex: 1, minHeight: 48, border: `1px solid ${HAIR}`, borderRadius: 12, padding: '0 14px', fontSize: 17, font: 'inherit', background: 'var(--surface)', color: INK, minWidth: 0 }} data-testid="box-page-find-input" />
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

        {payload && verdict && !finding ? (
          <>
            {/* The top reads as the label in the hand does: the stencil in a box, the eight characters under it. */}
            <header style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 12, alignItems: 'center' }}>
              <div aria-hidden style={{ ...tile, fontSize: payload.box.stencil.length <= 3 ? 30 : payload.box.stencil.length <= 5 ? 24 : 18 }} data-testid="box-page-tile">
                {payload.box.stencil}
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }} data-testid="box-page-title">
                  {boxPageNoun(payload.box.kind)} <span style={srOnly}>{payload.box.stencil}</span>
                </h1>
                {placeWords ? <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere' }} data-testid="box-page-place">{placeWords}</div> : null}
                <div style={{ marginTop: 2, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: placeWords ? 13 : 15, color: MUTED }} data-testid="box-page-code">{boxPageCodeWords(payload.box.code)}</div>
              </div>
            </header>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', alignItems: 'baseline', fontSize: 15, padding: '8px 12px', borderRadius: 10, background: CARD, border: `1px solid ${HAIR}` }} data-testid="box-page-counted" data-verdict={verdict.kind}>
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', flex: '0 0 auto', background: verdict.kind === 'fresh' ? PAPER_GREEN : verdict.kind === 'due' ? DUE_DOT_AMBER : FAINT }} />
              <b style={{ whiteSpace: 'nowrap', color: verdict.kind === 'due' ? DUE_WORDS_AMBER : INK }}>{verdict.words}</b>
              {verdict.detail ? <span style={{ color: MUTED, fontSize: 13.5 }}>{verdict.detail}</span> : null}
            </div>
            {payload.box.photo ? (
              <button
                type="button"
                onClick={() => setPhotoWhole((w) => !w)}
                aria-expanded={photoWhole}
                style={{ position: 'relative', display: 'block', width: '100%', padding: 0, border: `1px solid ${HAIR}`, borderRadius: 12, overflow: 'hidden', background: CARD, cursor: 'pointer', font: 'inherit' }}
                data-testid="box-page-photo-press"
              >
                <img src={payload.box.photo.url} alt={`${boxPageNoun(payload.box.kind)} ${payload.box.stencil}`} style={{ display: 'block', width: '100%', height: photoWhole ? 'auto' : 150, objectFit: 'cover' }} data-testid="box-page-photo" />
                <span style={{ position: 'absolute', left: 8, bottom: 8, maxWidth: 'calc(100% - 16px)', textAlign: 'left', fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, color: '#fff', background: 'rgba(15, 23, 42, 0.72)', borderRadius: 10, padding: '3px 10px' }}>
                  Photo from {boxPageDayWords(payload.box.photo.takenOn)} · {photoWhole ? 'tap to fold it' : 'tap to see it whole'}
                </span>
              </button>
            ) : null}
            <section>
              <h2 style={{ ...label, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>What is in it</span>
                {payload.box.lines.length > 0 ? <span style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 600 }} data-testid="box-page-parts">{boxPagePartsWords(payload.box.lines.length)}</span> : null}
              </h2>
              {rows.length === 0 ? (
                <div style={{ border: `1px dashed ${HAIR}`, borderRadius: 12 }} data-testid="box-page-empty">
                  <EmptyState main={payload.box.lastCountedOn ? `Nothing on hand in this ${noun}.` : `Nothing is recorded in this ${noun} yet.`} next={{ label: 'Sign in', onPress: signIn }} tail="to add a part." />
                </div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: CARD, border: `1px solid ${HAIR}`, borderRadius: 12, overflow: 'hidden' }} data-testid="box-page-lines">
                    <tbody>
                      {rows.map(({ l, gone }, i) => (
                        <tr key={`${gone ? 'gone' : 'here'}|${l.partName}|${l.manufacturer ?? ''}`} style={gone ? { background: NOTE_BAND } : undefined} data-testid={gone ? 'box-page-gone' : 'box-page-line'}>
                          <td style={{ padding: '10px 12px', borderTop: i === 0 ? 0 : `1px solid ${HAIR}`, fontSize: 16, color: gone ? MUTED : INK }}>
                            {l.partName}
                            {l.manufacturer ? <span style={{ display: 'block', color: MUTED, fontSize: 13 }}>{l.manufacturer}</span> : null}
                            {l.cannotFind ? <span style={{ display: 'block', marginTop: 3, color: DUE_WORDS_AMBER, fontSize: 13, fontWeight: 600 }} data-testid="box-page-cannot-find">{boxPageCannotFindWords(l.cannotFind)}</span> : null}
                          </td>
                          {gone ? (
                            <td style={{ padding: '10px 12px', borderTop: i === 0 ? 0 : `1px solid ${HAIR}`, textAlign: 'right', fontWeight: 700, fontSize: 14, color: MUTED, whiteSpace: 'nowrap', width: '1%' }}>None left</td>
                          ) : (
                            <td style={{ padding: '10px 12px', borderTop: i === 0 ? 0 : `1px solid ${HAIR}`, textAlign: 'right', fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', width: '1%' }}>{l.onHand}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 8, color: MUTED, fontSize: 14 }}>These are the app's counts as of right now.</div>
                </>
              )}
            </section>
            {/* The search within reach: "it is not in this one" is the next thought, and everyone can use it. */}
            <section>
              <h2 style={ask}>{rows.length > 0 ? `Not in this ${noun}?` : 'Looking for a part?'}</h2>
              <form onSubmit={openFind} style={{ display: 'flex', gap: 8 }} data-testid="box-page-find-form">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="A part, a maker or a stencil" aria-label="What to find on this site" inputMode="search" style={field} data-testid="box-page-find-first" />
                <button type="submit" style={{ ...press, width: 'auto', minWidth: 72, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }} data-testid="box-page-find-open-press">Find</button>
              </form>
              <p style={{ ...small, marginTop: 6 }}>Looks in every cage and box on this site.</p>
            </section>
            {/* A link, never a write: the phone's own Messages opens with the box's name filled in. */}
            {textHref ? (
              <section data-testid="box-page-office">
                <h2 style={ask}>Something missing or wrong?</h2>
                <a href={textHref} style={{ ...press, textDecoration: 'none' }} data-testid="box-page-text-office">
                  Text the office about {boxPageNoun(payload.box.kind)} {payload.box.stencil}
                </a>
                <p style={{ ...small, marginTop: 6 }}>
                  Opens a text with this {noun}'s name in it.
                  {boxPageCallHref(officePhone) ? (
                    <>
                      {' '}Or call <a href={boxPageCallHref(officePhone) ?? undefined} style={{ color: 'var(--text-link)', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }} data-testid="box-page-call-office">{officePhone}</a>.
                    </>
                  ) : null}
                </p>
              </section>
            ) : null}
            <section>
              <h2 style={ask}>On Click's crew?</h2>
              <button type="button" onClick={signIn} style={press} data-testid="box-page-sign-in">
                {payload.box.lines.length > 0 ? SIGN_IN_TO_RECORD_WORDS : SIGN_IN_TO_ADD_WORDS}
              </button>
              <p style={{ ...small, marginTop: 6 }}>Sign in once on this phone. After that a scan opens the {noun}'s own screen.</p>
            </section>
            <p style={small}>This {noun} belongs to {COMPANY_WORDS}. The page shows what is in it, not whose job it is.</p>
          </>
        ) : null}

        {view.kind === 'not_found' ? (
          <section data-testid="box-page-not-found">
            <h1 style={h1}>{words ? `${words} is not a box on any job` : 'That is not a box code'}</h1>
            <p style={para}>Check the eight characters under the QR code, or scan the label again.</p>
            <Link to={BOX_SCAN_PATH} style={{ ...press, marginTop: 14, textDecoration: 'none' }} data-testid="box-page-type-code">
              Type the code
            </Link>
            {last && last.code !== code ? (
              <Link to={boxPageFindPath(last.code)} style={{ ...press, marginTop: 10, textDecoration: 'none' }} data-testid="box-page-last-site">
                Find a part on the site you last scanned
              </Link>
            ) : null}
          </section>
        ) : null}

        {view.kind === 'retired' ? (
          <section data-testid="box-page-retired">
            <h1 style={h1}>{retiredName ? `${retiredName} was retired` : 'This label is from a box that was retired'}</h1>
            <p style={para}>{view.retiredOn ? `It left the job on ${boxPageDayWords(view.retiredOn)}. ` : ''}Its parts were moved or used before it went. This label can come off.</p>
            {/* No search from here (v2.6868): the function answers retired before it reaches the search, and a retired label may be anywhere. */}
            <Link to={BOX_SCAN_PATH} style={{ ...press, marginTop: 14, textDecoration: 'none' }} data-testid="box-page-scan-another">
              Scan another label
            </Link>
            {retiredTextHref && retiredName ? (
              <a href={retiredTextHref} style={{ ...press, marginTop: 10, textDecoration: 'none' }} data-testid="box-page-text-office">
                Text the office about {retiredName}
              </a>
            ) : null}
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
const link: React.CSSProperties = { background: 'none', border: 0, color: 'var(--text-link)', fontWeight: 700, font: 'inherit', fontSize: 15, cursor: 'pointer', textDecoration: 'none', textAlign: 'left' }
const para: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 15, lineHeight: 1.5 }
const small: React.CSSProperties = { margin: 0, color: FAINT, fontSize: 12.5, lineHeight: 1.45 }
const label: React.CSSProperties = { margin: '0 0 6px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }
const ask: React.CSSProperties = { margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: INK }
const field: React.CSSProperties = { flex: 1, minHeight: 48, border: `1px solid ${HAIR}`, borderRadius: 12, padding: '0 14px', font: 'inherit', fontSize: 17, background: 'var(--surface)', color: INK, minWidth: 0, boxSizing: 'border-box' }
/** The stencil as the label prints it: a box with a heavy rule. */
const tile: React.CSSProperties = { minWidth: 68, maxWidth: 150, minHeight: 68, boxSizing: 'border-box', padding: '4px 10px', border: `3px solid ${INK}`, borderRadius: 10, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.05, overflowWrap: 'anywhere' }
/** Read aloud, never drawn: the stencil inside the heading, whose drawn copy is the tile. */
const srOnly: React.CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }
