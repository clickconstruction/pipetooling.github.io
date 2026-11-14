/**
 * The one host for painted maps (punch list #345), mounted in the Layout. Any screen asks through
 * `paintedMapDoor`, and this answers with the start sheet or the map's window. The line under a
 * job's address sits inside the job's window and needs no provider above it to open one.
 *
 * It also offers back a walk that was never saved. A walk is kept on the phone while it is painted,
 * so a reload or a trip to the camera does not lose it, and the readings in it are the one thing
 * here that says where a person was and when. So it is never left lying there unseen: the app says
 * it is on the phone, offers to look it over or throw it away, and drops it after a day.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import { useAuth } from '../../hooks/useAuth'
import { readKeptWalkRaw, writeKeptWalk } from '../../hooks/usePaintedWalk'
import { onPaintedMapAsk, type PaintedMapHome } from '../../lib/paintedMap/paintedMapDoor'
import { readKeptWalk, walkHasLine, type KeptWalk } from '../../lib/paintedMap/paintedWalk'
import { keptWalkWords } from '../../lib/paintedMap/paintedWalkWords'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { PaintAMapStartSheet } from './PaintAMapStartSheet'
import { PaintedMapWindow, type KeptPaintedWalk, type PaintedMapToStart } from './PaintedMapWindow'

type Open =
  | { kind: 'sheet'; home: PaintedMapHome }
  | { kind: 'new'; start: PaintedMapToStart }
  | { kind: 'map'; mapId: string; address: string | null }
  | { kind: 'kept'; kept: KeptWalk<KeptPaintedWalk> }

const press: CSSProperties = { minHeight: 40, padding: '0 0.8rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }

export function PaintedMapHost() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [open, setOpen] = useState<Open | null>(null)
  const [offer, setOffer] = useState<KeptWalk<KeptPaintedWalk> | null>(null)
  const [throwing, setThrowing] = useState(false)

  useEffect(
    () =>
      onPaintedMapAsk((ask) => {
        if (ask.kind === 'start') setOpen({ kind: 'sheet', home: ask.home })
        else setOpen({ kind: 'map', mapId: ask.mapId, address: ask.address ?? null })
      }),
    [],
  )

  // What the phone keeps, read whenever no map is open: on arrival, and after a window closes.
  const readOffer = useCallback(() => {
    if (!userId) {
      setOffer(null)
      return
    }
    const kept = readKeptWalk<KeptPaintedWalk>(readKeptWalkRaw(userId), Date.now())
    const worth = !!kept && typeof kept.map?.mapId === 'string' && ((kept.map.pending?.length ?? 0) > 0 || (!!kept.state && walkHasLine(kept.state)))
    // A day old, mangled, or with no line in it: it is not offered, and it is not left on the phone either.
    if (!worth && readKeptWalkRaw(userId)) writeKeptWalk(userId, null)
    setOffer(worth ? kept : null)
  }, [userId])

  useEffect(() => {
    if (!open) readOffer()
  }, [open, readOffer])

  if (open?.kind === 'sheet') return <PaintAMapStartSheet home={open.home} onStart={(start) => setOpen({ kind: 'new', start })} onClose={() => setOpen(null)} />
  if (open?.kind === 'new') return <PaintedMapWindow key={open.start.id} ask={{ start: open.start }} address={open.start.home.address ?? null} center={open.start.home.center ?? null} onClose={() => setOpen(null)} />
  if (open?.kind === 'map') return <PaintedMapWindow key={open.mapId} ask={{ mapId: open.mapId }} address={open.address} onClose={() => setOpen(null)} />
  if (open?.kind === 'kept') {
    const { map, state } = open.kept
    return <PaintedMapWindow key={`kept-${map.mapId}`} ask={map.start ? { start: map.start } : { mapId: map.mapId }} kept={{ state, pending: map.pending ?? [] }} address={map.address ?? null} onClose={() => setOpen(null)} />
  }
  if (!offer || !userId) return null

  const at = new Date(offer.savedAtMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
  return (
    <>
      <div data-painted-walk-kept role="status" style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', zIndex: 760, margin: '0 auto', maxWidth: 520, background: 'var(--surface)', color: 'var(--text-strong)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-amber)', borderRadius: 12, boxShadow: '0 6px 22px rgba(0,0,0,.22)', padding: '0.65rem 0.8rem', display: 'grid', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.875rem' }}>{keptWalkWords(at)}</span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" style={{ ...press, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }} onClick={() => setOpen({ kind: 'kept', kept: offer })}>
            Look it over
          </button>
          <button type="button" style={press} onClick={() => setThrowing(true)}>
            Throw it away
          </button>
        </div>
      </div>
      {throwing ? (
        <ConfirmDialog
          title="Throw the walk away?"
          body="What you painted goes from this phone. Nothing was sent anywhere, so nothing is left behind."
          confirmLabel="Throw the walk away"
          cancelLabel="Keep it"
          onConfirm={() => {
            writeKeptWalk(userId, null)
            setThrowing(false)
            setOffer(null)
          }}
          onCancel={() => setThrowing(false)}
        />
      ) : null}
    </>
  )
}
