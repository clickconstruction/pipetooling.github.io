/**
 * The records the Map page cannot place (v2.4805, Map page refresh PR 4). Pure.
 *
 * Three kinds of miss, one sheet: a record with no address at all, an address
 * the geocoder could not find, and a pin placed far from the office (a far
 * job or a wrong address — `mapPageFirstView.ts`). The line under the map
 * counts them and opens the sheet; while the geocoder is still running it
 * says so instead.
 */
import type { MapPagePinKind } from './mapPagePins'

export type MapPageUnplaced = {
  kind: MapPagePinKind
  id: string
  tableLabel: string
  sublabel: string
  linkTo: string
  /** The address on the record when it has one the geocoder cannot key (too short); null when blank. */
  addressLabel: string | null
}

export type GeocodeRowLike = { address_normalized: string; status: 'pending' | 'in_progress' | 'ok' | 'error'; errorMessage?: string }

export type NotFoundGroup<T> = { addressKey: string; addressLabel: string; items: T[]; error: string }

export const NOT_FOUND_DEFAULT = 'Could not place this address'

/** The placed-nowhere records grouped by address with the geocoder's reason, and how many addresses are still being placed. */
export function mapPageNotFound<T extends { addressKey: string; addressLabel: string; lat: number | null; lng: number | null }>(
  entities: readonly T[],
  rows: readonly GeocodeRowLike[],
): { notFound: NotFoundGroup<T>[]; resolving: number } {
  const rowByKey = new Map(rows.map((r) => [r.address_normalized, r]))
  const groups = new Map<string, NotFoundGroup<T>>()
  const resolvingKeys = new Set<string>()
  for (const e of entities) {
    if (e.lat != null && e.lng != null) continue
    const row = rowByKey.get(e.addressKey)
    if (row && (row.status === 'pending' || row.status === 'in_progress')) {
      resolvingKeys.add(e.addressKey)
      continue
    }
    const got = groups.get(e.addressKey)
    if (got) got.items.push(e)
    else groups.set(e.addressKey, { addressKey: e.addressKey, addressLabel: e.addressLabel, items: [e], error: row?.errorMessage ?? NOT_FOUND_DEFAULT })
  }
  return { notFound: [...groups.values()].sort((a, b) => a.addressLabel.localeCompare(b.addressLabel, undefined, { sensitivity: 'base' })), resolving: resolvingKeys.size }
}

export type UnplacedCounts = { noAddress: number; notFoundRecords: number; resolving: number }

/** "Placing 12 addresses…", "4 records have no map location yet", or empty. */
export function unplacedLine(c: UnplacedCounts): string {
  if (c.resolving > 0) return `Placing ${c.resolving.toLocaleString('en-US')} ${c.resolving === 1 ? 'address' : 'addresses'}…`
  const n = c.noAddress + c.notFoundRecords
  if (n <= 0) return ''
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'record has' : 'records have'} no map location yet`
}

/** "3 addresses far from the office", or empty. */
export function farShortLine(addresses: number): string {
  if (addresses <= 0) return ''
  return `${addresses.toLocaleString('en-US')} ${addresses === 1 ? 'address' : 'addresses'} far from the office`
}

/** "J1419 · Vasquez pretest" — a record's name for the sheet. */
export function unplacedName(r: { tableLabel: string; sublabel: string }): string {
  const sub = r.sublabel.trim()
  return sub ? `${sub} · ${r.tableLabel}` : r.tableLabel
}
