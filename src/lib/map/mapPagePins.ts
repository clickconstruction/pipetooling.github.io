/**
 * The Map page's pins for the shared pins canvas (v2.4796, Map page refresh
 * PR 2; status colors v2.4802). Pure: the page's entities with coordinates
 * in, `MapCanvasPin`s out. A pin id is `${kind}-${id}` so a job and a bid can
 * share a record id. A job takes its Pipeline section's color and the red
 * ring in Collections; a bid its Bid Board section's color and the due ring —
 * in builder focus (`/map?builder=`) its outcome color for that GC; an
 * estimate is violet. A record with no section is grey.
 */
import type { MapCanvasPin } from './mapCanvasTypes'
import { BID_STAGE_MARKER_COLOR } from './builderBidMapFocus'
import { bidBoardMapDirectionsUrl } from '../bids/bidBoardMap'
import type { SubmissionSectionKey } from '../bids/submissionSections'
import {
  BID_BOARD_MAP_DUE_RING_COLOR,
  JOBS_MAP_COLLECTIONS_RING_COLOR,
  JOBS_MAP_SECTION_COLOR,
  MAP_PAGE_ESTIMATE_COLOR,
  MAP_PAGE_UNKNOWN_COLOR,
  type BidBoardMapDueTone,
  type JobsMapSection,
} from './mapPageSections'

export type MapPagePinKind = 'job' | 'bid' | 'estimate'

export type MapPagePinSource = {
  kind: MapPagePinKind
  id: string
  lat: number
  lng: number
  tableLabel: string
  sublabel: string
  jobSection?: JobsMapSection | null
  inCollections?: boolean
  bidSection?: SubmissionSectionKey
  bidDueTone?: BidBoardMapDueTone | null
}

/** The kind's own color, for a record with no section (and the table's dots). */
export const MAP_PAGE_KIND_COLOR: Record<MapPagePinKind, string> = {
  job: MAP_PAGE_UNKNOWN_COLOR,
  bid: MAP_PAGE_UNKNOWN_COLOR,
  estimate: MAP_PAGE_ESTIMATE_COLOR,
}

/** The pin's fill and ring for one record. */
export function mapPagePinColors(e: MapPagePinSource, focusSection?: SubmissionSectionKey): { color: string; ringColor: string | null } {
  if (e.kind === 'estimate') return { color: MAP_PAGE_ESTIMATE_COLOR, ringColor: null }
  if (e.kind === 'job') {
    return {
      color: e.jobSection ? JOBS_MAP_SECTION_COLOR[e.jobSection] : MAP_PAGE_UNKNOWN_COLOR,
      ringColor: e.inCollections ? JOBS_MAP_COLLECTIONS_RING_COLOR : null,
    }
  }
  const section = focusSection ?? e.bidSection
  return {
    color: section ? BID_STAGE_MARKER_COLOR[section] : MAP_PAGE_UNKNOWN_COLOR,
    ringColor: e.bidDueTone ? BID_BOARD_MAP_DUE_RING_COLOR[e.bidDueTone] : null,
  }
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
    const { color, ringColor } = mapPagePinColors(e, fs)
    return {
      id: mapPagePinId(e),
      lat: e.lat,
      lng: e.lng,
      color,
      ringColor,
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
