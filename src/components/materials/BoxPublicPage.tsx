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
 *
 * v2.6899, the look (the owner, on the live page: *visually it could be better*; his pick of the navy plate): the stencil,
 * the place, the code, the photo and the count's verdict are one plate on the portal's ink, the one thing the page leads
 * with; the list has its outline and bolder counts; the search is one joined control; and the three next steps (text the
 * office, call the office, sign in) are rows of one card, an icon, a title and a line each, where three headed presses
 * read as a form. The words are the same but for the sign-in's second line and the call, which has a row of its own.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { POST_LOGIN_REDIRECT_KEY } from '../../lib/iosPwa'
import { publicFunctionHeaders } from '../../lib/customerSampleMode'
import { BOX_PAGE_FIND_MAX, BOX_SCAN_PATH, boxPageCallHref, boxPageCannotFindWords, boxPageCodeWords, boxPageCountVerdict, boxPageDayWords, boxPageFindPath, boxPageFindView, boxPageFoundWords, boxPageNoun, boxPagePartsWords, boxPagePath, boxPageTextHref, boxPageTextWords, boxPageView, type BoxPageFindView, type BoxPageView } from '../../lib/materials/boxPage'
import { readLastBox, rememberLastBox } from '../../lib/materials/boxPageMemory'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER, PORTAL_FONT } from '../../lib/portal/portalTheme'
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
/** A line's value when nothing is on hand, in place of its count. A row of a list that has rows, not an empty list's words. */
const NONE_LEFT_WORDS = 'None left'
/** A line's Can't find note: amber as words on the paper, 5.6:1 on CARD. */
const DUE_WORDS_AMBER = '#8a5a00'

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
      <main aria-live="polite" style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '1.1rem' }}>
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
            {/* The plate: the stencil as the label prints it, large, with the place and the code, the newest photo across its
                top and the count's verdict along its foot. One object, the one thing the page leads with. */}
            <header style={{ borderRadius: 16, overflow: 'hidden', background: plate.ground, color: plate.words, boxShadow: '0 1px 2px rgba(22, 40, 60, 0.08), 0 10px 24px rgba(22, 40, 60, 0.10)' }}>
              {payload.box.photo ? (
                <button
                  type="button"
                  onClick={() => setPhotoWhole((w) => !w)}
                  aria-expanded={photoWhole}
                  style={{ position: 'relative', display: 'block', width: '100%', padding: 0, border: 0, background: 'none', cursor: 'pointer', font: 'inherit' }}
                  data-testid="box-page-photo-press"
                >
                  <img src={payload.box.photo.url} alt={`${boxPageNoun(payload.box.kind)} ${payload.box.stencil}`} style={{ display: 'block', width: '100%', height: photoWhole ? 'auto' : 150, objectFit: 'cover' }} data-testid="box-page-photo" />
                  <span style={{ position: 'absolute', left: 10, bottom: 10, maxWidth: 'calc(100% - 20px)', textAlign: 'left', fontSize: 11.5, fontWeight: 600, lineHeight: 1.3, color: '#fff', background: 'rgba(15, 23, 42, 0.66)', borderRadius: 999, padding: '3px 10px' }}>
                    Photo from {boxPageDayWords(payload.box.photo.takenOn)} · {photoWhole ? 'tap to fold it' : 'tap to see it whole'}
                  </span>
                </button>
              ) : null}
              <div style={{ padding: '16px 16px 14px', display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <h1 style={{ margin: 0, fontSize: payload.box.stencil.length <= 4 ? 46 : payload.box.stencil.length <= 8 ? 32 : 24, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, overflowWrap: 'anywhere', minWidth: 0 }} data-testid="box-page-title">
                    <span style={srOnly}>{boxPageNoun(payload.box.kind)} </span>
                    <span data-testid="box-page-tile">{payload.box.stencil}</span>
                  </h1>
                  <span aria-hidden style={{ flex: '0 0 auto', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: plate.soft, border: `1px solid ${plate.hair}`, borderRadius: 999, padding: '3px 10px' }}>{boxPageNoun(payload.box.kind)}</span>
                </div>
                {placeWords ? <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }} data-testid="box-page-place">{placeWords}</div> : null}
                <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, letterSpacing: '0.04em', color: plate.soft }} data-testid="box-page-code">{boxPageCodeWords(payload.box.code)}</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', alignItems: 'baseline', fontSize: 15, padding: '10px 16px', background: plate.band, borderTop: `1px solid ${plate.hair}` }} data-testid="box-page-counted" data-verdict={verdict.kind}>
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', flex: '0 0 auto', background: verdict.kind === 'fresh' ? plate.fresh : verdict.kind === 'due' ? plate.due : plate.soft }} />
                <b style={{ whiteSpace: 'nowrap', color: verdict.kind === 'due' ? plate.due : plate.words }}>{verdict.words}</b>
                {verdict.detail ? <span style={{ color: plate.soft, fontSize: 13.5 }}>{verdict.detail}</span> : null}
              </div>
            </header>

            <section>
              <h2 style={{ ...label, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>What is in it</span>
                {payload.box.lines.length > 0 ? <span style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 600 }} data-testid="box-page-parts">{boxPagePartsWords(payload.box.lines.length)}</span> : null}
              </h2>
              {rows.length === 0 ? (
                <div style={{ border: `1px dashed ${HAIR}`, borderRadius: 14 }} data-testid="box-page-empty">
                  <EmptyState main={payload.box.lastCountedOn ? `Nothing on hand in this ${noun}.` : `Nothing is recorded in this ${noun} yet.`} next={{ label: 'Sign in', onPress: signIn }} tail="to add a part." />
                </div>
              ) : (
                <>
                  <div style={card}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="box-page-lines">
                      <tbody>
                        {rows.map(({ l, gone }, i) => (
                          <tr key={`${gone ? 'gone' : 'here'}|${l.partName}|${l.manufacturer ?? ''}`} style={gone ? { background: NOTE_BAND } : undefined} data-testid={gone ? 'box-page-gone' : 'box-page-line'}>
                            <td style={{ padding: '11px 14px', borderTop: i === 0 ? 0 : `1px solid ${HAIR}`, fontSize: 16, lineHeight: 1.3, color: gone ? MUTED : INK }}>
                              {l.partName}
                              {l.manufacturer ? <span style={{ display: 'block', marginTop: 1, color: MUTED, fontSize: 13 }}>{l.manufacturer}</span> : null}
                              {l.cannotFind ? <span style={{ display: 'block', marginTop: 3, color: DUE_WORDS_AMBER, fontSize: 12.5, fontWeight: 600 }} data-testid="box-page-cannot-find">{boxPageCannotFindWords(l.cannotFind)}</span> : null}
                            </td>
                            {gone ? (
                              <td style={{ padding: '11px 14px 11px 0', borderTop: i === 0 ? 0 : `1px solid ${HAIR}`, textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}>
                                <span style={{ display: 'inline-block', fontWeight: 700, fontSize: 12, color: MUTED, border: `1px solid ${HAIR}`, borderRadius: 999, padding: '2px 8px', background: CARD }}>{NONE_LEFT_WORDS}</span>
                              </td>
                            ) : (
                              <td style={{ padding: '11px 14px 11px 0', borderTop: i === 0 ? 0 : `1px solid ${HAIR}`, textAlign: 'right', fontWeight: 800, fontSize: 20, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', width: '1%' }}>{l.onHand}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ ...small, marginTop: 7 }}>These are the app's counts as of right now.</div>
                </>
              )}
            </section>

            {/* The search within reach: "it is not in this one" is the next thought, and everyone can use it. */}
            <section>
              <h2 style={label}>{rows.length > 0 ? `Not in this ${noun}?` : 'Looking for a part?'}</h2>
              <form onSubmit={openFind} style={{ ...card, display: 'flex', alignItems: 'center', gap: 6, padding: 5 }} data-testid="box-page-find-form">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="A part, a maker or a stencil" aria-label="What to find on this site" inputMode="search" style={{ flex: 1, minWidth: 0, minHeight: 44, border: 0, outline: 'none', background: 'transparent', padding: '0 10px', font: 'inherit', fontSize: 17, color: INK }} data-testid="box-page-find-first" />
                <button type="submit" style={{ flex: '0 0 auto', minHeight: 44, minWidth: 76, borderRadius: 10, border: 0, background: '#2563eb', color: '#fff', font: 'inherit', fontWeight: 700, fontSize: 16, cursor: 'pointer' }} data-testid="box-page-find-open-press">Find</button>
              </form>
              <p style={{ ...small, marginTop: 7 }}>Looks in every cage and box on this site.</p>
            </section>

            {/* What a person does next, one row each. The text and the call are links: nothing signed out writes. */}
            <nav aria-label="What you can do next" style={card}>
              {textHref ? (
                <a href={textHref} style={row} data-testid="box-page-text-office">
                  <span aria-hidden style={badge}><IconText /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={rowTitle}>Text the office about {boxPageNoun(payload.box.kind)} {payload.box.stencil}</span>
                    <span style={rowSub}>Something missing or wrong? The text opens with this {noun}'s name in it.</span>
                  </span>
                  <span aria-hidden style={chevron}>›</span>
                </a>
              ) : null}
              {textHref && boxPageCallHref(officePhone) ? (
                <a href={boxPageCallHref(officePhone) ?? undefined} style={{ ...row, borderTop: `1px solid ${HAIR}` }} data-testid="box-page-call-office">
                  <span aria-hidden style={badge}><IconCall /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={rowTitle}>Call the office</span>
                    <span style={{ ...rowSub, fontVariantNumeric: 'tabular-nums' }}>{officePhone}</span>
                  </span>
                  <span aria-hidden style={chevron}>›</span>
                </a>
              ) : null}
              <button type="button" onClick={signIn} style={{ ...row, width: '100%', border: 0, borderRadius: 0, borderTop: textHref ? `1px solid ${HAIR}` : 0, background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer' }} data-testid="box-page-sign-in">
                <span aria-hidden style={badge}><IconCrew /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={rowTitle}>{payload.box.lines.length > 0 ? SIGN_IN_TO_RECORD_WORDS : SIGN_IN_TO_ADD_WORDS}</span>
                  <span style={rowSub}>On Click's crew? Once on this phone.</span>
                </span>
                <span aria-hidden style={chevron}>›</span>
              </button>
            </nav>

            <p style={{ ...small, textAlign: 'center', padding: '10px 12px 0', borderTop: `1px solid ${HAIR}` }}>This {noun} belongs to {COMPANY_WORDS}. The page shows what is in it, not whose job it is.</p>
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

/**
 * The plate's colours (v2.6899, the owner's pick of the navy plate over a paper one): the portal's ink as the ground, white
 * words, a soft white for the small print (8.4:1 on the ink, 7.1:1 on the verdict's band), and the verdict's dot and Due a count
 * in the brighter green and amber that read on navy (amber 7.3:1 on the band), where the paper's own would sink.
 */
const plate = { ground: INK, words: '#fff', soft: 'rgba(255, 255, 255, 0.72)', hair: 'rgba(255, 255, 255, 0.16)', band: 'rgba(255, 255, 255, 0.07)', fresh: '#4ade80', due: '#fbbf24' }

function IconText() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  )
}
function IconCall() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  )
}
function IconCrew() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

const card: React.CSSProperties = { background: CARD, border: `1px solid ${HAIR}`, borderRadius: 14, overflow: 'hidden' }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 11, padding: '12px 12px 12px 13px', minHeight: 60, boxSizing: 'border-box', color: INK, textDecoration: 'none' }
const badge: React.CSSProperties = { flex: '0 0 auto', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: NOTE_BAND, color: INK }
const rowTitle: React.CSSProperties = { display: 'block', fontSize: 15.5, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.005em' }
const rowSub: React.CSSProperties = { display: 'block', marginTop: 2, fontSize: 13, lineHeight: 1.35, color: MUTED }
const chevron: React.CSSProperties = { flex: '0 0 auto', fontSize: 22, lineHeight: 1, color: FAINT }
const press: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, width: '100%', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${HAIR}`, background: CARD, color: INK, font: 'inherit', fontWeight: 700, fontSize: 16, padding: '0 14px', cursor: 'pointer' }
const h1: React.CSSProperties = { margin: '8px 0 6px', fontSize: 22, lineHeight: 1.2, fontWeight: 800 }
const link: React.CSSProperties = { background: 'none', border: 0, color: 'var(--text-link)', fontWeight: 700, font: 'inherit', fontSize: 15, cursor: 'pointer', textDecoration: 'none', textAlign: 'left' }
const para: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 15, lineHeight: 1.5 }
const small: React.CSSProperties = { margin: 0, color: FAINT, fontSize: 12.5, lineHeight: 1.45 }
const label: React.CSSProperties = { margin: '0 0 6px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }
/** Read aloud, never drawn: the kind inside the heading, whose drawn copy is the chip beside the stencil. */
const srOnly: React.CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }
