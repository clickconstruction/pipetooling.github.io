/**
 * Where the hover pulse draws (v2.3251): the Bid Board card pulses the pin of
 * the row under the mouse. Pure — given what the canvas is drawing (single
 * pins, or the clustered items at the current zoom) and the pulsed id, it
 * returns the halo's position, color and radius, or null when the id is not
 * on the map. A pin folded into a cluster pulses the cluster disc instead, so
 * the row still points at something.
 */
import { clusterRadiusPx, type ClusterablePin, type ClusteredItem } from './clusterPins'

export type PulseTarget = {
  lat: number
  lng: number
  color: string
  /** Halo radius in px — a little wider than the mark it rings. */
  radiusPx: number
  /** The cluster's id when the pulsed pin is inside one; the pin's id otherwise. */
  markId: string
}

/** Single-pin radius the canvases draw on desktop; the halo starts just outside it. */
const PIN_RADIUS_PX = 8
const HALO_GAP_PX = 6

export function mapPulseTarget<P extends ClusterablePin>(
  pins: readonly P[],
  items: readonly ClusteredItem<P>[] | null,
  pulseId: string | null | undefined,
): PulseTarget | null {
  if (!pulseId) return null
  if (items) {
    for (const it of items) {
      if (it.kind === 'pin') {
        if (it.pin.id === pulseId) return { lat: it.pin.lat, lng: it.pin.lng, color: it.pin.color, radiusPx: PIN_RADIUS_PX + HALO_GAP_PX, markId: it.pin.id }
      } else if (it.cluster.members.some((m) => m.id === pulseId)) {
        const c = it.cluster
        return { lat: c.lat, lng: c.lng, color: c.color, radiusPx: clusterRadiusPx(c.count) + HALO_GAP_PX, markId: c.id }
      }
    }
    return null
  }
  const p = pins.find((x) => x.id === pulseId)
  return p ? { lat: p.lat, lng: p.lng, color: p.color, radiusPx: PIN_RADIUS_PX + HALO_GAP_PX, markId: p.id } : null
}
