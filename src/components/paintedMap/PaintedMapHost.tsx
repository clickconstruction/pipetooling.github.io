/**
 * The one host for painted maps (punch list #345), mounted in the Layout. Any screen asks through
 * `paintedMapDoor`, and this answers with the start sheet or the map's window. The line under a
 * job's address sits inside the job's window and needs no provider above it to open one.
 */
import { useEffect, useState } from 'react'
import { onPaintedMapAsk, type PaintedMapHome } from '../../lib/paintedMap/paintedMapDoor'
import type { PaintedPoint } from '../../lib/paintedMap/paintedLine'
import { PaintAMapStartSheet } from './PaintAMapStartSheet'
import { PaintedMapWindow, type PaintedMapToStart } from './PaintedMapWindow'

type Open =
  | { kind: 'sheet'; home: PaintedMapHome }
  | { kind: 'new'; start: PaintedMapToStart }
  | { kind: 'map'; mapId: string; center: PaintedPoint | null }

export function PaintedMapHost() {
  const [open, setOpen] = useState<Open | null>(null)

  useEffect(
    () =>
      onPaintedMapAsk((ask) => {
        if (ask.kind === 'start') setOpen({ kind: 'sheet', home: ask.home })
        else setOpen({ kind: 'map', mapId: ask.mapId, center: ask.center ?? null })
      }),
    [],
  )

  if (!open) return null
  if (open.kind === 'sheet') return <PaintAMapStartSheet home={open.home} onStart={(start) => setOpen({ kind: 'new', start })} onClose={() => setOpen(null)} />
  if (open.kind === 'new') return <PaintedMapWindow key={open.start.id} ask={{ start: open.start }} center={open.start.home.center ?? null} onClose={() => setOpen(null)} />
  return <PaintedMapWindow key={open.mapId} ask={{ mapId: open.mapId }} center={open.center} onClose={() => setOpen(null)} />
}
