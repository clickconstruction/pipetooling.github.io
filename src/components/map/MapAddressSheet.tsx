/**
 * The address sheet (v2.4805, Map page refresh PR 4): every record the Map
 * page cannot place, in one window — the records with no address, the
 * addresses the geocoder could not find (with its reason and a Google Maps
 * check), and the pins placed far from the office (a far job or a wrong
 * address, with a Google re-check for the office cohort). Each row opens its
 * record so the address is fixed where it lives. The old Review geocodes
 * window is reached from here.
 */
import { useCallback, useState } from 'react'
import type { MapPageEntity } from '../../hooks/useMapPageData'
import { GOOGLE_ONLY_REFRESH_PACING_MS, invokeGeocodeOneRefreshGoogleOnly } from '../../lib/map/invokeGeocodeOneRefreshGoogleOnly'
import { mapGeocodeErrorMessage } from '../../lib/map/geocodeErrorMessage'
import { farMilesWords, farPlaceCountWords, type FarPlace } from '../../lib/map/mapPageFirstView'
import { mapPageDirectionsUrl } from '../../lib/map/mapPagePins'
import { unplacedName, type MapPageUnplaced, type NotFoundGroup } from '../../lib/map/mapPageUnplaced'
import { milesBetween } from '../../lib/bids/bidBoardMap'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { formatErrorMessage } from '../../utils/errorHandling'

type Placed = MapPageEntity & { lat: number; lng: number }

export type OpenableRecord = Pick<MapPageEntity, 'kind' | 'id' | 'linkTo'> & Partial<Pick<MapPageEntity, 'lat' | 'lng' | 'addressKey'>>

const LINK: React.CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline' }
const H3: React.CSSProperties = { margin: '0 0 0.35rem', fontSize: '0.95rem' }
const ROW: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.35rem 0.6rem', padding: '0.4rem 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem' }
const MUTED: React.CSSProperties = { color: 'var(--text-muted)' }
const KIND: Record<MapPageEntity['kind'], string> = { job: 'Job', bid: 'Bid', estimate: 'Estimate' }

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

type NamedRecord = OpenableRecord & { tableLabel: string; sublabel: string }

function RecordLinks({ items, onOpen, max = 3 }: { items: readonly NamedRecord[]; onOpen: (r: OpenableRecord) => void; max?: number }) {
  const shown = items.slice(0, max)
  const more = items.length - shown.length
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35rem 0.6rem' }}>
      {shown.map((r) => (
        <button key={`${r.kind}-${r.id}`} type="button" onClick={() => onOpen(r)} style={LINK} title={`Open this ${KIND[r.kind].toLowerCase()}`}>
          {unplacedName(r)}
        </button>
      ))}
      {more > 0 ? <span style={MUTED}>{`+ ${more} more`}</span> : null}
    </span>
  )
}

export function MapAddressSheet({
  open,
  onClose,
  noAddress,
  notFound,
  resolving,
  far,
  anchor,
  canRecheck,
  onOpen,
  onShow,
  onAfterRecheck,
  onReviewAll,
}: {
  open: boolean
  onClose: () => void
  noAddress: readonly MapPageUnplaced[]
  notFound: readonly NotFoundGroup<MapPageEntity>[]
  resolving: number
  far: readonly FarPlace<Placed>[]
  anchor: { lat: number; lng: number } | null
  /** Dev, master and the assistant-like roles may re-run Google on an address (the function's own rule). */
  canRecheck: boolean
  onOpen: (r: OpenableRecord) => void
  onShow: (lat: number, lng: number) => void
  onAfterRecheck: () => void | Promise<void>
  onReviewAll: () => void
}) {
  const [recheck, setRecheck] = useState<Record<string, { busy: boolean; words: string; ok?: boolean }>>({})
  const recheckAddress = useCallback(
    async (p: FarPlace<Placed>) => {
      setRecheck((prev) => ({ ...prev, [p.addressKey]: { busy: true, words: 'Asking Google…' } }))
      try {
        await sleep(GOOGLE_ONLY_REFRESH_PACING_MS)
        const res = await invokeGeocodeOneRefreshGoogleOnly(p.addressLabel)
        if (res.ok) {
          const miles = anchor ? milesBetween(anchor, { lat: res.lat, lng: res.lng }) : null
          const moved = Math.abs(res.lat - p.lat) > 1e-4 || Math.abs(res.lng - p.lng) > 1e-4
          setRecheck((prev) => ({ ...prev, [p.addressKey]: { busy: false, ok: true, words: moved ? `Google placed it ${miles != null ? `${farMilesWords(miles)} from the office` : 'elsewhere'} — the map will reload` : 'Google agrees with this spot — the address on the record is what to check' } }))
          if (moved) await Promise.resolve(onAfterRecheck())
        } else {
          setRecheck((prev) => ({ ...prev, [p.addressKey]: { busy: false, ok: false, words: mapGeocodeErrorMessage(res.error, res.detail) } }))
        }
      } catch (e) {
        setRecheck((prev) => ({ ...prev, [p.addressKey]: { busy: false, ok: false, words: formatErrorMessage(e, 'Google could not be asked') } }))
      }
    },
    [anchor, onAfterRecheck],
  )
  if (!open) return null
  const nothing = noAddress.length === 0 && notFound.length === 0 && far.length === 0 && resolving === 0
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, paddingTop: 'var(--app-top-chrome, 0px)' }}
      role="dialog"
      aria-modal
      aria-labelledby="map-address-sheet-title"
      onClick={onClose}
    >
      <div
        data-map-address-sheet
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1rem 1.25rem', borderRadius: 10, width: 'min(96vw, 680px)', maxHeight: 'min(88vh, 100%)', overflow: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2 id="map-address-sheet-title" style={{ margin: 0, fontSize: '1.1rem', flex: '1 1 auto' }}>
            Records the map cannot place
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: '1px solid var(--border-strong)', borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.5rem', fontSize: '1rem', lineHeight: 1.6 }}>
            ×
          </button>
        </div>
        {resolving > 0 ? <p style={{ margin: 0, ...MUTED, fontSize: '0.875rem' }}>{`Placing ${resolving} ${resolving === 1 ? 'address' : 'addresses'}… this list fills in as the geocoder answers.`}</p> : null}
        {nothing ? <p style={{ margin: 0, ...MUTED, fontSize: '0.875rem' }}>Every record with an address is on the map, and none is far from the office.</p> : null}

        {noAddress.length > 0 ? (
          <section data-sheet-no-address>
            <h3 style={H3}>{`No address · ${noAddress.length}`}</h3>
            <p style={{ margin: '0 0 0.25rem', ...MUTED, fontSize: '0.8125rem' }}>Open the record and type the site address: street, city and state.</p>
            {noAddress.map((r) => (
              <div key={`${r.kind}-${r.id}`} style={ROW}>
                <span style={{ ...MUTED, width: '4.5rem' }}>{KIND[r.kind]}</span>
                <button type="button" onClick={() => onOpen(r)} style={LINK}>
                  {unplacedName(r)}
                </button>
                {r.addressLabel ? <span style={MUTED}>{`has only "${r.addressLabel}"`}</span> : null}
              </div>
            ))}
          </section>
        ) : null}

        {notFound.length > 0 ? (
          <section data-sheet-not-found>
            <h3 style={H3}>{`Could not be found · ${notFound.length} ${notFound.length === 1 ? 'address' : 'addresses'}`}</h3>
            <p style={{ margin: '0 0 0.25rem', ...MUTED, fontSize: '0.8125rem' }}>The geocoder has no match. Check the spelling on Google Maps, then fix it on the record.</p>
            {notFound.map((g) => (
              <div key={g.addressKey} style={ROW}>
                <span style={{ fontWeight: 600 }}>{g.addressLabel}</span>
                <span style={MUTED}>{g.error}</span>
                <button type="button" onClick={() => openInExternalBrowser(mapPageDirectionsUrl(g.addressLabel))} style={LINK}>
                  Check on Google Maps ↗
                </button>
                <RecordLinks items={g.items} onOpen={onOpen} />
              </div>
            ))}
          </section>
        ) : null}

        {far.length > 0 ? (
          <section data-sheet-far>
            <h3 style={H3}>{`Far from the office · ${far.length} ${far.length === 1 ? 'address' : 'addresses'}`}</h3>
            <p style={{ margin: '0 0 0.25rem', ...MUTED, fontSize: '0.8125rem' }}>More than 300 miles out: a far job, or a wrong address. The map draws these but never frames them.</p>
            {far.map((p) => {
              const st = recheck[p.addressKey]
              return (
                <div key={p.addressKey} style={ROW}>
                  <span style={{ fontWeight: 600 }}>{p.addressLabel}</span>
                  <span style={MUTED}>{`${farPlaceCountWords(p.items)} · ${farMilesWords(p.miles)}`}</span>
                  <button type="button" onClick={() => onShow(p.lat, p.lng)} style={LINK}>
                    Show on the map
                  </button>
                  {canRecheck ? (
                    <button type="button" onClick={() => void recheckAddress(p)} disabled={st?.busy} style={{ ...LINK, opacity: st?.busy ? 0.5 : 1 }} title="Ask Google again for this address">
                      Re-check with Google
                    </button>
                  ) : null}
                  <RecordLinks items={p.items} onOpen={onOpen} />
                  {st?.words ? <span style={{ width: '100%', fontSize: '0.8125rem', color: st.ok === false ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{st.words}</span> : null}
                </div>
              )
            })}
          </section>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          {canRecheck ? (
            <button type="button" onClick={onReviewAll} style={{ ...LINK, fontSize: '0.8125rem' }}>
              Review every geocode…
            </button>
          ) : <span />}
          <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.9rem', cursor: 'pointer', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
