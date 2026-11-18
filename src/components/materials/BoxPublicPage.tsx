/**
 * The box page (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in. Light, on the
 * portal's paper, as `/pay` and `/e` are; the `box-read` function answers.
 *
 * **What is inside needs a sign-in (v2.7379, Taunya's call of 2026-11-15).** From v2.6797 to then the page was the
 * laminated manifest with today's numbers: the place, the newest photo, every part with its count, how fresh the
 * count was, what ran out or could not be found, and a search over every box on that site. All of that told anyone
 * holding a photo of the label what is worth taking and where, so none of it is here now, and the function sends none
 * of it, so the page cannot draw what it was not sent.
 *
 * **The company's card (v2.7405, her drawing of the same evening, `to-dos/prts-box-page/company-card.html`).** One
 * navy plate reads top to bottom: the company's mark, name and tagline, then *Our cage on this site*, the box's name
 * large with its code beside it, and *Counted and photographed by its crew.* Under it **Ask for a bid** (an email to
 * the bids box, which the app reads) and **Call** with the company's number from Settings. Then two rows that each
 * open a sheet with **Send a text** and **Send an email**: *Moved, damaged or in the way?* (*Let us know. Send us a
 * photo and we will work to make it right.*) and *Work with us* (*Always hiring motivated teammates.*). Then **Sign in
 * to see what is inside** in an orange outline, and the website and the company's email at the foot. Every press but
 * the sign-in opens the phone's own Mail, Messages or dialler, so nothing signed out writes to the app.
 *
 * The sign-in writes the box's path into the app's one-shot return key and goes to the sign-in, which lands back on
 * `/b/<code>` with a session, where the route opens the box's screen on the On site tab with its parts and counts.
 *
 * The other answers say what they said. A code no box carries offers the typed code (v2.6868). A retired label names
 * its box and offers another scan and the text (v2.6874). Since v2.7072 (punch list #329) the code may be a sticker's:
 * one on a box draws that box; a reserved one (on no box yet, `blank` in the code) reads *This sticker is reserved
 * for a box*, that it is on none yet, the sign-in and nothing else; a lost one says so and offers another scan.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { useTabTitle } from '../../hooks/useTabTitle'
import { browserReturnAddressStore, keepReturnAddress } from '../../lib/signInReturnAddress'
import { publicFunctionHeaders } from '../../lib/customerSampleMode'
import { KIT_ASSET_PATHS } from '../../lib/brandKit/assets'
import { BOX_PAGE_KNOW_LINE_ES, BOX_PAGE_WEBSITE, BOX_SCAN_PATH, boxPageBidHref, boxPageCallHref, boxPageCodeWords, boxPageDayWords, boxPageEmail, boxPageKnowLine, boxPageNameWords, boxPageNoun, boxPageOursWords, boxPagePath, boxPageSheet, boxPageTextHref, boxPageTextWords, boxPageView, type BoxPageSheet, type BoxPageSheetKind, type BoxPageView } from '../../lib/materials/boxPage'
import { ORANGE_UNDER_WORDS } from '../../lib/orangeUnderWords'
import { BLANK_STICKER_PUBLIC_DETAIL, BLANK_STICKER_TITLE, LOST_STICKER_TITLE } from '../../lib/materials/stickers'
import { CARD, COPPER, HAIR, INK, MUTED, PAPER, PORTAL_FONT } from '../../lib/portal/portalTheme'
import { portalFailure } from '../../lib/portal/portalFailure'
import { PortalFailureNote } from '../portal/PortalFailureNote'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../../lib/publicViewCounting'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

const SIGN_IN_WORDS = 'Sign in to see what is inside'
/** Under the sign-in: who it is for, and that the phone keeps the session. */
const SIGN_IN_FOR_WORDS = "For Click's crew. You stay signed in."
/** The hand-and-wrench mark drawn for a dark ground, from the brand kit. */
const MARK_SRC = `${(import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '')}/${KIT_ASSET_PATHS.mark}`
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
  // The tab reads the box, and reads the app again once the page closes (v2.7630): until then the box's name stayed on
  // the tab through the sign-in and every page after it.
  const stickerTitle = view.kind === 'sticker_blank' ? 'Reserved sticker' : view.kind === 'sticker_lost' ? 'Lost sticker' : null
  useTabTitle(payload ? `${boxPageNoun(payload.box.kind)} ${payload.box.stencil} · Click Plumbing & Electrical` : `${stickerTitle ?? 'Box label'} · Click Plumbing & Electrical`)

  const signIn = () => {
    rememberBoxForSignIn(code)
    navigate('/sign-in')
  }

  const office = payload?.office ?? null
  const officePhone = office?.phone || null
  const box = payload?.box
  // Ask for a bid is an email to the bids box, which the app reads; the call rings the company's number. The two rows
  // each open a sheet with a text and an email. A way the office has no number or address for is not drawn.
  const bid = box ? boxPageBidHref(box, office) : null
  const callHref = boxPageCallHref(officePhone)
  const knowSheet = box ? boxPageSheet('know', box, office) : null
  const workSheet = box ? boxPageSheet('work', box, office) : null
  const footEmail = boxPageEmail(office?.email)

  // The sheet that is open, and the row that opened it, so the focus goes back there when it closes.
  const [openSheet, setOpenSheet] = useState<BoxPageSheetKind | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const open = (kind: BoxPageSheetKind) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOpenSheet(kind)
  }
  const close = useCallback(() => {
    setOpenSheet(null)
    opener.current?.focus()
  }, [])
  const sheet = openSheet === 'know' ? knowSheet : openSheet === 'work' ? workSheet : null
  const retiredName = view.kind === 'retired' && view.stencil ? `${boxPageNoun(view.boxKind ?? 'box')} ${view.stencil}` : null
  const retiredTextHref = view.kind === 'retired' && view.stencil ? boxPageTextHref(view.phone, boxPageTextWords(view.boxKind ?? 'box', view.stencil, code)) : null

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: PORTAL_FONT, padding: '1.25rem 1rem 3rem', display: 'grid', justifyItems: 'center', alignContent: 'start' }}>
      <main aria-live="polite" style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '1.1rem' }}>
        {payload ? null : <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: COPPER }}>Click Plumbing &amp; Electrical</div>}

        {view.kind === 'loading' ? <div style={{ color: MUTED, fontSize: 15 }}>Finding box {words}…</div> : null}

        {payload ? (
          <>
            {/* The plate, one read: whose it is, then which box. Nothing of what it holds. */}
            <header style={{ borderRadius: 16, overflow: 'hidden', background: plate.ground, color: plate.words, boxShadow: '0 1px 2px rgba(22, 40, 60, 0.08), 0 10px 24px rgba(22, 40, 60, 0.10)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 12px' }} data-testid="box-page-belongs">
                <img src={MARK_SRC} alt="" width={54} height={54} style={{ flex: '0 0 auto' }} data-testid="box-page-mark" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.015em' }} data-testid="box-page-company">{PORTAL_COMPANY.name}</div>
                  <div style={{ fontSize: 14, marginTop: 3, color: plate.copper }}>{PORTAL_COMPANY.cityLine}</div>
                </div>
              </div>
              <div style={{ padding: '12px 16px 14px', display: 'grid', gap: 3, borderTop: `1px solid ${plate.hair}` }}>
                <div style={{ fontSize: 13.5, color: plate.soft }} data-testid="box-page-kind">{boxPageOursWords(payload.box.kind)}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '2px 12px' }}>
                  <h1 style={{ margin: 0, fontSize: payload.box.stencil.length <= 4 ? 40 : payload.box.stencil.length <= 8 ? 30 : 24, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.05, overflowWrap: 'anywhere', minWidth: 0 }} data-testid="box-page-title">
                    {boxPageNameWords(payload.box.kind, payload.box.stencil)}
                  </h1>
                  <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, letterSpacing: '0.04em', color: plate.soft }} data-testid="box-page-code">
                    {boxPageCodeWords(payload.box.code)}
                  </div>
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.4, marginTop: 5 }} data-testid="box-page-watched">{WATCHED_WORDS}</div>
              </div>
            </header>

            {/* The two ways to reach the company. Both are links: nothing signed out writes. */}
            {bid || callHref ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {bid ? (
                  <a href={bid.href} style={{ ...press, ...pairPress, background: INK, color: '#fff' }} data-testid="box-page-bid">
                    {bid.by === 'email' ? <IconMail /> : <IconText />}
                    Ask for a bid
                  </a>
                ) : null}
                {callHref ? (
                  <a href={callHref} style={{ ...press, ...pairPress, fontVariantNumeric: 'tabular-nums' }} data-testid="box-page-call-office">
                    <IconCall />
                    Call {officePhone}
                  </a>
                ) : null}
              </div>
            ) : null}

            {/* Two rows, each opening a choice of a text or an email. */}
            {knowSheet || workSheet ? (
              <nav aria-label="Reach the office" style={card}>
                {knowSheet ? (
                  <button type="button" onClick={() => open('know')} aria-haspopup="dialog" style={{ ...rowPress, borderBottom: workSheet ? `1px solid ${HAIR}` : 0 }} data-testid="box-page-know">
                    <span aria-hidden style={badge}><IconWarn /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={rowTitle}>Moved, damaged or in the way?</span>
                      <span style={rowSub}>{boxPageKnowLine(payload.box.kind, payload.box.stencil)}</span>
                      <span lang="es" style={{ ...rowSub, marginTop: 1, fontStyle: 'italic' }}>{BOX_PAGE_KNOW_LINE_ES}</span>
                    </span>
                    <span aria-hidden style={chevron}><IconChevron /></span>
                  </button>
                ) : null}
                {workSheet ? (
                  <button type="button" onClick={() => open('work')} aria-haspopup="dialog" style={rowPress} data-testid="box-page-work">
                    <span aria-hidden style={badge}><IconCase /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={rowTitle}>Work with us</span>
                      <span style={rowSub}>Always hiring motivated teammates.</span>
                    </span>
                    <span aria-hidden style={chevron}><IconChevron /></span>
                  </button>
                ) : null}
              </nav>
            ) : null}

            {/* The crew's own door, outlined so they find it at a glance. */}
            <button type="button" onClick={signIn} style={{ ...rowPress, background: CARD, border: `2px solid ${ORANGE_UNDER_WORDS}`, borderRadius: 14 }} data-testid="box-page-sign-in">
              <span aria-hidden style={{ ...badge, color: ORANGE_UNDER_WORDS }}><IconLock /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={rowTitle}>{SIGN_IN_WORDS}</span>
                <span style={rowSub}>{SIGN_IN_FOR_WORDS}</span>
              </span>
              <span aria-hidden style={{ ...chevron, color: ORANGE_UNDER_WORDS }}><IconChevron /></span>
            </button>

            <footer style={{ textAlign: 'center', fontSize: 13.5, lineHeight: 1.5, color: INK }} data-testid="box-page-foot">
              <a href={`https://${BOX_PAGE_WEBSITE}`} style={footLink}>{BOX_PAGE_WEBSITE}</a>
              {footEmail ? (
                <>
                  {' · '}
                  <a href={`mailto:${footEmail}`} style={footLink}>{footEmail}</a>
                </>
              ) : null}
            </footer>

            {sheet ? <ReachSheet sheet={sheet} onClose={close} /> : null}
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

        {/* A reserved sticker, on no box yet (v2.7072): that it is reserved and on none, the sign-in, and nothing else. */}
        {view.kind === 'sticker_blank' ? (
          <section data-testid="box-page-sticker-blank">
            <h1 style={h1}>{BLANK_STICKER_TITLE}</h1>
            <p style={para}>{BLANK_STICKER_PUBLIC_DETAIL}</p>
            <button type="button" onClick={signIn} style={{ ...press, marginTop: 14 }} data-testid="box-page-sticker-sign-in">
              Sign in
            </button>
          </section>
        ) : null}

        {view.kind === 'sticker_lost' ? (
          <section data-testid="box-page-sticker-lost">
            <h1 style={h1}>{LOST_STICKER_TITLE}</h1>
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

/**
 * The sheet a row opens (v2.7405): its words, **Send a text** and **Send an email**, and *Not now*. Each choice is a
 * link to the phone's own app, and pressing one closes the sheet. Escape and a press outside close it too.
 */
function ReachSheet({ sheet, onClose }: { sheet: BoxPageSheet; onClose: () => void }) {
  const first = useRef<HTMLAnchorElement | null>(null)
  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', alignItems: 'end', justifyItems: 'center', paddingTop: 'var(--app-top-chrome, 0px)' }} data-testid="box-page-sheet">
      <button type="button" aria-label="Not now" onClick={onClose} style={{ position: 'absolute', inset: 0, border: 0, padding: 0, background: 'rgba(22, 40, 60, 0.46)', cursor: 'pointer' }} data-testid="box-page-sheet-backdrop" />
      <div role="dialog" aria-modal="true" aria-labelledby="box-page-sheet-title" style={{ position: 'relative', width: '100%', maxWidth: 452, boxSizing: 'border-box', background: PAPER, color: INK, borderRadius: '22px 22px 0 0', padding: '10px 18px 22px', boxShadow: '0 -10px 30px rgba(22, 40, 60, 0.25)', display: 'grid', gap: 10 }}>
        <div aria-hidden style={{ width: 40, height: 5, borderRadius: 3, background: HAIR, justifySelf: 'center', marginBottom: 4 }} />
        <h2 id="box-page-sheet-title" style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-0.015em' }} data-testid="box-page-sheet-title">{sheet.title}</h2>
        <p style={{ margin: '-4px 0 4px', fontSize: 15, lineHeight: 1.4, color: MUTED }} data-testid="box-page-sheet-words">{sheet.words}</p>
        {sheet.textHref ? (
          <a ref={first} href={sheet.textHref} onClick={onClose} style={{ ...choice, background: INK, color: '#fff' }} data-testid="box-page-sheet-text">
            <IconText />
            <span>
              <span style={choiceTitle}>Send a text</span>
              <span style={{ ...choiceSub, color: plate.soft }}>{sheet.phone}</span>
            </span>
          </a>
        ) : null}
        {sheet.mailHref ? (
          <a ref={sheet.textHref ? undefined : first} href={sheet.mailHref} onClick={onClose} style={choice} data-testid="box-page-sheet-email">
            <IconMail />
            <span style={{ minWidth: 0 }}>
              <span style={choiceTitle}>Send an email</span>
              <span style={{ ...choiceSub, color: MUTED, overflowWrap: 'anywhere' }}>{sheet.email}</span>
            </span>
          </a>
        ) : null}
        <button type="button" onClick={onClose} style={{ justifySelf: 'center', border: 0, background: 'none', font: 'inherit', fontSize: 15, fontWeight: 600, color: MUTED, padding: '6px 12px 0', cursor: 'pointer' }} data-testid="box-page-sheet-not-now">
          Not now
        </button>
      </div>
    </div>
  )
}

/** The plate's colours (v2.6899, the navy plate): the portal's ink as the ground, white words, a soft white for the small print (8.4:1 on the ink), and the tagline's copper lifted to read on the ink (7.6:1). */
const plate = { ground: INK, words: '#fff', soft: 'rgba(255, 255, 255, 0.72)', hair: 'rgba(255, 255, 255, 0.16)', copper: '#f0a878' }

const icon = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function IconText() {
  return (
    <svg {...icon} width={20} height={20}>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 8h8M8 12h5" />
    </svg>
  )
}
function IconMail() {
  return (
    <svg {...icon} width={20} height={20}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7.5 12 13l8.5-5.5" />
    </svg>
  )
}
function IconChevron() {
  return (
    <svg {...icon} width={18} height={18} strokeWidth={2}>
      <path d="m9 6 6 6-6 6" />
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
/** A row that is a press: the row's own look on a button. */
const rowPress: React.CSSProperties = { ...row, width: '100%', border: 0, borderRadius: 0, background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer' }
const chevron: React.CSSProperties = { flex: '0 0 auto', display: 'flex', color: MUTED }
const footLink: React.CSSProperties = { color: INK, textDecoration: 'none' }
const choice: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, boxSizing: 'border-box', borderRadius: 14, border: `1px solid ${INK}`, background: CARD, color: INK, padding: '9px 14px', textDecoration: 'none' }
const choiceTitle: React.CSSProperties = { display: 'block', fontSize: 16.5, fontWeight: 700 }
const choiceSub: React.CSSProperties = { display: 'block', fontSize: 13.5, marginTop: 1, fontVariantNumeric: 'tabular-nums' }
const badge: React.CSSProperties = { flex: '0 0 auto', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COPPER }
const rowTitle: React.CSSProperties = { display: 'block', fontSize: 16, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.005em' }
const rowSub: React.CSSProperties = { display: 'block', marginTop: 2, fontSize: 13.5, lineHeight: 1.35, color: MUTED }
const press: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, width: '100%', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${HAIR}`, background: CARD, color: INK, font: 'inherit', fontWeight: 700, fontSize: 16, padding: '0 14px', cursor: 'pointer' }
/** The bid and the call side by side on a phone 390 wide, each on its own line on a narrower one: the words never wrap inside a press. */
const pairPress: React.CSSProperties = { flex: '1 1 auto', width: 'auto', gap: 6, padding: '0 10px', fontSize: 15.5, borderColor: INK, textDecoration: 'none', whiteSpace: 'nowrap' }
const h1: React.CSSProperties = { margin: '8px 0 6px', fontSize: 22, lineHeight: 1.2, fontWeight: 800 }
const para: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 15, lineHeight: 1.5 }
