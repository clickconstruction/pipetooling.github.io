/**
 * Pin clustering for the map canvases (v2.3213) — off by default, a per-device
 * toggle on the Bid Board map. No library: pins are projected to Web-Mercator
 * pixels at the map's current zoom and bucketed on a grid; a cell with two or
 * more pins becomes one cluster at the members' center, singletons stay pins.
 * Zoom in and the piles dissolve on their own.
 *
 * A cluster keeps what the piles hide: its disc is the majority section's
 * color, and it wears an outer ring in the most urgent ring color any member
 * carries (red beats amber), so an overdue unsent bid never disappears into a
 * yellow blob.
 *
 * Pure module — no React, no Leaflet, no Google.
 */

export interface ClusterablePin {
  id: string
  lat: number
  lng: number
  color: string
  ringColor?: string | null
  title?: string
}

export interface PinCluster<P extends ClusterablePin> {
  id: string
  lat: number
  lng: number
  count: number
  /** Majority color among members (ties → the first seen). */
  color: string
  /** The most urgent ring among members, by the caller's order; null when none rings. */
  ringColor: string | null
  members: P[]
}

export type ClusteredItem<P extends ClusterablePin> = { kind: 'pin'; pin: P } | { kind: 'cluster'; cluster: PinCluster<P> }

/** Web-Mercator world pixel at a zoom (256-px tiles), the projection both canvases use. */
export function projectToWorldPx(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = 256 * Math.pow(2, zoom)
  const x = ((lng + 180) / 360) * scale
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const sin = Math.sin((clamped * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
  return { x, y }
}

export const CLUSTER_CELL_PX = 44

export interface ClusterOptions {
  cellPx?: number
  /** Ring colors from most to least urgent; a cluster wears the first one any member has. */
  ringPriority?: readonly string[]
}

export function clusterPins<P extends ClusterablePin>(pins: readonly P[], zoom: number, opts: ClusterOptions = {}): ClusteredItem<P>[] {
  const cell = opts.cellPx ?? CLUSTER_CELL_PX
  const cells = new Map<string, P[]>()
  const order: string[] = []
  for (const p of pins) {
    const { x, y } = projectToWorldPx(p.lat, p.lng, zoom)
    const key = `${Math.floor(x / cell)}:${Math.floor(y / cell)}`
    const list = cells.get(key)
    if (list) list.push(p)
    else {
      cells.set(key, [p])
      order.push(key)
    }
  }
  const out: ClusteredItem<P>[] = []
  for (const key of order) {
    const members = cells.get(key)!
    if (members.length === 1) {
      out.push({ kind: 'pin', pin: members[0]! })
      continue
    }
    out.push({ kind: 'cluster', cluster: buildCluster(members, key, opts.ringPriority) })
  }
  return out
}

function buildCluster<P extends ClusterablePin>(members: P[], key: string, ringPriority?: readonly string[]): PinCluster<P> {
  let lat = 0
  let lng = 0
  const colorCount = new Map<string, number>()
  const rings = new Set<string>()
  for (const m of members) {
    lat += m.lat
    lng += m.lng
    colorCount.set(m.color, (colorCount.get(m.color) ?? 0) + 1)
    if (m.ringColor) rings.add(m.ringColor)
  }
  let color = members[0]!.color
  let best = 0
  for (const [c, n] of colorCount) {
    if (n > best) {
      best = n
      color = c
    }
  }
  let ringColor: string | null = null
  if (rings.size > 0) {
    if (ringPriority) ringColor = ringPriority.find((r) => rings.has(r)) ?? [...rings][0] ?? null
    else ringColor = [...rings][0] ?? null
  }
  return {
    id: `cluster:${key}:${members.map((m) => m.id).join(',')}`,
    lat: lat / members.length,
    lng: lng / members.length,
    count: members.length,
    color,
    ringColor,
    members,
  }
}

/** The bounding box a cluster click should frame. */
export function clusterBounds<P extends ClusterablePin>(c: PinCluster<P>): { south: number; west: number; north: number; east: number } {
  let south = Infinity
  let west = Infinity
  let north = -Infinity
  let east = -Infinity
  for (const m of c.members) {
    south = Math.min(south, m.lat)
    north = Math.max(north, m.lat)
    west = Math.min(west, m.lng)
    east = Math.max(east, m.lng)
  }
  return { south, west, north, east }
}

/** Disc radius in px for a cluster: grows gently with the count so 3 and 60 read differently. */
export function clusterRadiusPx(count: number): number {
  return Math.min(22, 12 + Math.round(Math.log2(Math.max(2, count)) * 2))
}

/** `12` · `99+` — what fits in the disc. */
export function clusterLabel(count: number): string {
  return count > 99 ? '99+' : String(count)
}
