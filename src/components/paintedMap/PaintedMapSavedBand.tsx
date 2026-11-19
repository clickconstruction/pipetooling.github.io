/**
 * The Saved band (punch list #392, step 3): the map's window says a save landed, where the map is
 * and who can open it, and offers one blue **Text it from my phone…**.
 *
 * The press is the Share sheet's own (#394). With no link out, the phone picks the link's code, so
 * the address is known inside the press: the ask for the link leaves and the phone is handed the
 * Messages address at once, with no wait and no question from the phone's browser. That needs the
 * server's word that a link can be made, asked when the band is drawn. Without it the band makes
 * the link first and then opens Messages, and a phone that refuses that gets the same press again
 * as **Open Messages**. The link is the one the Share sheet shows afterwards, since both keep it
 * under the map's id on this phone.
 *
 * The wait for Messages can end before a slow phone has switched apps. So the band also listens for
 * the page being left, and takes back what it said about Messages not opening (the false note the
 * sheet lost in v2.7863).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { paintedMapLinkOpen, paintedMapLinkUrl, type PaintedMapLinkRow } from '../../lib/paintedMap/paintedMapLink'
import { canMakePaintedMapLink, loadPaintedMapLinks, mintPaintedMapLink, pickPaintedMapLinkCode, registerPaintedMapLink, rememberPaintedMapLink, rememberedPaintedMapLink } from '../../lib/paintedMap/paintedMapLinkIo'
import { PAINTED_MAP_SHARE_SHEET_WORDS as W, paintedMapOwnTextHref } from '../../lib/paintedMap/paintedMapShare'
import { PAINTED_MAP_MESSAGES_LATE_MS, onPageLeft, openPhoneMessages } from '../../lib/paintedMap/paintedMapShareIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PaintedMapShareIcon } from './PaintedMapShareIcon'

export type PaintedMapSavedBandIo = {
  remembered: (mapId: string) => { code: string; endsOn: string | null } | null
  remember: (mapId: string, link: { code: string; endsOn: string | null } | null) => void
  mint: (mapId: string) => Promise<{ code: string; endsOn: string | null }>
  loadLinks: (mapId: string) => Promise<{ ok: true; value: PaintedMapLinkRow[] } | { ok: false; error: string }>
  openMessages: (href: string) => Promise<boolean>
  /** Whether the server would make a link for the map now. Nothing is written. */
  canMake: (mapId: string) => Promise<boolean>
  /** Ten letters this phone picks, so the link's address is known before the server answers. */
  pick: () => string
  /** Share a link under a code this phone picked. The ask leaves before this returns. */
  register: (mapId: string, code: string) => Promise<{ code: string; endsOn: string | null }>
  /** Calls back whenever the page is left or comes back. Returns the call that stops listening. */
  onPageLeft: (listener: () => void) => () => void
}

const realIo: PaintedMapSavedBandIo = { remembered: rememberedPaintedMapLink, remember: rememberPaintedMapLink, mint: mintPaintedMapLink, loadLinks: loadPaintedMapLinks, openMessages: openPhoneMessages, canMake: canMakePaintedMapLink, pick: pickPaintedMapLinkCode, register: registerPaintedMapLink, onPageLeft }

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
  /** The server said a link can be made, so the text may leave inside the press. */
  const [mayHandOff, setMayHandOff] = useState(false)
  /** When the phone was last handed the Messages address, for a page that is left later than the wait. */
  const handedAt = useRef(0)

  const readLinks = useCallback(async () => {
    const res = await io.loadLinks(mapId).catch(() => null)
    if (res?.ok) setLinks(res.value)
  }, [io, mapId])

  // A link this phone holds may have been ended from somewhere else: read once, so the press never texts a dead link.
  useEffect(() => {
    if (offersText && io.remembered(mapId)) void readLinks()
  }, [offersText, io, mapId, readLinks])

  // Asked once, where the press is offered: only then is a text handed over inside the press.
  useEffect(() => {
    if (!offersText) return
    let asking = true
    void io.canMake(mapId).then((yes) => asking && setMayHandOff(yes))
    return () => {
      asking = false
    }
  }, [offersText, io, mapId])

  // A page that is left after a hand-off did open Messages: what the band said about it not opening is taken back.
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

  const press = async () => {
    if (busy.current) return
    busy.current = true
    setError(null)
    setSaid(null)
    try {
      let link = live
      const had = !!link
      if (!link && mayHandOff) {
        // No link is out and the server said one can be made. The ask for it leaves first, then the phone is
        // handed the address, both inside the press: no wait, and no question from the phone's browser.
        const picked = io.pick()
        let reason: string | null = null
        setMaking(true)
        const registered = io
          .register(mapId, picked)
          .then((made) => {
            const kept = { code: made.code, endsOn: made.endsOn }
            io.remember(mapId, kept)
            setLinks(null)
            setMine(kept)
            return kept
          })
          .catch((e: unknown) => {
            reason = formatErrorMessage(e, 'The link was not made.')
            return null
          })
          .finally(() => setMaking(false))
        handedAt.current = Date.now()
        const [left, made] = await Promise.all([io.openMessages(paintedMapOwnTextHref(mapName, paintedMapLinkUrl(origin, picked))), registered])
        // The text is already written. A link that was then refused, lost, or made under another code is not the one in it.
        if (!made) setError(`${reason ?? 'The link was not made.'} ${W.textLinkDead}`)
        else if (made.code !== picked) setError(W.textLinkDead)
        else if (!left) setError(W.noMessages)
        return
      }
      if (!link) {
        setMaking(true)
        try {
          link = await io.mint(mapId)
          io.remember(mapId, link)
          // The list from before the press has no open link in it. It is emptied until it is read again.
          setLinks(null)
          setMine(link)
        } catch (e) {
          setError(formatErrorMessage(e, 'The link was not made.'))
          return
        } finally {
          setMaking(false)
        }
      }
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
          <button type="button" data-painted-saved-text data-painted-saved-at-once={mayHandOff} style={making ? { ...lead, ...dead } : lead} disabled={making} onClick={() => void press()}>
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
