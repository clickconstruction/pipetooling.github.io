/**
 * The Map page's pins for the shared pins canvas (v2.4796, Map page refresh
 * PR 2). Pure: the page's entities with coordinates in, `MapCanvasPin`s out.
 * A pin id is `${kind}-${id}` so a job and a bid can share a record id. The
 * color is the kind's (jobs blue, bids orange, estimates green) — the status
 * colors come with PR 2b — except in builder focus (`/map?builder=`), where a
 * bid takes its outcome color for that GC, as before.
 */
import type { MapCanvasPin } from './mapCanvasTypes'
import { BID_STAGE_MARKER_COLOR } from './builderBidMapFocus'
import { bidBoardMapDirectionsUrl } from '../bids/bidBoardMap'
import type { SubmissionSectionKey } from '../bids/submissionSections'

export type MapPagePinKind = 'job' | 'bid' | 'estimate'

export type MapPagePinSource = {
  kind: MapPagePinKind
  id: string
  lat: number
  lng: number
  tableLabel: string
  sublabel: string
}

export const MAP_PAGE_KIND_COLOR: Record<MapPagePinKind, string> = {
  job: '#2563eb',
  bid: '#ea580c',
  estimate: '#16a34a',
}

export const MAP_PAGE_KIND_LABEL: Record<MapPagePinKind, string> = {
  job: 'Jobs',
  bid: 'Bids',
  estimate: 'Estimates',
}

export function mapPagePinId(e: { kind: MapPagePinKind; id: string }): string {
  return `${e.kind}-${e.id}`
}

/** "Vasquez pretest · J1419" — the pin's hover title. */
export function mapPagePinTitle(e: { tableLabel: string; sublabel: string }): string {
  const sub = e.sublabel.trim()
  return sub ? `${e.tableLabel} · ${sub}` : e.tableLabel
}

export function mapPagePins<T extends MapPagePinSource>(
  entities: readonly T[],
  opts: { builderFocus: boolean; focusSection: (e: T) => SubmissionSectionKey | undefined },
): MapCanvasPin[] {
  return entities.map((e) => {
    const fs = e.kind === 'bid' && opts.builderFocus ? opts.focusSection(e) : undefined
    return {
      id: mapPagePinId(e),
      lat: e.lat,
      lng: e.lng,
      color: fs ? BID_STAGE_MARKER_COLOR[fs] : MAP_PAGE_KIND_COLOR[e.kind],
      title: mapPagePinTitle(e),
    }
  })
}

/** The pins by id, for the popup and the phone bar. */
export function mapPageEntitiesByPinId<T extends { kind: MapPagePinKind; id: string }>(entities: readonly T[]): Map<string, T> {
  return new Map(entities.map((e) => [mapPagePinId(e), e]))
}

/** Google Maps, ready to navigate — the same link the cards use. */
export const mapPageDirectionsUrl = bidBoardMapDirectionsUrl
