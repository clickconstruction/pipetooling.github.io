import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import PropertyKindSwitch from '../jobs/PropertyKindSwitch'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { googleMapsSearchUrl } from '../../lib/jobs/jobAddressUrls'
import { linkJobPropertyAndSaveKind, savePropertyKind } from '../../lib/jobs/propertyKindWrite'
import { propertyKindWords, type PropertyKind } from '../../lib/jobs/propertyKind'
import { PROPERTY_KIND_BADGE_FILLS } from '../../lib/jobs/propertyKindBadge'
import { quickfillStationHref } from '../../lib/quickfill/stationDeepLink'
import { propertyKindFollowWords, type PropertyKindRow } from '../../lib/quickfill/propertyKinds'
import { formatCurrencyNoCents } from '../../lib/jobs/jobFormatting'

/**
 * Quickfill → "Property kinds" (v2.4727): one row per property whose kind is
 * not set, for every unpaid job. The address opens Google Maps; the row says
 * what the app already knows (a GC, a commercial account, a telling word) as a
 * hint on the switch; the pick is the Pipeline badge's write, so every job at
 * the address follows. Lien-clock rows (Billed, Collections) first. A pick
 * becomes a green line with Undo where the row stood.
 */

type SavedLine = {
  key: string
  address: string
  kind: Exclude<PropertyKind, ''>
  customerAddressId: string
  follow: string
  lienClock: boolean
}

const STAGE_COLOR: Record<string, string> = {
  Waiting: 'var(--text-muted)',
  Working: 'var(--text-link)',
  'Ready to Bill': 'var(--text-green-700)',
  Billed: 'var(--text-amber-800)',
  Collections: 'var(--text-red-700)',
}

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: '0.75rem 1.25rem',
  alignItems: 'center',
  padding: '0.7rem 0.85rem',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
}

function MapPin() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function QuickfillPropertyKindsSection({
  rows,
  noCustomerCount,
  loading,
  onKindSaved,
  onJobLinked,
}: {
  rows: PropertyKindRow[]
  noCustomerCount: number
  loading: boolean
  onKindSaved: (customerAddressId: string, kind: PropertyKind) => void
  onJobLinked: (jobId: string, customerAddressId: string, kind: PropertyKind) => void
}) {
  const { showToast } = useToastContext()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedLine[]>([])

  const pick = (row: PropertyKindRow, kind: PropertyKind) => {
    if (kind === '' || busyKey) return
    setBusyKey(row.key)
    void (async () => {
      try {
        let addressId = row.customerAddressId
        if (addressId) {
          await savePropertyKind(addressId, kind)
          onKindSaved(addressId, kind)
        } else {
          // No saved property yet: the first pick saves the address as one on the customer; the rest reuse it (v2.4212).
          for (const job of row.jobs) {
            const r = await linkJobPropertyAndSaveKind({ jobId: job.id, customerId: row.customerId, jobAddress: row.address, kind })
            addressId = r.customerAddressId
            onJobLinked(job.id, r.customerAddressId, kind)
          }
        }
        if (addressId) {
          const line: SavedLine = { key: row.key, address: row.address || row.customerName, kind, customerAddressId: addressId, follow: propertyKindFollowWords(row.jobs), lienClock: row.lienClock }
          setSaved((prev) => [line, ...prev.filter((s) => s.key !== row.key)])
        }
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not save the property kind'), 'error')
      } finally {
        setBusyKey(null)
      }
    })()
  }

  const undo = (line: SavedLine) => {
    if (busyKey) return
    setBusyKey(line.key)
    void (async () => {
      try {
        await savePropertyKind(line.customerAddressId, '')
        onKindSaved(line.customerAddressId, '')
        setSaved((prev) => prev.filter((s) => s.key !== line.key))
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not undo'), 'error')
      } finally {
        setBusyKey(null)
      }
    })()
  }

  const savedLine = (line: SavedLine) => {
    const letter = line.kind === 'residential' ? 'R' : 'C'
    const fill = line.kind === 'residential' ? PROPERTY_KIND_BADGE_FILLS.residential : PROPERTY_KIND_BADGE_FILLS.commercial
    return (
      <div key={`saved:${line.key}`} data-testid="property-kind-saved" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.85rem', border: '1px solid var(--border-green)', borderRadius: 8, background: 'var(--bg-green-tint)', fontSize: '0.8125rem', color: 'var(--text-green-800)' }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: fill, color: '#fff', fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0 }}>{letter}</span>
        <span style={{ flex: '1 1 auto', minWidth: 0 }}>
          <strong>{line.address}</strong> marked {propertyKindWords(line.kind)} · {line.follow} follow
          {line.lienClock ? ' · the lien window reads the new deadline now' : ''}
        </span>
        <button type="button" disabled={busyKey === line.key} onClick={() => undo(line)} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-green)', background: 'var(--surface)', color: 'var(--text-green-800)', cursor: 'pointer' }}>
          Undo
        </button>
      </div>
    )
  }

  const rowView = (row: PropertyKindRow) => {
    const busy = busyKey === row.key
    const unlinked = !row.customerAddressId
    return (
      <div key={row.key} data-testid="property-kind-row" style={rowStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {row.address ? (
              <a href={googleMapsSearchUrl(row.address)} target="_blank" rel="noopener noreferrer" title="Open in Google Maps" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none', minWidth: 0, overflowWrap: 'anywhere' }}>
                <MapPin />
                <span>{row.address}</span>
                <span aria-hidden="true" style={{ fontSize: '0.75rem' }}>↗</span>
              </a>
            ) : (
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>No address on the job</span>
            )}
            {row.address ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Open in Google Maps</span> : null}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
            {row.customerName}
            {row.gcName && row.gcName !== row.customerName ? <span style={{ color: 'var(--text-muted)' }}> · GC: {row.gcName}</span> : null}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
            {row.jobs.map((j) => (
              <span key={j.id} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--bg-subtle)', color: 'var(--text-700)' }}>
                {j.label} · <strong style={{ color: STAGE_COLOR[j.stage] }}>{j.stage}</strong>
                {j.openBalance > 0 ? ` · ${formatCurrencyNoCents(j.openBalance)} open` : ''}
              </span>
            ))}
          </div>
          {row.lienClock ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-red-700)' }}>
              The lien clock is running on this job. A residential property's notice is due a month sooner.
              {row.jobs.length > 1 ? ` ${row.jobs.length} jobs follow this pick.` : ''}
            </div>
          ) : row.jobs.length > 1 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.jobs.length} jobs follow this pick.</div>
          ) : null}
          {unlinked ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not one of {row.customerName}'s saved properties yet. The pick saves this address as one and links the job.</div> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
            {row.hint ? (
              <>
                Looks <strong style={{ color: row.hint.kind === 'residential' ? 'var(--text-link)' : 'var(--text-amber-800)' }}>{propertyKindWords(row.hint.kind)}</strong>: {row.hint.why}
              </>
            ) : (
              'No hint. Check the map.'
            )}
          </div>
          <PropertyKindSwitch value="" onPick={(k) => pick(row, k)} voice="lien" size="field" disabled={busy} hint={row.hint?.kind ?? null} label={`Property kind for ${row.address || row.customerName}`} />
        </div>
      </div>
    )
  }

  const lienRows = rows.filter((r) => r.lienClock)
  const beforeRows = rows.filter((r) => !r.lienClock)
  const lienSaved = saved.filter((s) => s.lienClock)
  const beforeSaved = saved.filter((s) => !s.lienClock)

  const groupHeader = (label: string, count: number, hint: string, color: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0.9rem 0 0.4rem' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 700, color }}>
        {label} ({count})
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</span>
    </div>
  )

  return (
    <div data-testid="quickfill-property-kinds">
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
        One row per property. A pick lands on the customer's property, so every job at the address follows. Residential means a house, duplex, triplex, fourplex, or a condo the owner lives in. Everything else is commercial, apartments included. Not sure? Open the map.
      </p>
      {loading && rows.length === 0 ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</div> : null}
      {!loading && rows.length === 0 && saved.length === 0 ? <div style={{ fontSize: '0.875rem', color: 'var(--text-green-800)', fontWeight: 600 }}>Every unpaid job's property is marked.</div> : null}
      {lienRows.length > 0 || lienSaved.length > 0 ? (
        <>
          {groupHeader('Lien clock running', lienRows.length, 'Billed or in Collections. The deadline is already counting on the wrong day.', 'var(--text-red-700)')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {lienSaved.map(savedLine)}
            {lienRows.map(rowView)}
          </div>
        </>
      ) : null}
      {beforeRows.length > 0 || beforeSaved.length > 0 ? (
        <>
          {groupHeader('Before the bill goes out', beforeRows.length, 'Waiting, Working, Ready to Bill. Set now so the clock starts right.', 'var(--text-amber-800)')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {beforeSaved.map(savedLine)}
            {beforeRows.map(rowView)}
          </div>
        </>
      ) : null}
      {noCustomerCount > 0 ? (
        <div style={{ marginTop: '0.9rem', padding: '0.6rem 0.85rem', border: '1px dashed var(--border-strong)', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          {noCustomerCount === 1 ? '1 unpaid job has' : `${noCustomerCount} unpaid jobs have`} no customer, so there is no property to mark.{' '}
          {noCustomerCount === 1 ? 'It is' : 'They are'} in <Link to={quickfillStationHref('no-customer-stages')} style={{ fontWeight: 600 }}>Missing job info</Link>.
        </div>
      ) : null}
    </div>
  )
}
