/**
 * The Saved band (punch list #392, step 3): the map's window says a save landed, where the map is
 * and who can open it, and offers one blue **Text it from my phone…**.
 *
 * The press is the Share sheet's own (#394): it makes the link when this phone holds none, then
 * opens the phone's Messages with the words written and nobody picked. A phone may refuse to open
 * another app about a second after a press. The band then says the link is ready and the same
 * press, now **Open Messages**, works at once. The link it makes is the one the Share sheet shows
 * afterwards, since both keep it under the map's id on this phone.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { paintedMapLinkOpen, paintedMapLinkUrl, type PaintedMapLinkRow } from '../../lib/paintedMap/paintedMapLink'
import { loadPaintedMapLinks, mintPaintedMapLink, rememberPaintedMapLink, rememberedPaintedMapLink } from '../../lib/paintedMap/paintedMapLinkIo'
import { PAINTED_MAP_SHARE_SHEET_WORDS as W, paintedMapOwnTextHref } from '../../lib/paintedMap/paintedMapShare'
import { openPhoneMessages } from '../../lib/paintedMap/paintedMapShareIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PaintedMapShareIcon } from './PaintedMapShareIcon'

export type PaintedMapSavedBandIo = {
  remembered: (mapId: string) => { code: string; endsOn: string | null } | null
  remember: (mapId: string, link: { code: string; endsOn: string | null } | null) => void
  mint: (mapId: string) => Promise<{ code: string; endsOn: string | null }>
  loadLinks: (mapId: string) => Promise<{ ok: true; value: PaintedMapLinkRow[] } | { ok: false; error: string }>
  openMessages: (href: string) => Promise<boolean>
}

const realIo: PaintedMapSavedBandIo = { remembered: rememberedPaintedMapLink, remember: rememberPaintedMapLink, mint: mintPaintedMapLink, loadLinks: loadPaintedMapLinks, openMessages: openPhoneMessages }

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

  const readLinks = useCallback(async () => {
    const res = await io.loadLinks(mapId).catch(() => null)
    if (res?.ok) setLinks(res.value)
  }, [io, mapId])

  // A link this phone holds may have been ended from somewhere else: read once, so the press never texts a dead link.
  useEffect(() => {
    if (offersText && io.remembered(mapId)) void readLinks()
  }, [offersText, io, mapId, readLinks])

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
