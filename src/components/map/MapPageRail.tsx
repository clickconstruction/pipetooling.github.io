/**
 * The rail beside the Map page's map (v2.4804, Map page refresh PR 3): the
 * filter box, the selected place's card, the three distance bands from the
 * office (which double as pin filters), the places nearest the office with a
 * row-hover pulse, and the totals line. On a phone the rail sits under the map
 * and the selected card is the bar. `PlaceCard` is also the pin's popup, compact.
 */
import { useState, type CSSProperties } from 'react'
import type { MapPageEntity } from '../../hooks/useMapPageData'
import { mapPagePinColors } from '../../lib/map/mapPagePins'
import { DISTANCE_BUCKETS, placeCountWords, placeMiles, placeMilesWords, type DistanceBucketKey, type DistanceBucketVisibility, type MapAnchor, type MapPageBand, type MapPagePlace, type NearestRow } from '../../lib/map/mapPagePlaces'
import { mapPageStageWords } from '../../lib/map/mapPageSections'
import type { SubmissionSectionKey } from '../../lib/bids/submissionSections'

export type MapPagePlaceOfEntity = MapPagePlace<MapPageEntity & { lat: number; lng: number }>

const H4: CSSProperties = { margin: 0, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', fontWeight: 700 }
const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)' }
const BUTTON: CSSProperties = { padding: '0.25rem 0.6rem', fontSize: '0.8125rem', cursor: 'pointer', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)' }
const LINK: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }

function Dot({ color, ring, size = 9 }: { color: string; ring?: string | null; size?: number }) {
  return <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: color, flex: 'none', boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }} />
}

const CARD_ROWS = 6

/** The selected place: its address, its miles, its records with Open on each, Directions. `compact` is the popup (fewer rows, no expand). */
export function PlaceCard({ place, anchor, compact, isMobile, focusSection, onOpen, onDirections, precinctWords }: {
  place: MapPagePlaceOfEntity
  anchor: MapAnchor
  compact: boolean
  isMobile: boolean
  focusSection: (e: MapPageEntity) => SubmissionSectionKey | undefined
  onOpen: (e: MapPageEntity) => void
  onDirections: (place: MapPagePlaceOfEntity) => void
  /** The county and precinct from the court areas layer (v2.4807); null while the layer is off. */
  precinctWords?: (place: { lat: number; lng: number }) => string | null
}) {
  const [all, setAll] = useState(false)
  const miles = placeMilesWords(placeMiles(place, anchor))
  const precinct = precinctWords ? precinctWords(place) : null
  const rows = all || (!compact && place.items.length <= CARD_ROWS + 1) ? place.items : place.items.slice(0, compact ? 4 : CARD_ROWS)
  const hidden = place.items.length - rows.length
  const single = place.items.length === 1
  const lead = place.items[0]!
  const actionStyle: CSSProperties = isMobile && !compact ? { ...BUTTON, flex: 1, minHeight: 44, fontSize: '0.9375rem' } : BUTTON
  return (
    <div data-map-place-card style={{ fontSize: compact ? '0.8125rem' : '0.875rem', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 6, minWidth: compact ? 220 : 0, maxWidth: compact ? 320 : undefined, color: 'var(--text-base)' }}>
      <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: isMobile && !compact ? '0.9375rem' : undefined }}>
        {single ? lead.tableLabel : place.addressLabel}
        {single && lead.sublabel.trim() ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{` · ${lead.sublabel.trim()}`}</span> : null}
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        {single ? `${lead.kind === 'bid' ? 'Bid' : lead.kind === 'job' ? 'Job' : 'Estimate'} · ${mapPageStageWords(lead, lead.kind === 'bid' ? focusSection(lead) : undefined)}` : `${placeCountWords(place.items)} at this address`}
        {miles ? ` · ${miles} from the office` : ''}
      </div>
      {single ? <div style={{ color: 'var(--text-muted)' }}>{place.addressLabel}</div> : null}
      {precinct ? <div data-map-precinct style={{ color: 'var(--text-muted)' }}>{`Justice court: ${precinct}`}</div> : null}
      {!single ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
          {rows.map((e) => {
            const fs = e.kind === 'bid' ? focusSection(e) : undefined
            const { color, ringColor } = mapPagePinColors(e, fs)
            return (
              <li key={`${e.kind}-${e.id}`} style={{ display: 'grid', gridTemplateColumns: '10px minmax(0, 1fr) auto auto', gap: '0.5rem', alignItems: 'center', padding: '0.25rem 0', borderTop: '1px solid var(--border)' }}>
                <Dot color={color} ring={ringColor} size={8} />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.sublabel.trim() ? <span style={{ color: 'var(--text-muted)' }}>{`${e.sublabel.trim()} · `}</span> : null}
                  {e.tableLabel}
                </span>
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{mapPageStageWords(e, fs)}</span>
                <button type="button" onClick={() => onOpen(e)} style={{ ...LINK, fontSize: '0.8125rem', minHeight: isMobile ? 36 : undefined }}>
                  Open
                </button>
              </li>
            )
          })}
          {hidden > 0 ? (
            <li style={{ padding: '0.25rem 0', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {compact ? `+ ${hidden} more in the rail` : (
                <button type="button" onClick={() => setAll(true)} style={{ ...LINK, color: 'var(--text-muted)' }}>{`+ ${hidden} more`}</button>
              )}
            </li>
          ) : null}
        </ul>
      ) : null}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        {single ? (
          <button type="button" onClick={() => onOpen(lead)} style={actionStyle}>
            Open
          </button>
        ) : null}
        <button type="button" onClick={() => onDirections(place)} style={actionStyle}>
          Directions
        </button>
      </div>
    </div>
  )
}

export type MapPageRailProps = {
  selected: MapPagePlaceOfEntity | null
  anchor: MapAnchor
  bands: MapPageBand[]
  bandsOn: DistanceBucketVisibility
  onToggleBand: (key: DistanceBucketKey) => void
  nearest: { rows: NearestRow<MapPageEntity & { lat: number; lng: number }>[]; more: number }
  onPickPlace: (place: MapPagePlaceOfEntity) => void
  onHoverPlace: (key: string | null) => void
  focusSection: (e: MapPageEntity) => SubmissionSectionKey | undefined
  onOpen: (e: MapPageEntity) => void
  onDirections: (place: MapPagePlaceOfEntity) => void
  precinctWords?: (place: { lat: number; lng: number }) => string | null
  search: string
  onSearch: (value: string) => void
  totalsLine: string
  /** What the map reads when it has nothing to show. */
  emptyHint: string | null
  isMobile: boolean
}

export function MapPageRail({ selected, anchor, bands, bandsOn, onToggleBand, nearest, onPickPlace, onHoverPlace, focusSection, onOpen, onDirections, precinctWords, search, onSearch, totalsLine, emptyHint, isMobile }: MapPageRailProps) {
  return (
    <div data-map-rail style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          id="map-page-search"
          type="search"
          name="map-page-search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          autoComplete="off"
          placeholder="Filter by name, address, number…"
          aria-label="Filter the map"
          style={{ flex: '1 1 auto', minWidth: 0, padding: '0.4rem 0.55rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 6, minHeight: isMobile ? 40 : undefined }}
        />
        {search.trim() ? (
          <button type="button" onClick={() => onSearch('')} style={{ ...BUTTON, minHeight: isMobile ? 40 : undefined }}>
            Clear
          </button>
        ) : null}
      </div>

      {selected ? (
        <div data-map-selected style={{ ...CARD, borderColor: 'var(--border-blue)', background: 'var(--bg-blue-tint)' }}>
          <PlaceCard place={selected} anchor={anchor} compact={false} isMobile={isMobile} focusSection={focusSection} onOpen={onOpen} onDirections={onDirections} precinctWords={precinctWords} />
        </div>
      ) : (
        <div style={{ ...CARD, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{emptyHint ?? 'Click a pin for its records. A pin with a number is an address with several.'}</div>
      )}

      {anchor ? (
        <div style={CARD}>
          <h4 style={H4}>By distance from the office</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem', marginTop: '0.4rem' }}>
            {bands.map((b) => {
              const on = bandsOn[b.key]
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => onToggleBand(b.key)}
                  aria-pressed={on}
                  title={on ? `Hide the places ${b.label} from the office` : `Show the places ${b.label} from the office`}
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.5rem', background: 'var(--bg-subtle)', cursor: 'pointer', textAlign: 'left', opacity: on ? 1 : 0.45, minHeight: isMobile ? 44 : undefined, color: 'inherit', font: 'inherit' }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{b.label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: 2 }}>{b.places.toLocaleString('en-US')}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{`${b.records.toLocaleString('en-US')} ${b.records === 1 ? 'record' : 'records'}`}</div>
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Tap a box to hide or show that band.</div>
        </div>
      ) : null}

      <div style={CARD}>
        <h4 style={H4}>{anchor ? 'Nearest the office' : 'Places'}</h4>
        {nearest.rows.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.35rem' }}>Nothing on the map.</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
            {nearest.rows.map(({ place, miles }) => {
              const lead = place.items[0]!
              const fs = lead.kind === 'bid' ? focusSection(lead) : undefined
              const { color, ringColor } = mapPagePinColors(lead, fs)
              const single = place.items.length === 1
              return (
                <li key={place.key} style={{ borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => onPickPlace(place)}
                    onMouseEnter={() => onHoverPlace(place.key)}
                    onMouseLeave={() => onHoverPlace(null)}
                    style={{ ...LINK, color: 'inherit', display: 'grid', gridTemplateColumns: '10px minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'center', width: '100%', padding: '0.3rem 0.1rem', fontSize: '0.8125rem', minHeight: isMobile ? 40 : undefined }}
                  >
                    <Dot color={color} ring={ringColor} />
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {single ? (
                        <>
                          {lead.sublabel.trim() ? <span style={{ color: 'var(--text-muted)' }}>{`${lead.sublabel.trim()} · `}</span> : null}
                          {lead.tableLabel}
                        </>
                      ) : (
                        <>
                          {place.addressLabel}
                          <span style={{ color: 'var(--text-muted)' }}>{` · ${placeCountWords(place.items)}`}</span>
                        </>
                      )}
                    </span>
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{placeMilesWords(miles) ?? ''}</span>
                  </button>
                </li>
              )
            })}
            {nearest.more > 0 ? <li style={{ borderTop: '1px solid var(--border)', padding: '0.3rem 0.1rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{`+ ${nearest.more.toLocaleString('en-US')} more on the map`}</li> : null}
          </ul>
        )}
      </div>

      <div data-map-totals style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        {totalsLine}
        {DISTANCE_BUCKETS.some((b) => !bandsOn[b.key]) && anchor ? ' · a band is off' : ''}
      </div>
    </div>
  )
}
