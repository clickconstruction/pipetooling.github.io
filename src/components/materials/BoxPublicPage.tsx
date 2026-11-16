/**
 * The box page (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in. Light, on the
 * portal's paper, as `/pay` and `/e` are; the `box-read` function answers.
 *
 * **What is inside needs a sign-in (v2.7379, Taunya's call of 2026-11-15, drawn from her own picture).** From v2.6797
 * to then the page was the laminated manifest with today's numbers: the place, the newest photo, every part with its
 * count, how fresh the count was, what ran out or could not be found, and a search over every box on that site. All of
 * that told anyone holding a photo of the label what is worth taking and where, so none of it is here now. The page
 * says the box's name as the label prints it on the navy plate (v2.6899), that the material belongs to the company,
 * and how to reach the office: **Ask for a bid**, the office's number, **Text the office about box G81**, **Work with
 * us** and **Sign in to see what is inside**. Every press but the sign-in is a link that opens the phone's own
 * Messages or dialler (the company's number from Settings since v2.7390), so nothing signed out writes to the app. The function sends
 * nothing else, so the page cannot draw what it was not sent.
 *
 * The sign-in writes the box's path into the app's one-shot return key and goes to the sign-in, which lands back on
 * `/b/<code>` with a session, where the route opens the box's screen on the On site tab with its parts and counts.
 *
 * The other answers say what they said. A code no box carries offers the typed code (v2.6868). A retired label names
 * its box and offers another scan and the text (v2.6874). Since v2.7072 (punch list #329) the code may be a sticker's:
 * one on a box draws that box with the sticker's number beside the code; a blank one draws its number, *is not on a
 * box yet*, the sign-in and nothing else; a lost one says so and offers another scan.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { browserReturnAddressStore, keepReturnAddress } from '../../lib/signInReturnAddress'
import { publicFunctionHeaders } from '../../lib/customerSampleMode'
import { BOX_SCAN_PATH, boxPageAddressWords, boxPageBidWords, boxPageCallHref, boxPageCodeWords, boxPageDayWords, boxPageNoun, boxPagePath, boxPageSiteWords, boxPageTextHref, boxPageTextWords, boxPageView, boxPageWorkWords, type BoxPageKind, type BoxPageView } from '../../lib/materials/boxPage'
import { blankStickerTitle, lostStickerTitle, stickerNumberWords } from '../../lib/materials/stickers'
import { CARD, COPPER, HAIR, INK, MUTED, PAPER, PORTAL_FONT } from '../../lib/portal/portalTheme'
import { portalFailure } from '../../lib/portal/portalFailure'
import { PortalFailureNote } from '../portal/PortalFailureNote'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../../lib/publicViewCounting'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

const SIGN_IN_WORDS = 'Sign in to see what is inside'
/** The plate's foot: the box is watched, said to whoever scanned it. */
const WATCHED_WORDS = 'Counted and photographed by its crew.'

/** The sign-in press's work, apart from the page: remember the box, then go to the sign-in. */
function rememberBoxForSignIn(code: string): void {
  // Storage that refuses is swallowed inside: the sign-in still works, and the person opens the box from On site.
  keepReturnAddress(browserReturnAddressStore(), boxPagePath(code))
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
    const sticker = view.kind === 'sticker_blank' || view.kind === 'sticker_lost' ? `Sticker ${stickerNumberWords(view.number)}` : null
    document.title = payload ? `${boxPageNoun(payload.box.kind)} ${payload.box.stencil} · Click Plumbing & Electrical` : `${sticker ?? 'Box label'} · Click Plumbing & Electrical`
  }, [payload, view])

  const signIn = () => {
    rememberBoxForSignIn(code)
    navigate('/sign-in')
  }

  const noun = payload ? boxPageNoun(payload.box.kind, false) : 'box'
  const officePhone = payload?.office?.phone ?? null
  // Three texts to the one number, each opening with its own words. A number a phone cannot dial draws none of them.
  const box = payload?.box
  const textTo = (opening: (kind: BoxPageKind, stencil: string, boxCode: string) => string) => (box ? boxPageTextHref(officePhone, opening(box.kind, box.stencil, box.code)) : null)
  const textHref = textTo(boxPageTextWords)
  const bidHref = textTo(boxPageBidWords)
  const workHref = textTo(boxPageWorkWords)
  const callHref = boxPageCallHref(officePhone)
  const retiredName = view.kind === 'retired' && view.stencil ? `${boxPageNoun(view.boxKind ?? 'box')} ${view.stencil}` : null
  const retiredTextHref = view.kind === 'retired' && view.stencil ? boxPageTextHref(view.phone, boxPageTextWords(view.boxKind ?? 'box', view.stencil, code)) : null

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: PORTAL_FONT, padding: '1.25rem 1rem 3rem', display: 'grid', justifyItems: 'center', alignContent: 'start' }}>
      <main aria-live="polite" style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '1.1rem' }}>
        {payload ? (
          // The label's own address, and that nobody is signed in: why the page says so little.
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: MUTED }}>
            <span style={{ overflowWrap: 'anywhere' }} data-testid="box-page-address">{boxPageAddressWords(payload.box.code)}</span>
            <span style={{ flex: '0 0 auto' }} data-testid="box-page-signed-out">Not signed in</span>
          </div>
        ) : (
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: COPPER }}>Click Plumbing &amp; Electrical</div>
        )}

        {view.kind === 'loading' ? <div style={{ color: MUTED, fontSize: 15 }}>Finding box {words}…</div> : null}

        {payload ? (
          <>
            {/* The plate: the name as the label prints it, large, with the code under it. Nothing of what it holds. */}
            <header style={{ borderRadius: 16, overflow: 'hidden', background: plate.ground, color: plate.words, boxShadow: '0 1px 2px rgba(22, 40, 60, 0.08), 0 10px 24px rgba(22, 40, 60, 0.10)' }}>
              <div style={{ padding: '16px 16px 14px', display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 14, color: plate.soft }} data-testid="box-page-kind">{boxPageSiteWords(payload.box.kind)}</div>
                <h1 style={{ margin: 0, fontSize: payload.box.stencil.length <= 4 ? 46 : payload.box.stencil.length <= 8 ? 32 : 24, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, overflowWrap: 'anywhere', minWidth: 0 }} data-testid="box-page-title">
                  {payload.box.stencil}
                </h1>
                <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, letterSpacing: '0.04em', color: plate.soft }} data-testid="box-page-code">
                  {payload.box.stickerNumber ? <span data-testid="box-page-sticker">Sticker {stickerNumberWords(payload.box.stickerNumber)}, </span> : null}
                  {boxPageCodeWords(payload.box.code)}
                </div>
              </div>
              <div style={{ fontSize: 15, padding: '11px 16px 13px', borderTop: `1px solid ${plate.hair}` }} data-testid="box-page-watched">{WATCHED_WORDS}</div>
            </header>

            {/* Whose it is, and the two ways to reach the company. Both are links: nothing signed out writes. */}
            <section style={{ ...card, padding: '14px 16px 16px', display: 'grid', gap: 4 }} data-testid="box-page-belongs">
              <div style={{ fontSize: 14, color: MUTED }}>This material belongs to</div>
              <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em' }} data-testid="box-page-company">{PORTAL_COMPANY.name}</div>
              <div style={{ fontSize: 15, color: COPPER }}>{PORTAL_COMPANY.cityLine}</div>
              {bidHref || callHref ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {bidHref ? (
                    <a href={bidHref} style={{ ...press, flex: '1 1 140px', width: 'auto', gap: 8, background: INK, borderColor: INK, color: '#fff', textDecoration: 'none' }} data-testid="box-page-bid">
                      <IconText />
                      Ask for a bid
                    </a>
                  ) : null}
                  {callHref ? (
                    <a href={callHref} aria-label={`Call the office, ${officePhone}`} style={{ ...press, flex: '1 1 140px', width: 'auto', gap: 8, borderColor: INK, textDecoration: 'none', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }} data-testid="box-page-call-office">
                      <IconCall />
                      {officePhone}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </section>

            {/* What a person does next, one row each. */}
            <nav aria-label="What you can do next" style={card}>
              {textHref ? (
                <a href={textHref} style={{ ...row, borderBottom: `1px solid ${HAIR}` }} data-testid="box-page-text-office">
                  <span aria-hidden style={badge}><IconWarn /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={rowTitle}>Text the office about {noun} {payload.box.stencil}</span>
                    <span style={rowSub}>Moved, damaged or in the way.</span>
                  </span>
                </a>
              ) : null}
              {workHref ? (
                <a href={workHref} style={{ ...row, borderBottom: `1px solid ${HAIR}` }} data-testid="box-page-work">
                  <span aria-hidden style={badge}><IconCase /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={rowTitle}>Work with us</span>
                    <span style={rowSub}>Plumbers and electricians wanted.</span>
                  </span>
                </a>
              ) : null}
              <button type="button" onClick={signIn} style={{ ...row, width: '100%', border: 0, borderRadius: 0, background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer' }} data-testid="box-page-sign-in">
                <span aria-hidden style={badge}><IconLock /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={rowTitle}>{SIGN_IN_WORDS}</span>
                  <span style={rowSub}>On Click's crew? Once on this phone.</span>
                </span>
              </button>
            </nav>
          </>
        ) : null}

        {view.kind === 'not_found' ? (
          <section data-testid="box-page-not-found">
            <h1 style={h1}>{words ? `${words} is not a box on any job` : 'That is not a box code'}</h1>
            <p style={para}>Check the eight characters under the QR code, or scan the label again.</p>
            <Link to={BOX_SCAN_PATH} style={{ ...press, marginTop: 14, textDecoration: 'none' }} data-testid="box-page-type-code">
              Type the code
            </Link>
          </section>
        ) : null}

        {view.kind === 'retired' ? (
          <section data-testid="box-page-retired">
            <h1 style={h1}>{retiredName ? `${retiredName} was retired` : 'This label is from a box that was retired'}</h1>
            <p style={para}>{view.retiredOn ? `It left the job on ${boxPageDayWords(view.retiredOn)}. ` : ''}Its parts were moved or used before it went. This label can come off.</p>
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

        {/* A sticker on no box yet (v2.7072): its number, the sign-in, and nothing else. */}
        {view.kind === 'sticker_blank' ? (
          <section data-testid="box-page-sticker-blank">
            <h1 style={h1}>{blankStickerTitle(view.number)}</h1>
            <p style={para}>Sign in to say what it is.</p>
            <button type="button" onClick={signIn} style={{ ...press, marginTop: 14 }} data-testid="box-page-sticker-sign-in">
              Sign in
            </button>
          </section>
        ) : null}

        {view.kind === 'sticker_lost' ? (
          <section data-testid="box-page-sticker-lost">
            <h1 style={h1}>{lostStickerTitle(view.number)}</h1>
            <p style={para}>{view.lostOn ? `Someone marked it lost on ${boxPageDayWords(view.lostOn)}. ` : ''}It no longer opens a box.</p>
            <Link to={BOX_SCAN_PATH} style={{ ...press, marginTop: 14, textDecoration: 'none' }} data-testid="box-page-scan-another">
              Scan another label
            </Link>
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

/** The plate's colours (v2.6899, the navy plate): the portal's ink as the ground, white words, a soft white for the small print (8.4:1 on the ink). */
const plate = { ground: INK, words: '#fff', soft: 'rgba(255, 255, 255, 0.72)', hair: 'rgba(255, 255, 255, 0.16)' }

const icon = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function IconText() {
  return (
    <svg {...icon} width={20} height={20}>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 8h8M8 12h5" />
    </svg>
  )
}
function IconCall() {
  return (
    <svg {...icon} width={20} height={20}>
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  )
}
function IconWarn() {
  return (
    <svg {...icon}>
      <path d="M12 3 2.5 20h19z" />
      <path d="M12 10v4M12 17.2v.3" />
    </svg>
  )
}
function IconCase() {
  return (
    <svg {...icon}>
      <rect x="3" y="7.5" width="18" height="12" rx="2.5" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 13h18M12 12v2" />
    </svg>
  )
}
function IconLock() {
  return (
    <svg {...icon}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2" />
    </svg>
  )
}

const card: React.CSSProperties = { background: CARD, border: `1px solid ${HAIR}`, borderRadius: 14, overflow: 'hidden' }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 60, boxSizing: 'border-box', color: INK, textDecoration: 'none' }
const badge: React.CSSProperties = { flex: '0 0 auto', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COPPER }
const rowTitle: React.CSSProperties = { display: 'block', fontSize: 16, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.005em' }
const rowSub: React.CSSProperties = { display: 'block', marginTop: 2, fontSize: 13.5, lineHeight: 1.35, color: MUTED }
const press: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, width: '100%', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${HAIR}`, background: CARD, color: INK, font: 'inherit', fontWeight: 700, fontSize: 16, padding: '0 14px', cursor: 'pointer' }
const h1: React.CSSProperties = { margin: '8px 0 6px', fontSize: 22, lineHeight: 1.2, fontWeight: 800 }
const para: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 15, lineHeight: 1.5 }
