/**
 * Share a painted map (punch list #345, PR 4): one sheet for the link. A link shows the map to
 * anyone who holds it, with no sign-in, stays current when the map is added to, and can be ended.
 * The sheet says what a reader sees and does not, before the link goes anywhere.
 *
 * The code is handed out once and the table keeps only its hash. So the device that made a link
 * remembers it, to show it again, and any other device makes a link of its own.
 */
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import ConfirmDialog from '../ConfirmDialog'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { PAINTED_MAP_SHARE_WORDS, linkDayWords, linkEndsWords, linkOpenedWords, paintedMapLinkOpen, paintedMapLinkUrl, type PaintedMapLinkRow } from '../../lib/paintedMap/paintedMapLink'
import type { NumberedPlace, PaintedLine } from '../../lib/paintedMap/paintedMap'
import { endPaintedMapLinks, loadPaintedMapLinks, mintPaintedMapLink, rememberPaintedMapLink, rememberedPaintedMapLink } from '../../lib/paintedMap/paintedMapLinkIo'
import { PaintedMapCopies } from './PaintedMapCopies'
import { PAINTED_MAP_SHEET_Z } from '../../lib/windowLayers'
import { formatErrorMessage } from '../../utils/errorHandling'

type Props = {
  mapId: string
  mapName: string
  /** The map with its lines and places, for a copy: a picture, a page to print. Left out, the sheet offers the link alone. */
  whole?: { map: { id: string; name: string; words: string; jobId: string | null }; lines: ReadonlyArray<PaintedLine>; places: ReadonlyArray<NumberedPlace> } | null
  onClose: () => void
  /** Where links point. The app's own address by default. */
  origin?: string
}

const press: CSSProperties = { minHeight: 48, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }
const bluePress: CSSProperties = { ...press, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const deadPress: CSSProperties = { ...press, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' }
const rowPress: CSSProperties = { display: 'grid', gap: '0.1rem', width: '100%', textAlign: 'left', padding: '0.55rem 0.7rem', borderRadius: 9, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer' }
const note: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.45rem 0.6rem' }

export function PaintedMapShareSheet({ mapId, mapName, whole = null, onClose, origin = typeof window !== 'undefined' ? window.location.origin : '' }: Props) {
  const isTopmost = useModalStackEntry()
  const [mine, setMine] = useState<{ code: string; endsOn: string | null } | null>(() => rememberedPaintedMapLink(mapId))
  const [links, setLinks] = useState<PaintedMapLinkRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [ending, setEnding] = useState(false)

  const readLinks = useCallback(async () => {
    const res = await loadPaintedMapLinks(mapId)
    if (res.ok) setLinks(res.value)
    else setError(res.error)
  }, [mapId])

  useEffect(() => {
    void readLinks()
  }, [readLinks])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopmost()) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isTopmost, onClose])

  const nowIso = new Date().toISOString()
  const open = (links ?? []).filter((l) => paintedMapLinkOpen(l, nowIso))
  // The link this device remembers is shown only while a link of the map is still open: ended from elsewhere, it is forgotten.
  const live = mine && (links === null || open.length > 0) ? mine : null
  const url = live ? paintedMapLinkUrl(origin, live.code) : null
  const opened = open.reduce((sum, l) => sum + (l.open_count ?? 0), 0)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    if (mine && links !== null && open.length === 0) {
      rememberPaintedMapLink(mapId, null)
      setMine(null)
    }
  }, [mine, links, open.length, mapId])

  const make = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    setSaid(null)
    try {
      const made = await mintPaintedMapLink(mapId)
      rememberPaintedMapLink(mapId, made)
      // The list is read before the link is shown: against the list from before the press, a link
      // just made would look like one ended elsewhere and be forgotten.
      const res = await loadPaintedMapLinks(mapId)
      if (res.ok) setLinks(res.value)
      else setLinks(null)
      setMine(made)
    } catch (e) {
      setError(formatErrorMessage(e, 'The link was not made.'))
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!url) return
    setError(null)
    try {
      await navigator.clipboard.writeText(url)
      setSaid('Copied. Paste it into a text or an email.')
    } catch {
      setError('This browser would not copy the link. Press and hold the link to copy it.')
    }
  }

  const sendAnotherWay = async () => {
    if (!url) return
    setError(null)
    try {
      await navigator.share({ title: mapName, text: mapName, url })
    } catch {
      // Closed without sending: nothing to say.
    }
  }

  const end = async () => {
    setEnding(false)
    if (busy) return
    setBusy(true)
    setError(null)
    setSaid(null)
    try {
      const n = await endPaintedMapLinks(mapId)
      rememberPaintedMapLink(mapId, null)
      setMine(null)
      setShowCode(false)
      setSaid(n === 1 ? 'The link is ended. Anyone who opens it now reads that the map is no longer shared.' : `${n} links are ended. Anyone who opens one now reads that the map is no longer shared.`)
      await readLinks()
    } catch (e) {
      setError(formatErrorMessage(e, 'The link was not ended.'))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <>
      <div
        data-painted-map-share
        style={{ position: 'fixed', inset: 0, zIndex: PAINTED_MAP_SHEET_Z, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'env(safe-area-inset-top, 0px) 0 0' }}
        onClick={(e) => {
          // The map's window sits behind: this press closes the sheet alone.
          e.stopPropagation()
          onClose()
        }}
      >
        <div role="dialog" aria-modal="true" aria-label="Share this map" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-strong)', width: '100%', maxWidth: 520, maxHeight: '100%', overflowY: 'auto', borderTopLeftRadius: 14, borderTopRightRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Share this map</h2>
            <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9375rem', minHeight: 40, padding: '0 0.25rem' }}>
              Close
            </button>
          </div>
          <div style={{ display: 'grid', gap: '0.7rem', padding: '0.85rem 1rem calc(0.95rem + env(safe-area-inset-bottom, 0px))' }}>
            <p style={{ margin: 0, fontSize: '0.9375rem' }}>{PAINTED_MAP_SHARE_WORDS.open}</p>
            {error ? <p role="alert" style={note}>{error}</p> : null}
            {said ? <p role="status" data-painted-share-said style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-green-700)' }}>{said}</p> : null}

            {url && live ? (
              <>
                <div data-painted-share-link style={{ font: '600 0.875rem/1.3 ui-monospace, SFMono-Regular, Menlo, monospace', background: 'var(--bg-muted)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 8, padding: '0.55rem 0.65rem', overflowWrap: 'anywhere', userSelect: 'all' }}>{url.replace(/^https?:\/\//, '')}</div>
                <button type="button" style={{ ...bluePress, minHeight: 52 }} onClick={() => void copy()}>
                  Copy the link
                </button>
                {canShare ? (
                  <button type="button" style={rowPress} onClick={() => void sendAnotherWay()}>
                    Send it another way…
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }}>A text, mail, a group chat or a phone nearby</span>
                  </button>
                ) : null}
                <button type="button" style={rowPress} aria-expanded={showCode} onClick={() => setShowCode((on) => !on)}>
                  {showCode ? 'Hide the code' : 'Show a code to scan'}
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }}>For someone standing beside you</span>
                </button>
                {showCode ? (
                  // A scanner needs dark on white: this panel stays light in both themes.
                  <div data-theme="light" data-painted-share-code style={{ display: 'grid', justifyItems: 'center', gap: '0.4rem', padding: '0.9rem', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-strong)' }}>
                    <QRCodeSVG value={url} size={220} level="M" marginSize={2} title={`A code that opens ${mapName}`} />
                    <b>Point a phone’s camera here</b>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>It opens the map. No app, no sign-in.</span>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {open.length > 0 ? <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)' }}>This map already has {open.length === 1 ? 'a link' : `${open.length} links`} out. A link can be read only on the device that made it, so make one here to send from this device.</p> : null}
                <button type="button" data-painted-share-make style={busy ? { ...deadPress, minHeight: 52 } : { ...bluePress, minHeight: 52 }} disabled={busy} onClick={() => void make()}>
                  {busy ? 'Making the link…' : 'Make a link'}
                </button>
              </>
            )}

            <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', background: 'var(--bg-muted)', borderRadius: 8, padding: '0.5rem 0.65rem', display: 'grid', gap: '0.2rem' }}>
              <span>{PAINTED_MAP_SHARE_WORDS.see}</span>
              <span>{PAINTED_MAP_SHARE_WORDS.notSee}</span>
            </div>

            {open.length > 0 ? (
              <div data-painted-share-state style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                <span>
                  {open.length === 1 ? 'One link is out' : `${open.length} links are out`}
                  {linkDayWords(open[open.length - 1]?.made_at.slice(0, 10)) ? `, since ${linkDayWords(open[open.length - 1]?.made_at.slice(0, 10))}` : ''}. {linkOpenedWords(opened)}.
                </span>
                {live ? <span>{linkEndsWords(live.endsOn)}</span> : null}
                <button type="button" style={busy ? deadPress : press} disabled={busy} onClick={() => setEnding(true)}>
                  {open.length === 1 ? 'End this link now' : `End all ${open.length} links now`}
                </button>
              </div>
            ) : null}

            {whole ? <PaintedMapCopies map={whole.map} lines={whole.lines} places={whole.places} link={url && live ? { url, endsOn: live.endsOn } : null} /> : null}
          </div>
        </div>
      </div>
      {ending ? (
        <ConfirmDialog
          zIndex={PAINTED_MAP_SHEET_Z + 60}
          title={open.length === 1 ? 'End this link?' : `End all ${open.length} links?`}
          body="Anyone who opens it after this reads that the map is no longer shared. A copy they already saved is theirs to keep."
          confirmLabel={open.length === 1 ? 'End the link' : `End the ${open.length} links`}
          cancelLabel="Keep it"
          onConfirm={() => void end()}
          onCancel={() => setEnding(false)}
        />
      ) : null}
    </>,
    document.fullscreenElement ?? document.body,
  )
}
