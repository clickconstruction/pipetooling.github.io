/**
 * The Saved band (punch list #392, step 3): the map's window says a save landed, where the map is
 * and who can open it, and offers one blue **Text it from my phone…**.
 *
 * The press is the Share sheet's own (#394). The band asks the server once whether a link can be
 * made. On a yes the phone picks the link's code, so the press hands the phone its text at once and
 * the ask for the link leaves inside the same press: Messages opens with the words written and
 * nobody picked, and the phone's browser asks nothing. Without the yes the link is made first and
 * Messages opens after it. A phone may refuse to open another app that long after a press. The band
 * then says the link is ready and the same press, now **Open Messages**, works at once. A slow
 * phone can leave the page after the band stopped waiting for it, so the band listens for the page
 * being left and takes back what it said about Messages not opening. The link it makes is the one
 * the Share sheet shows afterwards, since both keep it under the map's id on this phone.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { paintedMapLinkOpen, paintedMapLinkUrl, type PaintedMapLinkRow } from '../../lib/paintedMap/paintedMapLink'
import { canMakePaintedMapLink, loadPaintedMapLinks, pickPaintedMapLinkCode, registerPaintedMapLink, rememberPaintedMapLink, rememberedPaintedMapLink } from '../../lib/paintedMap/paintedMapLinkIo'
import { PAINTED_MAP_SHARE_SHEET_WORDS as W, paintedMapOwnTextHref } from '../../lib/paintedMap/paintedMapShare'
import { PAINTED_MAP_MESSAGES_LATE_MS, onPageLeft, openPhoneMessages } from '../../lib/paintedMap/paintedMapShareIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PaintedMapShareIcon } from './PaintedMapShareIcon'

export type PaintedMapSavedBandIo = {
  remembered: (mapId: string) => { code: string; endsOn: string | null } | null
  remember: (mapId: string, link: { code: string; endsOn: string | null } | null) => void
  /** Whether a link could be made now, with nothing written. */
  can: (mapId: string) => Promise<boolean>
  /** Ten letters this phone picks, so the link's address is known at the press. */
  pickCode: () => string
  /** Shares a link under that code. The ask leaves before this returns. The code in the answer is the link's. */
  register: (mapId: string, code: string) => Promise<{ code: string; endsOn: string | null }>
  loadLinks: (mapId: string) => Promise<{ ok: true; value: PaintedMapLinkRow[] } | { ok: false; error: string }>
  openMessages: (href: string) => Promise<boolean>
  /** Calls back whenever the page is left or come back to. Returns the way to stop. */
  onPageLeft: (listener: () => void) => () => void
}

const realIo: PaintedMapSavedBandIo = { remembered: rememberedPaintedMapLink, remember: rememberPaintedMapLink, can: canMakePaintedMapLink, pickCode: pickPaintedMapLinkCode, register: registerPaintedMapLink, loadLinks: loadPaintedMapLinks, openMessages: openPhoneMessages, onPageLeft }

type Props = {
  mapId: string
  mapName: string
  /** `Saved on J2417 · Cedar Hollow 12`, and the line under it (`paintedMapSavedWords`). */
  head: string
  under: string
  /** Whether the text press is offered (`paintedMapSavedOffersText`). */
  offersText: boolean
  /** Where links point. The app's own address by default. */
  origin?: string
  /** For a smoke. */
  io?: PaintedMapSavedBandIo
}

const band: CSSProperties = { display: 'grid', gap: '0.15rem', background: 'var(--bg-green-tint)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-green)', borderRadius: 10, padding: '0.5rem 0.7rem', fontSize: '0.875rem', color: 'var(--text-700)' }
/** The one blue press. White words sit on #2563eb, never a paler blue. */
const lead: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', width: '100%', minHeight: 56, padding: '0.4rem 0.8rem', borderRadius: 10, borderWidth: 1, borderStyle: 'solid', borderColor: '#2563eb', background: '#2563eb', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '1.0625rem', cursor: 'pointer' }
const dead: CSSProperties = { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' }
const note: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.45rem 0.6rem' }

export function PaintedMapSavedBand({ mapId, mapName, head, under, offersText, origin = typeof window !== 'undefined' ? window.location.origin : '', io = realIo }: Props) {
  const [mine, setMine] = useState<{ code: string; endsOn: string | null } | null>(() => io.remembered(mapId))
  /** The map's links as last read. `null` until a read lands: a link this phone holds is trusted until then. */
  const [links, setLinks] = useState<PaintedMapLinkRow[] | null>(null)
  const [making, setMaking] = useState(false)
  /** The link was made and the phone did not open Messages by itself: the press reads Open Messages. */
  const [wait, setWait] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  /** When the phone was last handed a text, so a page left soon after counts as that press opening Messages. */
  const handedAt = useRef(0)
  /** The server said a link can be made, so the press may hand the phone its text before the link is back. */
  const [mayHandOff, setMayHandOff] = useState(false)

  const readLinks = useCallback(async () => {
    const res = await io.loadLinks(mapId).catch(() => null)
    if (res?.ok) setLinks(res.value)
  }, [io, mapId])

  // A link this phone holds may have been ended from somewhere else: read once, so the press never texts a dead link.
  useEffect(() => {
    if (offersText && io.remembered(mapId)) void readLinks()
  }, [offersText, io, mapId, readLinks])

  // Asked once, where the press is offered: only on a yes is a text written around a link not yet made.
  useEffect(() => {
    if (!offersText) return
    let on = true
    void io
      .can(mapId)
      .then((yes) => on && setMayHandOff(yes))
      .catch(() => undefined)
    return () => {
      on = false
    }
  }, [offersText, io, mapId])

  // The wait for Messages can end before a slow phone has switched apps. A page that is left after
  // a hand-off did open Messages, so what the band said about it not opening is taken back.
  useEffect(
    () =>
      io.onPageLeft(() => {
        if (Date.now() - handedAt.current > PAINTED_MAP_MESSAGES_LATE_MS) return
        setWait(false)
        setError((words) => (words === W.noMessages ? null : words))
        setSaid((words) => (words === W.ready ? null : words))
      }),
    [io],
  )

  const nowIso = new Date().toISOString()
  const anyOpen = (links ?? []).some((l) => paintedMapLinkOpen(l, nowIso))
  const live = mine && (links === null || anyOpen) ? mine : null

  /** Shares a link under a code this phone picks, and keeps it. The ask leaves before this returns. Nothing when it was not made. */
  const makeLink = (picked: string): Promise<{ code: string; endsOn: string | null } | null> => {
    setMaking(true)
    return io
      .register(mapId, picked)
      .then(
        (made) => {
          const link = { code: made.code, endsOn: made.endsOn }
          io.remember(mapId, link)
          // The list from before the press has no open link in it. It is emptied until it is read again.
          setLinks(null)
          setMine(link)
          return link
        },
        (e: unknown) => {
          setError(formatErrorMessage(e, 'The link was not made.'))
          return null
        },
      )
      .finally(() => setMaking(false))
  }

  const press = async () => {
    if (busy.current) return
    busy.current = true
    setError(null)
    setSaid(null)
    try {
      const had = !!live
      if (!live && mayHandOff) {
        // No link is out and the server said one can be made. The ask for it leaves first, then the phone
        // is handed the address, both inside the press: no wait, and no question from the phone's browser.
        const picked = io.pickCode()
        const made = makeLink(picked)
        handedAt.current = Date.now()
        const [left, link] = await Promise.all([io.openMessages(paintedMapOwnTextHref(mapName, paintedMapLinkUrl(origin, picked))), made])
        // The text is already written. A link that was then refused, lost, or made under another code is not the one in it.
        if (!link) setError((reason) => `${reason ?? 'The link was not made.'} ${W.textLinkDead}`)
        else if (link.code !== picked) setError(W.textLinkDead)
        else if (!left) setError(W.noMessages)
        return
      }
      const link = live ?? (await makeLink(io.pickCode()))
      if (!link) return
      handedAt.current = Date.now()
      const went = await io.openMessages(paintedMapOwnTextHref(mapName, paintedMapLinkUrl(origin, link.code)))
      if (went) {
        setWait(false)
      } else if (had) {
        // The link was already made, so nothing stood between the press and Messages: this phone will not open it.
        setWait(false)
        setError(W.noMessages)
      } else {
        setWait(true)
        setSaid(W.ready)
      }
    } finally {
      busy.current = false
    }
  }

  return (
    <div data-painted-saved style={{ display: 'grid', gap: '0.5rem' }}>
      <div role="status" style={band}>
        <b style={{ color: 'var(--text-green-700)', fontSize: '0.9375rem' }}>✓ {head}</b>
        <span>{under}</span>
      </div>
      {offersText ? (
        <>
          <button type="button" data-painted-saved-text style={making ? { ...lead, ...dead } : lead} disabled={making} onClick={() => void press()}>
            {making ? (
              W.making
            ) : (
              <>
                <PaintedMapShareIcon name="text" />
                {wait ? W.openMessages : W.ownText}
              </>
            )}
          </button>
          {said ? <p role="status" data-painted-saved-said style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-green-700)' }}>{said}</p> : null}
          {error ? <p role="alert" style={note}>{error}</p> : null}
        </>
      ) : null}
    </div>
  )
}
